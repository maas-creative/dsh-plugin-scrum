"""Scrum's independent provenance and surrogate adapter over the MIT reader."""
from __future__ import annotations
import dataclasses
import importlib
from public_reader_loader import load_public_reader
from public_reader_surrogates import run_surrogate
from public_reader_validation import surrogate_dead_end

native = load_public_reader()
NativeResult = native.FetchResult

@dataclasses.dataclass(init=False)
class FetchResult(NativeResult):
    provenance: str = "live"
    snapshot_timestamp: str | None = None
    trust: str = "origin"
    def __init__(self, ok, content="", final_url="", verdict="", profile_used=None, trace=None, summary="", provenance="live", snapshot_timestamp=None, trust="origin", **diagnostics):
        if provenance not in ("live", "snapshot", "proxy") or trust not in ("origin", "archive", "untrusted"):
            raise ValueError("Invalid retrieval provenance or trust")
        if provenance == "proxy" and trust != "untrusted": raise ValueError("Proxy content must remain untrusted")
        if provenance == "snapshot" and trust != "archive": raise ValueError("Snapshot content must retain archive trust")
        super().__init__(ok=ok, content=content, final_url=final_url, verdict=verdict, profile_used=profile_used, trace=list(trace or []), summary=summary, **diagnostics)
        self.provenance, self.snapshot_timestamp, self.trust = provenance, snapshot_timestamp, trust
    def to_dict(self):
        return {**super().to_dict(), "provenance": self.provenance, "snapshot_timestamp": self.snapshot_timestamp, "trust": self.trust}

def _convert(result, **overrides):
    values = {field.name: getattr(result, field.name) for field in dataclasses.fields(NativeResult)}
    return FetchResult(**{**values, **overrides})

def validate(response, *, success_selectors=None, known_bad_sizes=None, size_tolerance=20, target_url=None):
    result = native.validate(response, success_selectors=success_selectors, known_bad_sizes=known_bad_sizes, size_tolerance=size_tolerance)
    if target_url and surrogate_dead_end(getattr(response, "text", ""), target_url):
        result.verdict = native.Verdict.CHALLENGE
        result.reasons = list(result.reasons) + ["Redirect stub or interstitial is not retrieved content"]
    return result

def format_summary(trace, profile=None):
    attempts = list(trace)
    successes = sum(attempt.verdict in ("strong_ok", "weak_ok") for attempt in attempts)
    summary = f"Retrieval attempts: {len(attempts)}; validated successes: {successes}."
    if profile: summary += " Profile: " + str(profile) + "."
    if sum(attempt.verdict == "challenge" for attempt in attempts) >= 3:
        summary += " Inspect documented public APIs, feeds or browser-observed JSON endpoints before repeating blocked page requests."
    return summary

def _performed_attempts(trace):
    return sum(not (str(attempt.error or "").startswith("skipped:") or str(attempt.executor).startswith("playwright_mcp")) for attempt in trace)


def fetch(url, *, success_selectors=None, device_class="auto", user_hint=None, timeout=25, max_attempts=None, enable_playwright=True, allow_surrogate_proxy=False, surrogate_registry=None, **options):
    # The pinned reader keeps its content rescue/retry/learning capabilities.
    # Its browser stage is held until the independent surrogate stage settles.
    browser_budget = options.get("max_browser_attempts", 2)
    if not isinstance(browser_budget, int) or isinstance(browser_budget, bool) or browser_budget < 0: raise ValueError("Invalid browser attempt budget")
    result = native.fetch(url, success_selectors=success_selectors, device_class=device_class, user_hint=user_hint, timeout=timeout, max_attempts=max_attempts, enable_playwright=False, **options)
    if result.ok or result.verdict == "auth_required" or result.stop_reason == "auth_required":
        return _convert(result)
    traces, provenance, body = run_surrogate(url, registry=surrogate_registry, allow_proxy=allow_surrogate_proxy, timeout=timeout, success_selectors=success_selectors)
    all_traces = list(result.trace) + traces
    if body:
        source = provenance.pop("final_url", url)
        provenance.pop("surrogate", None)
        return FetchResult(ok=True, content=body, final_url=source, verdict=traces[-1].verdict, profile_used=result.profile_used, trace=all_traces, summary=format_summary(all_traces, result.profile_used), executed_attempts=_performed_attempts(all_traces), planned_attempts=result.planned_attempts + len(traces), stop_reason="success", **provenance)
    if enable_playwright and result.verdict != "not_found" and result.stop_reason != "not_found":
        executor = importlib.import_module(native.__name__ + ".executor")
        profiles = importlib.import_module(native.__name__ + ".waf_detector")
        chain = importlib.import_module(native.__name__ + ".fetch_chain")
        profile_id = result.profile_used or "unknown_challenge"
        order = profiles.load_profile(profile_id).get("fallback_when_challenge") or ["playwright_real_chrome"]
        used = 0
        for route in order:
            if route == "curl_grid_exhaust" or route.startswith("surrogate_"): continue
            stub = route.startswith("playwright_mcp")
            if not stub and used >= browser_budget: break
            try:
                attempt, rendered = executor.run_playwright_fallback(url, profile_id=profile_id, success_selectors=success_selectors, device_class=device_class, timeout=timeout if timeout > 30 else 90, force_executor=route)
            except Exception as error:
                attempt, rendered = native.Attempt("fallback", route, url, "original", None, "", error=type(error).__name__ + ":browser fallback failed"), ""
            all_traces.append(attempt)
            if not stub: used += 1
            if rendered and attempt.verdict in ("strong_ok", "weak_ok"):
                # The MIT reader's pinned rescue implementation retains its PDF,
                # markdown, structured-data and rendered-inner-text behavior.
                _, body, quality, metadata = chain._maybe_extract(chain._PWResp(rendered, attempt.url), attempt.url, enable_extraction=options.get("enable_extraction", True), inner_text=getattr(attempt, "_inner_text", ""), enable_markdown=options.get("enable_markdown", True), enable_maincontent=options.get("enable_maincontent", False))
                return FetchResult(ok=True, content=body, final_url=attempt.url, verdict=attempt.verdict, profile_used=result.profile_used, trace=all_traces, summary=format_summary(all_traces, result.profile_used), executed_attempts=_performed_attempts(all_traces), planned_attempts=result.planned_attempts + len(all_traces) - len(result.trace), stop_reason="success", extraction_quality=quality, extraction_source=metadata.get("source", ""), extraction_meta=metadata)
    return _convert(result, trace=all_traces, executed_attempts=_performed_attempts(all_traces), planned_attempts=result.planned_attempts + len(all_traces) - len(result.trace), summary=format_summary(all_traces, result.profile_used))
