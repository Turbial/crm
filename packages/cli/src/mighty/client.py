"""HTTP client for the MightyOps API."""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import httpx

CONFIG_PATH = Path.home() / ".config" / "mighty" / "credentials.json"


def _load_creds() -> dict:
    if CONFIG_PATH.exists():
        return json.loads(CONFIG_PATH.read_text())
    return {}


def _save_creds(data: dict) -> None:
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(data, indent=2))


class MightyClient:
    def __init__(self, base_url: str | None = None, token: str | None = None):
        creds = _load_creds()
        self.base_url = (base_url or os.environ.get("MIGHTY_API_URL") or creds.get("api_url") or "http://localhost:8000").rstrip("/")
        self.token = token or os.environ.get("MIGHTY_TOKEN") or creds.get("access_token") or ""

    @property
    def _headers(self) -> dict:
        h = {"Content-Type": "application/json"}
        if self.token:
            h["Authorization"] = f"Bearer {self.token}"
        return h

    def get(self, path: str, **params: Any) -> Any:
        r = httpx.get(f"{self.base_url}{path}", headers=self._headers, params=params, timeout=30)
        r.raise_for_status()
        return r.json()

    def post(self, path: str, body: dict | None = None, **params: Any) -> Any:
        r = httpx.post(f"{self.base_url}{path}", headers=self._headers, json=body, params=params, timeout=30)
        r.raise_for_status()
        return r.json()

    def patch(self, path: str, body: dict) -> Any:
        r = httpx.patch(f"{self.base_url}{path}", headers=self._headers, json=body, timeout=30)
        r.raise_for_status()
        return r.json()

    def login(self, email: str, password: str) -> dict:
        r = httpx.post(
            f"{self.base_url}/auth/login",
            data={"username": email, "password": password},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=15,
        )
        r.raise_for_status()
        data = r.json()
        creds = _load_creds()
        creds["api_url"] = self.base_url
        creds["access_token"] = data["access_token"]
        creds["refresh_token"] = data.get("refresh_token", "")
        _save_creds(creds)
        self.token = data["access_token"]
        return data


client = MightyClient()
