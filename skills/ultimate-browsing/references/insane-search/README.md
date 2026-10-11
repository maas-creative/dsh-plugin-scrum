# Public reader routes

The bundled reader uses unmodified MIT source from fivetaku/insane-search at the commit recorded in vendor/public-reader-independent/provenance.json. Independent Scrum adapters retain the host result schema, public archive checks, and explicit proxy opt-in.

Start with the original URL and inspect the result before retrying. Prefer structured metadata or a documented public API over rendering an entire application. A small complete page can be valid; an interstitial or redirect stub cannot substitute for the target document.

Read public-api.md and json-api.md for structured records; rss.md and metadata.md for discovery; cache-archive.md, fallback.md and jina.md for retrieval failures; playwright.md for authorized rendering. For non-text evidence use media.md. Site adapters remain optional: validate the currently installed capability rather than assuming a particular external package or account exists.
