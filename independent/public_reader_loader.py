"""Load the separately licensed, pinned original reader in its own namespace."""
import hashlib
import importlib.util
import sys
from pathlib import Path

def load_public_reader():
    folder = (Path(__file__).resolve().parent.parent / "vendor/public-reader-independent/source/engine").resolve()
    name = "scrum_public_reader_vendor_" + hashlib.sha256(str(folder).encode()).hexdigest()[:16]
    if name in sys.modules:
        return sys.modules[name]
    spec = importlib.util.spec_from_file_location(name, folder / "__init__.py", submodule_search_locations=[str(folder)])
    if spec is None or spec.loader is None:
        raise RuntimeError("Pinned public reader is unavailable")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    try:
        spec.loader.exec_module(module)
        # Keep editable host profiles outside the unmodified preferred source.
        configured = Path(__file__).resolve().parent.parent / "skills/ultimate-browsing/engine/waf_profiles.yaml"
        if configured.is_file():
            detector = sys.modules[name + ".waf_detector"]
            chain = sys.modules[name + ".fetch_chain"]
            original = detector._load_profiles
            def load_profiles(path=None):
                return original(str(configured if path is None else path))
            detector._load_profiles = load_profiles
            chain._load_profiles = load_profiles
    except BaseException:
        for key in list(sys.modules):
            if key == name or key.startswith(name + "."):
                del sys.modules[key]
        raise
    return module
