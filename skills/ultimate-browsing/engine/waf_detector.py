# Independent compatibility interface; original MIT runtime remains in vendor/public-reader-independent.
import importlib
from . import _native
_module = importlib.import_module(_native.__name__ + ".waf_detector")
detect, load_profile = _module.detect, _module.load_profile
