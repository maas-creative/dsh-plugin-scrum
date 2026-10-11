# Independent compatibility interface; original MIT runtime remains in vendor/public-reader-independent.
import importlib
from . import _native
_module = importlib.import_module(_native.__name__ + ".url_transforms")
TRANSFORMS, apply_transform, iter_transformed = _module.TRANSFORMS, _module.apply_transform, _module.iter_transformed
