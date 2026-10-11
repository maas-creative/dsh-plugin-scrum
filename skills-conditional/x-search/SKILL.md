---
name: x-search
description: Search public X posts through the configured xAI search provider and report the returned source links and limits.
---

# Search public posts with evidence

Use `x_search` only when public X posts are relevant to the request and the tool is available. This conditional skill is registered when the host has an xAI credential. Do not request secrets in chat or invent a credential. A configured provider must satisfy the user’s model policy before a real request is sent.

Send a concrete `query`. Optional `from_date` and `to_date` use YYYY-MM-DD and the start must not follow the end. Narrow accounts with `allowed_x_handles` or `excluded_x_handles`; do not combine nonempty include and exclude lists. `mode` is `latest` or `top`. `max_results` is an integer from 1 through 100, with a default of 10. This requested result count is not a guarantee that the provider will return that many distinct posts.

Image and video understanding are disabled by default. Set `enable_image_understanding` or `enable_video_understanding` only when those media are needed and the configured provider supports them. Authentication is resolved for each call, so do not assume a credential captured during startup remains current.

Report the returned source URLs near the claims they support. Distinguish post contents from verified external facts and your own interpretation. Preserve executed-query and usage information when it matters to reproduce the search. Empty results, provider errors and missing access must be stated rather than filled with plausible posts. Respect cancellation and do not automatically repeat a stopped search.
