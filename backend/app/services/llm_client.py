"""Unified multi-provider LLM client.

Supports: Anthropic (Claude), OpenAI (GPT), DeepSeek, Google Gemini,
and any OpenAI-compatible endpoint (Ollama, Together, Groq, etc.).

Resolution order for each call:
  1. org.settings["llm"] in the database (per-org UI-configured keys)
  2. Environment variable fallbacks from app.config
  3. KeyError / explicit error if nothing is configured
"""
from __future__ import annotations

import json
import logging
from typing import Optional

import httpx

logger = logging.getLogger("mighty.llm")

# Provider registry — metadata only, no keys here
PROVIDERS: dict[str, dict] = {
    "anthropic": {
        "label": "Anthropic (Claude)",
        "default_model": "claude-sonnet-4-6",
        "docs_url": "https://docs.anthropic.com/",
    },
    "openai": {
        "label": "OpenAI (GPT)",
        "default_model": "gpt-4o-mini",
        "base_url": "https://api.openai.com/v1",
        "docs_url": "https://platform.openai.com/docs/",
    },
    "deepseek": {
        "label": "DeepSeek",
        "default_model": "deepseek-chat",
        "base_url": "https://api.deepseek.com/v1",
        "docs_url": "https://platform.deepseek.com/",
    },
    "google": {
        "label": "Google (Gemini)",
        "default_model": "gemini-1.5-flash",
        "docs_url": "https://ai.google.dev/",
    },
    "custom": {
        "label": "Custom (OpenAI-compatible)",
        "default_model": "",
        "base_url": "",
        "docs_url": "",
    },
}


def _mask_key(key: str) -> str:
    """Return a display-safe masked version of an API key."""
    if not key:
        return ""
    if len(key) <= 8:
        return "••••••••"
    return key[:6] + "••••••••" + key[-4:]


# ── Provider API calls ────────────────────────────────────────────────────────

def _call_anthropic(prompt: str, api_key: str, model: str) -> str:
    resp = httpx.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={"model": model, "max_tokens": 4096, "messages": [{"role": "user", "content": prompt}]},
        timeout=45.0,
    )
    resp.raise_for_status()
    return resp.json()["content"][0]["text"]


def _call_openai_compat(prompt: str, api_key: str, model: str, base_url: str) -> str:
    """Works for OpenAI, DeepSeek, Groq, Together, Ollama, and any OpenAI-compatible endpoint."""
    base_url = base_url.rstrip("/")
    resp = httpx.post(
        f"{base_url}/chat/completions",
        headers={"Authorization": f"Bearer {api_key}", "content-type": "application/json"},
        json={"model": model, "messages": [{"role": "user", "content": prompt}], "max_tokens": 4096},
        timeout=45.0,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]


def _call_google(prompt: str, api_key: str, model: str) -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    resp = httpx.post(
        url,
        params={"key": api_key},
        headers={"content-type": "application/json"},
        json={"contents": [{"parts": [{"text": prompt}]}]},
        timeout=45.0,
    )
    resp.raise_for_status()
    return resp.json()["candidates"][0]["content"]["parts"][0]["text"]


# ── Config resolution ─────────────────────────────────────────────────────────

