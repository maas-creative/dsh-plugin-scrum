# Independent compatibility interface; original MIT runtime remains in vendor/public-reader-independent.
import importlib
from . import _native
REFERER_STRATEGIES = importlib.import_module(_native.__name__ + ".fetch_chain").REFERER_STRATEGIES
