"""todo2code Python SDK.

A dependency-free client for the todo2code A2A v1.0 endpoint. Uses only the
standard library, matching the project rule that Python carries no external
dependencies.
"""

from .client import (
    A2A_VERSION,
    Diagnostic,
    DiagnosticReport,
    IntentGraph,
    IntentRecord,
    T2CClient,
    T2CError,
)

__all__ = [
    "A2A_VERSION",
    "Diagnostic",
    "DiagnosticReport",
    "IntentGraph",
    "IntentRecord",
    "T2CClient",
    "T2CError",
]
__version__ = "0.2.0"