def _get_llm_config(org_settings: dict | None) -> dict:
    """Merge org DB settings with env-var fallbacks.

    Returns:
        {"active_provider": str, "providers": {name: {"api_key": str, "model": str, ...}}}
    """
    from app.config import settings as cfg

    # Build env-var fallbacks
    env_providers: dict[str, dict] = {}
    if cfg.anthropic_api_key:
        env_providers["anthropic"] = {"api_key": cfg.anthropic_api_key, "model": cfg.ai_model}
    if cfg.openai_api_key:
        env_providers["openai"] = {
            "api_key": cfg.openai_api_key,
            "model": cfg.openai_model,
            "base_url": cfg.openai_base_url,
        }
    if cfg.deepseek_api_key:
        env_providers["deepseek"] = {
            "api_key": cfg.deepseek_api_key,
            "model": cfg.deepseek_model,
            "base_url": "https://api.deepseek.com/v1",
        }
    if cfg.google_api_key:
        env_providers["google"] = {"api_key": cfg.google_api_key, "model": cfg.google_model}

    # Org DB config overrides env vars
    db_llm = (org_settings or {}).get("llm", {})
    db_providers = db_llm.get("providers", {})

    merged_providers: dict[str, dict] = {**env_providers}
    for pname, pconf in db_providers.items():
        if pconf.get("api_key"):
            merged_providers[pname] = {**merged_providers.get(pname, {}), **pconf}

    # Determine active provider
    active = db_llm.get("active_provider") or cfg.ai_provider
    if not active or active not in merged_providers:
        # Auto-pick first configured provider in preference order
        for p in ("anthropic", "openai", "deepseek", "google", "custom"):
            if p in merged_providers:
                active = p
                break

    return {"active_provider": active, "providers": merged_providers}


# ── Public API ────────────────────────────────────────────────────────────────

def complete(prompt: str, org_settings: dict | None = None) -> str:
    """Call the active LLM provider and return its text response.

    Args:
        prompt: The user message / instruction to send.
        org_settings: The org's `settings` JSON column (or None to use env vars only).

    Raises:
        RuntimeError: No provider is configured.
        httpx.HTTPError: Provider API call failed.
    """
    cfg = _get_llm_config(org_settings)
    provider = cfg["active_provider"]
    providers = cfg["providers"]

    if not provider or provider not in providers:
        configured = list(providers.keys())
        raise RuntimeError(
            f"No LLM provider configured. Set an API key in Settings → AI or via "
            f"ANTHROPIC_API_KEY / OPENAI_API_KEY / DEEPSEEK_API_KEY / GOOGLE_API_KEY env vars. "
            f"Configured: {configured or 'none'}"
        )

    pconf = providers[provider]
    api_key = pconf.get("api_key", "")
    model = pconf.get("model", "") or PROVIDERS.get(provider, {}).get("default_model", "")

    logger.debug("LLM call: provider=%s model=%s", provider, model)

    if provider == "anthropic":
        return _call_anthropic(prompt, api_key, model)
    elif provider == "google":
        return _call_google(prompt, api_key, model)
    elif provider in ("openai", "deepseek", "custom"):
        base_url = pconf.get("base_url") or PROVIDERS.get(provider, {}).get("base_url", "")
        if not base_url:
            raise RuntimeError(f"Provider '{provider}' requires a base_url")
        return _call_openai_compat(prompt, api_key, model, base_url)
    else:
        raise RuntimeError(f"Unknown provider: {provider}")


def get_provider_status(org_settings: dict | None = None) -> dict:
    """Return which providers are configured and which is active (for the UI)."""
    from app.config import settings as cfg
    cfg_data = _get_llm_config(org_settings)
    return {
        "active_provider": cfg_data["active_provider"],
        "providers": {
            name: {
                "label": PROVIDERS.get(name, {}).get("label", name),
                "default_model": PROVIDERS.get(name, {}).get("default_model", ""),
                "configured": bool(pconf.get("api_key")),
                "api_key_masked": _mask_key(pconf.get("api_key", "")),
                "model": pconf.get("model", "") or PROVIDERS.get(name, {}).get("default_model", ""),
                "base_url": pconf.get("base_url", "") or PROVIDERS.get(name, {}).get("base_url", ""),
            }
            for name, pconf in cfg_data["providers"].items()
        },
        "available_providers": [
            {
                "id": pid,
                "label": pmeta["label"],
                "default_model": pmeta.get("default_model", ""),
                "base_url": pmeta.get("base_url", ""),
            }
            for pid, pmeta in PROVIDERS.items()
        ],
    }
