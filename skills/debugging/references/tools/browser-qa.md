# Collect browser evidence for the failing interaction

Use the configured browser connection and the exact owned tab. Capture visible state, relevant accessibility labels, network failures and console errors before changing the page. Follow the installed browser tool's documented API; do not guess element IDs or fabricate a successful click.

Exercise the user's original sequence with realistic data and production settings. Verify input submission, response rendering, loading and error states, preserved scroll position and narrow-screen layout when relevant. Keep authentication in the browser flow and never copy secrets into logs.

A screenshot alone does not prove persistence or successful backend execution. Correlate UI output with the actual request and resulting stored state. Close only owned temporary tabs, keep useful screenshots and record which browser and viewport were tested.
