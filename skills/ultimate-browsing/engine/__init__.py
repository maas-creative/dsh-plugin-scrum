# Independently authored host interface over separately licensed MIT sources.
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "independent"))
from public_reader_loader import load_public_reader
from public_reader_adapter import fetch, FetchResult, validate
_native = load_public_reader()
Attempt, Verdict, ValidationResult = _native.Attempt, _native.Verdict, _native.ValidationResult
CHALLENGE_MARKERS = _native.CHALLENGE_MARKERS
detect, TRANSFORMS, apply_transform = _native.detect, _native.TRANSFORMS, _native.apply_transform
__all__ = ["fetch", "FetchResult", "Attempt", "Verdict", "ValidationResult", "validate", "CHALLENGE_MARKERS", "detect", "TRANSFORMS", "apply_transform"]
