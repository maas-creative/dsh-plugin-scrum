# Independent compatibility interface; original MIT runtime remains in vendor/public-reader-independent.
from typing import Literal
from public_reader_adapter import FetchResult
from . import Attempt
Provenance = Literal["live", "snapshot", "proxy"]
Trust = Literal["origin", "archive", "untrusted"]
