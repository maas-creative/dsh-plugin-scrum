"""Independent validation of redirect stubs and surrogate interstitial pages."""
import re
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit

class PageShape(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title = []
        self.text = []
        self.links = []
        self.in_title = False
        self.hidden = 0
        self.refresh = False
    def handle_starttag(self, tag, attrs):
        data = dict(attrs)
        if tag == "title": self.in_title = True
        if tag in ("script", "style"): self.hidden += 1
        if tag == "a" and data.get("href"): self.links.append(data["href"])
        if tag == "meta" and data.get("http-equiv", "").lower() == "refresh": self.refresh = True
    def handle_endtag(self, tag):
        if tag == "title": self.in_title = False
        if tag in ("script", "style"): self.hidden = max(0, self.hidden - 1)
    def handle_data(self, text):
        if self.in_title: self.title.append(text)
        elif not self.hidden: self.text.append(text)

def is_redirect_stub(body, target_url=None):
    page = PageShape()
    page.feed(str(body))
    visible = " ".join(" ".join(page.text).split())
    if page.refresh and len(visible) < 256: return True
    if target_url and len(page.links) == 1 and len(visible) < 128:
        target = urlsplit(target_url)
        link = urlsplit(urljoin(target_url, page.links[0]))
        if (link.hostname, link.path.rstrip("/")) == (target.hostname, target.path.rstrip("/")) and re.search(r"\b(?:redirect|continue|open|visit|original)\b", visible, re.I): return True
    return False

def surrogate_dead_end(body, target_url=None):
    page = PageShape()
    page.feed(str(body))
    title = " ".join(page.title).strip()
    if re.search(r"^(?:redirecting|just a moment|checking (?:your )?browser|access denied|page unavailable|before (?:you )?continuing)(?:\b|[.!…])", title, re.I): return True
    return is_redirect_stub(body, target_url)
