# Local cookie helpers

These independently implemented helpers operate on an explicitly selected local browser profile. They are not a public-page fallback and do not grant account access. Keychain access occurs only when extraction is invoked. The host's authorization and OS permissions still apply.

Use Python 3.11 or newer. Chromium decryption requires the separately installed `cryptography` package; validation used version 50.0.2. Firefox SQLite extraction uses the Python standard library. CDP import requires Node with its global WebSocket implementation; validation used the project's Node runtime.

`extract_cookies.py --browser <chrome|brave|chromium|firefox> --domain <authorized-domain> --output <private-json-path>` exports only the selected domain and its subdomains. Repeat `--domain` for multiple explicit domains. Without an output or import option, the result is printed; use a private file when logs are visible to others.

`--inject --cdp <port>` explicitly imports into a loopback debugging endpoint. The default port is 9242. This does not select or start a browser. Check which isolated or authorized browser owns that port before using it. Session cookies omit the expiry field in the CDP request. An unavailable server or rejected import raises an error rather than a success report.

Snapshots use SQLite backup so committed WAL records remain visible. The source database is unchanged. Export uses atomic replacement with private file permissions and refuses a symlink destination. Temporary snapshots are removed after extraction. Domain matching uses SQL parameters and literal wildcard escaping.

macOS uses the selected browser's Keychain service. The legacy Linux interface supports the basic password store. Windows uses the selected profile's Local State key with OS DPAPI. Unsupported envelopes are rejected; no protection is disabled. Chromium v24 domain hashes are verified before decoding the value. Real Windows DPAPI and real account-keyring extraction have not been validated in this workspace; synthetic fixtures are not evidence of that.

The upstream browser_cookie3 candidate was evaluated privately and is not bundled or used by these helpers. Its broad domain filter did not satisfy the required boundary. Original OMO helper files and tests are retained only under excluded private `work` evidence.
