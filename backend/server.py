"""Entry point: starts the autoCV API server."""

from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.api import router, _get_knowledge

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Loading knowledge base...")
    kb = _get_knowledge()
    print(f"Knowledge base loaded ({len(kb)} chars).")
    print("autoCV ready — http://localhost:8000")
    yield


app = FastAPI(title="autoCV API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes first
app.include_router(router)

# Serve React build
if STATIC_DIR.exists():
    # Mount /assets as a static file directory
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="static-assets")

    # Serve individual static files at root (favicon, etc.)
    @app.get("/favicon.svg", include_in_schema=False)
    async def favicon():
        return FileResponse(str(STATIC_DIR / "favicon.svg"))

    @app.get("/icons.svg", include_in_schema=False)
    async def icons():
        return FileResponse(str(STATIC_DIR / "icons.svg"))

    # SPA fallback: any non-API, non-asset path serves index.html
    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        return FileResponse(str(STATIC_DIR / "index.html"))


if __name__ == "__main__":
    uvicorn.run("backend.server:app", host="0.0.0.0", port=8000, reload=True)
