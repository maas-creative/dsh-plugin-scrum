# Independent compatibility interface; original MIT runtime remains in vendor/public-reader-independent.
import importlib
from . import _native
run_playwright_fallback = importlib.import_module(_native.__name__ + ".executor").run_playwright_fallback
