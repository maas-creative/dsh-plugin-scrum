"""Declarative public archive/reader retrieval, implemented from public APIs."""
import datetime
import importlib
import json
import os
import time
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import quote, unquote, urljoin, urlsplit
from public_reader_loader import load_public_reader
from public_reader_validation import surrogate_dead_end

native = load_public_reader()
safety = importlib.import_module(native.__name__ + ".safety")
MAX_RESPONSE_BYTES = 16 * 1024 * 1024

@dataclass
class PublicResponse:
    status_code: int
    content: bytes
    url: str
    headers: dict
    @property
    def text(self): return self.content.decode("utf-8", "replace")
    def json(self): return json.loads(self.text)

def public_request(url, timeout=25):
    from curl_cffi import requests
    if not isinstance(timeout, (int, float)) or not 0 < timeout <= 600:
        raise ValueError("Invalid public request timeout")
    deadline = time.monotonic() + timeout
    for _ in range(11):
        parsed = urlsplit(url)
        if parsed.username or parsed.password: raise ValueError("Credential-bearing surrogate URLs are forbidden")
        allowed, reason = safety.classify_url(url, allow_private=safety.allow_private_default())
        if not allowed: raise ValueError("Unsafe public URL: " + reason)
        remaining = deadline - time.monotonic()
        if remaining <= 0: raise TimeoutError("Public request deadline exceeded")
        response = requests.get(url, timeout=remaining, allow_redirects=False, stream=True, headers={"Accept": "text/html,application/json,text/plain"})
        try:
            if response.status_code in (301, 302, 303, 307, 308):
                location = response.headers.get("Location")
                if not location: raise ValueError("Redirect has no location")
                url = urljoin(url, location)
                continue
            chunks, size = [], 0
            for chunk in response.iter_content(chunk_size=65536):
                size += len(chunk)
                if size > MAX_RESPONSE_BYTES: raise ValueError("Public response exceeds size limit")
                if time.monotonic() > deadline: raise TimeoutError("Public request deadline exceeded")
                chunks.append(chunk)
            return PublicResponse(response.status_code, b"".join(chunks), str(response.url), dict(response.headers))
        finally: response.close()
    raise ValueError("Too many public redirects")

def load_surrogates(path=None):
    if path is None:
        configured = Path(__file__).resolve().parent.parent / "skills/ultimate-browsing/engine/surrogates.yaml"
        path = configured if configured.is_file() else Path(__file__).with_name("public-reader-surrogates.json")
    data = Path(path).read_bytes()
    if len(data) > 1024 * 1024: raise ValueError("Surrogate registry exceeds size limit")
    if Path(path).suffix.lower() == ".json": value = json.loads(data)
    else:
        import yaml
        value = yaml.safe_load(data)
    if not isinstance(value, dict) or any(not isinstance(k, str) or not isinstance(v, dict) for k, v in value.items()): raise ValueError("Invalid surrogate registry")
    return value

def is_stale(entry, max_age_days=90, today=None):
    if not isinstance(max_age_days, int) or max_age_days < 0: raise ValueError("Invalid staleness interval")
    current = today or datetime.date.today()
    if isinstance(current, str): current = datetime.date.fromisoformat(current)
    if isinstance(current, datetime.datetime): current = current.date()
    if not isinstance(current, datetime.date): raise ValueError("Invalid current date")
    verified = entry.get("last_verified")
    if isinstance(verified, str):
        try: verified = datetime.date.fromisoformat(verified)
        except ValueError: return True
    if isinstance(verified, datetime.datetime): verified = verified.date()
    return not isinstance(verified, datetime.date) or not 0 <= (current - verified).days <= max_age_days

def _pointer(value, pointer):
    if not isinstance(pointer, str): return None
    keys = pointer[1:].split("/") if pointer.startswith("/") else pointer.split(".")
    for key in keys:
        key = key.replace("~1", "/").replace("~0", "~")
        if isinstance(value, dict): value = value.get(key)
        elif isinstance(value, list) and key.isdigit() and int(key) < len(value): value = value[int(key)]
        else: return None
    return value

def _render(template, target, host=""):
    if not isinstance(template, str): raise ValueError("Surrogate URL template is required")
    return template.format(target=target, target_encoded=quote(target, safe=""), host=host)

def _same_target(left, right):
    a, b = urlsplit(left), urlsplit(right)
    return (a.scheme.lower(), a.hostname, a.port or (443 if a.scheme == "https" else 80), a.path or "/", a.query) == (b.scheme.lower(), b.hostname, b.port or (443 if b.scheme == "https" else 80), b.path or "/", b.query)

def _snapshot_target(url):
    import re
    match = re.match(r"^/web/\d{1,14}(?:[a-z_]+)?/(.+)$", urlsplit(url).path)
    if not match: return None
    path = match.group(1)
    if not path.startswith(("http://", "https://")): path = unquote(path)
    query = urlsplit(url).query
    return path + (("?" + query) if query else "")


def _reader_envelope(body):
    import re
    source = re.search(r"^URL Source:\s*(\S+)\s*$", body, re.M)
    split = re.split(r"^Markdown Content:\s*$", body, maxsplit=1, flags=re.M)
    if not source or len(split) != 2: return None
    return {"source": source.group(1), "body": split[1].strip(), "cached": bool(re.search(r"^Warning:.*cached snapshot", split[0], re.I | re.M))}


