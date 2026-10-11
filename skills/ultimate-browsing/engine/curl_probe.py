# Independent compatibility interface; original MIT runtime remains in vendor/public-reader-independent.
import importlib
from typing import Protocol, Any
from . import _native
class ProbeResponse(Protocol):
    status_code: int
    text: str
    headers: Any
    cookies: Any
run_attempt = importlib.import_module(_native.__name__ + ".fetch_chain")._run_attempt
