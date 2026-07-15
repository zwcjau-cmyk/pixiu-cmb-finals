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
from fastapi.middleware.cors import CORSMiddleware

_API_DIR = Path(__file__).resolve().parent
if str(_API_DIR) not in sys.path:
    sys.path.insert(0, str(_API_DIR))

from embedded_resources import SCRIPT_JSON_FILES, SOUL_MARKDOWN


_BUNDLED_BACKEND = Path(__file__).resolve().parents[1] / "backend"
_RUNTIME_BACKEND = Path("/tmp/pixiu-agent-web-v2")

shutil.copytree(_BUNDLED_BACKEND, _RUNTIME_BACKEND, dirs_exist_ok=True)
(_RUNTIME_BACKEND / "soul.md").write_text(SOUL_MARKDOWN, encoding="utf-8")
story_scripts = _RUNTIME_BACKEND / "story_scripts"
story_scripts.mkdir(parents=True, exist_ok=True)
for filename, contents in SCRIPT_JSON_FILES.items():
    (story_scripts / filename).write_text(contents, encoding="utf-8")

runtime_path = str(_RUNTIME_BACKEND)
if runtime_path not in sys.path:
    sys.path.insert(0, runtime_path)

from pixiu_app import backend_app as _pixiu_app  # noqa: E402


app = FastAPI(title="貔貅学长 EdgeOne API")
app.router.routes.extend(_pixiu_app.router.routes)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://pixiu-cmb-finals2.pages.dev",
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