def run_surrogate(target, *, registry=None, allow_proxy=False, timeout=25, success_selectors=None):
    entries = load_surrogates() if registry is None else registry
    if not isinstance(entries, dict): raise ValueError("Invalid surrogate registry")
    traces = []
    empty = {"provenance": "live", "snapshot_timestamp": None, "trust": "origin", "surrogate": None}
    parsed = urlsplit(target)
    if parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username or parsed.password: raise ValueError("Surrogate target must be an HTTP URL without credentials")
    ordered = sorted(entries.items(), key=lambda item: is_stale(item[1]))
    for name, entry in ordered:
        if not isinstance(entry, dict): raise ValueError("Invalid surrogate entry")
        if not entry.get("enabled", True): continue
        kind = entry.get("kind")
        if kind not in ("archive", "reader", "proxy"): raise ValueError("Unknown surrogate kind")
        attempt = native.Attempt("surrogate", "surrogate_" + name, target, "original", None, "")
        traces.append(attempt)
        if is_stale(entry): attempt.reasons.append("Registry verification is stale or unknown")
        if kind == "proxy" and not allow_proxy:
            attempt.error = "skipped:proxy_requires_allow_proxy_flag"
            continue
        required = entry.get("enabled_env")
        if required and not os.environ.get(required):
            attempt.error = "skipped:missing_env:" + required
            continue
        start = time.monotonic()
        try:
            discovery, stamp = entry.get("discovery"), None
            if discovery:
                response = public_request(_render(discovery["url"], target), timeout)
                if response.status_code != 200: raise ValueError("Archive discovery failed")
                document = response.json()
                if not _pointer(document, discovery["flag_pointer"]): raise ValueError("No available archive")
                url = _pointer(document, discovery["snapshot_url_pointer"])
                stamp = _pointer(document, discovery["snapshot_timestamp_pointer"])
                if not isinstance(url, str) or not isinstance(stamp, str) or not stamp.isdigit() or not 1 <= len(stamp) <= 14: raise ValueError("Archive discovery lacks snapshot identity")
                if entry.get("snapshot_host") and urlsplit(url).hostname != entry["snapshot_host"]: raise ValueError("Archive discovery returned an unexpected host")
                captured_target = _snapshot_target(url)
                if captured_target is not None and not _same_target(captured_target, target): raise ValueError("Archive snapshot belongs to another target")
                if entry.get("require_embedded_target") and captured_target is None: raise ValueError("Archive snapshot lacks target identity")
                urls = [url]
            else: urls = [_render(entry.get("fetch"), target, host) for host in (entry.get("host_rotation") or [""])]
            for url in urls:
                attempt.url = url
                response = public_request(url, timeout)
                attempt.status = response.status_code
                attempt.body_size = len(response.content)
                reader = _reader_envelope(response.text) if kind == "reader" else None
                if reader and not _same_target(reader["source"], target): raise ValueError("Reader content belongs to another target")
                verdict = native.validate(response, success_selectors=success_selectors)
                attempt.verdict, attempt.reasons = verdict.verdict.value, attempt.reasons + list(verdict.reasons)
                minimum = entry.get("min_body_bytes", 128)
                if not isinstance(minimum, int) or minimum < 0: raise ValueError("Invalid surrogate body minimum")
                if reader and len(reader["body"].encode("utf-8")) >= minimum and verdict.reasons and all(reason.startswith("tiny_body:") for reason in verdict.reasons):
                    attempt.verdict = "weak_ok"
                    attempt.reasons.append("Structured reader source identity and content validated")
                if response.status_code == 200 and attempt.body_size >= minimum and not surrogate_dead_end(response.text, target) and attempt.verdict in ("strong_ok", "weak_ok"):
                    if kind == "archive" and stamp is None:
                        import re
                        found = re.search(r"/web/(\d{1,14})(?:[a-z_]+)?/", response.url)
                        stamp = found.group(1) if found else None
                        if not stamp:
                            from email.utils import parsedate_to_datetime
                            header = next((v for k,v in response.headers.items() if k.lower() == "memento-datetime"), None)
                            if header: stamp = parsedate_to_datetime(header).astimezone(datetime.timezone.utc).strftime("%Y%m%d%H%M%S")
                            else: attempt.reasons.append("Archive capture timestamp is unavailable; never present this as a live page")
                    cached = kind == "archive" or bool(reader and reader["cached"])
                    if reader and reader["cached"]: attempt.reasons.append("Reader supplied a cached snapshot; capture timestamp is unknown")
                    metadata = {"provenance": "snapshot" if cached else "proxy" if kind == "proxy" else "live", "snapshot_timestamp": stamp, "trust": "archive" if cached else "untrusted", "surrogate": name, "final_url": response.url}
                    attempt.elapsed_s = round(time.monotonic() - start, 3)
                    return traces, metadata, response.text
                if surrogate_dead_end(response.text, target): attempt.reasons.append("Surrogate redirect or interstitial is not content")
        except Exception as error:
            # Do not print URLs, provider responses or environment secrets into logs.
            attempt.error = type(error).__name__ + ":surrogate retrieval failed"
        attempt.elapsed_s = round(time.monotonic() - start, 3)
    return traces, empty, ""
