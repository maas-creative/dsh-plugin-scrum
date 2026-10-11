# Isolated Python environments

Inspect the current project environment before creating another one. Confirm the Python version, dependency manifests and installed packages. Prefer the project's lock file when available. Do not change global packages or the user's default interpreter merely to run an analysis.

When uv is already installed, an explicit local environment can be prepared using uv venv and packages installed with uv pip install --python pointing to that environment's interpreter. Use the verified executable path for subsequent commands. Activating a shell environment is optional when commands name the interpreter explicitly.

The independent query helper requires Polars. Its SQL path additionally requires DuckDB and PyArrow. Rich is optional for table rendering. Its help and missing-file validation use only the standard library. The verified development combination is Python 3.12.12, Polars 2.0.0, DuckDB 1.5.6, PyArrow 25.0.1 and Rich 15.0.0; record different versions and validate behavior before claiming equivalence.

If uv is missing, use a trusted official installation method appropriate to the operating system or the project's documented runtime provisioning. Verify the resulting version and path. Do not interpret an installer exit code alone as proof that a later shell can find the executable. Network, administrator and browser permissions remain governed by the host and user's authorization.

The four environment helper entry points use the independent Node 24 setup engine. ensure-py-deps.sh accepts a Python executable and returns a versioned cache containing verified Polars and PyArrow imports. ensure-js-deps.sh returns a verified DuckDB Node module path, using Bun or npm when installation is needed. SCRUM_DATA_SCIENTIST_CACHE_ROOT selects an owned cache; the legacy default cache path is preserved. setup-uv.sh and setup-uv.ps1 update an existing uv or use the official standalone installer with shell-profile modification disabled. --help performs no installation. Real macOS Python, npm/DuckDB and fresh uv installation have passed; Windows installation remains unverified. These helpers do not provision the Python DuckDB dependency required by SQL queries.

For the standard engine regression tests, SCRUM_DATA_QUERY_PYTHON selects a prepared interpreter. Tests do not install packages automatically or silently skip missing engines. Preserve the original environment and clean up only disposable environments owned by the current analysis.
