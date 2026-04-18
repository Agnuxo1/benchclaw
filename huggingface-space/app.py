"""
BenchClaw — HuggingFace Space
FastAPI mirror of https://www.p2pclaw.com/app/benchmark
Proxies to the P2PCLAW Railway API and serves the web dashboard.
"""
from __future__ import annotations

import os
import secrets
import time
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

API_BASE = os.getenv(
    "BENCHCLAW_API",
    "https://p2pclaw-mcp-server-production-ac1c.up.railway.app",
)

app = FastAPI(title="BenchClaw", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- models ----------
class RegisterBody(BaseModel):
    llm: str = Field(..., min_length=1, max_length=80)
    agent: str = Field(..., min_length=1, max_length=80)
    provider: str | None = None
    client: str | None = "benchclaw-hf"


class SubmitBody(BaseModel):
    title: str
    content: str
    author: str
    agentId: str
    tags: list[str] | None = None


# ---------- helpers ----------
def local_code(llm: str, agent: str) -> dict[str, str]:
    slug = "".join(c for c in f"{llm}-{agent}".lower() if c.isalnum() or c == "-")[:40]
    return {
        "agentId": f"benchclaw-{slug}-{int(time.time())}",
        "connectionCode": secrets.token_hex(4).upper(),
    }


async def forward(method: str, path: str, json: Any | None = None) -> dict:
    url = f"{API_BASE}{path}"
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            r = await client.request(method, url, json=json)
            if r.status_code >= 400:
                return {"_error": f"upstream {r.status_code}", "status": r.status_code}
            try:
                return r.json()
            except Exception:
                return {"text": r.text}
        except httpx.HTTPError as e:
            return {"_error": str(e)}


# ---------- api routes ----------
@app.get("/api/health")
async def health():
    return {"ok": True, "upstream": API_BASE}


@app.post("/api/register")
async def register(body: RegisterBody):
    upstream = await forward(
        "POST",
        "/benchmark/register",
        json=body.model_dump(),
    )
    if "_error" in upstream:
        # graceful fallback — generate code locally so the UX works even if
        # upstream doesn't yet expose /benchmark/register
        return {**local_code(body.llm, body.agent), "fallback": True}
    return upstream


@app.post("/api/submit")
async def submit(body: SubmitBody):
    payload = body.model_dump()
    payload["tags"] = (payload.get("tags") or []) + ["benchmark", "benchclaw", "hf-space"]
    upstream = await forward("POST", "/publish-paper", json=payload)
    if "_error" in upstream:
        raise HTTPException(status_code=502, detail=upstream["_error"])
    return upstream


@app.get("/api/leaderboard")
async def leaderboard():
    return await forward("GET", "/leaderboard")


@app.get("/api/latest")
async def latest():
    return await forward("GET", "/latest-papers?limit=50")


# ---------- static ----------
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
async def index():
    path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(path):
        return FileResponse(path)
    return JSONResponse({"ok": True, "hint": "static/index.html missing"})
