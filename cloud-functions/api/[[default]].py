"""EdgeOne Makers Python Cloud Function entrypoint.

EdgeOne removes the outer ``/api`` filesystem prefix before forwarding a
request to FastAPI.  The existing application intentionally keeps its public
routes under ``/api``, so this adapter restores that prefix and leaves the
application and frontend API contract unchanged.

Cloud Function source files may be read-only at runtime.  The application
currently uses SQLite and JSON files for its demo state, therefore the bundled
backend is copied to ``/tmp`` before it is imported.  This makes the current
competition demo deployable, but the data is ephemeral and should later be
moved to managed storage.
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

from fastapi import FastAPI


_BUNDLED_BACKEND = Path(__file__).resolve().parents[1] / "backend"
_RUNTIME_BACKEND = Path("/tmp/pixiu-agent-web")

shutil.copytree(_BUNDLED_BACKEND, _RUNTIME_BACKEND, dirs_exist_ok=True)

runtime_path = str(_RUNTIME_BACKEND)
if runtime_path not in sys.path:
    sys.path.insert(0, runtime_path)

from pixiu_app import app as _pixiu_app  # noqa: E402


class RestoreApiPrefix:
    def __init__(self, application):
        self.application = application

    async def __call__(self, scope, receive, send):
        if scope["type"] in {"http", "websocket"}:
            scope = dict(scope)
            path = scope.get("path", "/")
            raw_path = scope.get("raw_path", path.encode("utf-8"))
            if not path.startswith("/api/") and path != "/api":
                scope["path"] = f"/api{path if path.startswith('/') else '/' + path}"
                scope["raw_path"] = b"/api" + (
                    raw_path if raw_path.startswith(b"/") else b"/" + raw_path
                )
        await self.application(scope, receive, send)


app = FastAPI(title="貔貅学长 EdgeOne API")
app.add_middleware(RestoreApiPrefix)
app.mount("/", _pixiu_app)
