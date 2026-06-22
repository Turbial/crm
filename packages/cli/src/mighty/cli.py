"""MightyOps CLI — mighty <command> [options]"""
from __future__ import annotations

import json
import sys
from typing import Any

import click
from rich.console import Console
from rich.table import Table

from mighty.client import MightyClient, _load_creds, _save_creds

console = Console()


def _client() -> MightyClient:
    return MightyClient()


def _print_table(rows: list[dict], columns: list[str]) -> None:
    table = Table(show_header=True, header_style="bold cyan")
    for col in columns:
        table.add_column(col)
    for row in rows:
        table.add_row(*[str(row.get(c, "")) for c in columns])
    console.print(table)


@click.group()
@click.version_option(version="1.0.0", prog_name="mighty")
def cli():
    """MightyOps command-line interface."""
    pass


# ── Auth ──────────────────────────────────────────────────────────────────────

@cli.command()
@click.option("--url", default="http://localhost:8000", show_default=True, help="API base URL")
@click.option("--email", prompt=True)
@click.option("--password", prompt=True, hide_input=True)
def login(url: str, email: str, password: str):
    """Authenticate and save credentials."""
    c = MightyClient(base_url=url)
    try:
        data = c.login(email, password)
        console.print(f"[green]Logged in as {email}[/green]")
    except Exception as exc:
        console.print(f"[red]Login failed: {exc}[/red]")
        sys.exit(1)


@cli.command()
def logout():
    """Clear saved credentials."""
    from pathlib import Path
    from mighty.client import CONFIG_PATH
    if CONFIG_PATH.exists():
        CONFIG_PATH.unlink()
    console.print("[yellow]Logged out.[/yellow]")


# ── Leads ─────────────────────────────────────────────────────────────────────

@cli.group()
def leads():
    """Manage leads."""
    pass


@leads.command("list")
@click.option("--status", default=None)
@click.option("--limit", default=20, show_default=True)
def leads_list(status: str | None, limit: int):
    """List leads."""
    params: dict = {"limit": limit}
    if status:
        params["status"] = status
    data = _client().get("/leads", **params)
    rows = data if isinstance(data, list) else data.get("items", data)
    _print_table(rows, ["id", "name", "email", "status", "score"])


@leads.command("create")
@click.option("--name", prompt=True)
@click.option("--email", default=None)
@click.option("--phone", default=None)
@click.option("--source", default="cli")
def leads_create(name: str, email: str | None, phone: str | None, source: str):
    """Create a new lead."""
    body: dict = {"name": name, "source": source}
    if email:
        body["email"] = email
    if phone:
        body["phone"] = phone
    result = _client().post("/leads", body)
    console.print(f"[green]Created lead {result['id']}[/green]")
    console.print_json(json.dumps(result))


@leads.command("show")
@click.argument("lead_id")
def leads_show(lead_id: str):
    """Show a lead by ID."""
    result = _client().get(f"/leads/{lead_id}")
    console.print_json(json.dumps(result, default=str))


# ── Brief ─────────────────────────────────────────────────────────────────────

@cli.group()
def brief():
    """Daily brief commands."""
    pass


@brief.command("generate")
def brief_generate():
    """Generate today's daily brief."""
    result = _client().post("/daily-brief/generate")
    console.print("[green]Brief generated.[/green]")
    console.print(result.get("summary_text", ""))


@brief.command("show")
def brief_show():
    """Show the latest daily brief."""
    result = _client().get("/daily-brief/latest")
    console.print(result.get("summary_text", "No brief found."))


# ── Actions ───────────────────────────────────────────────────────────────────

@cli.group()
def actions():
    """Manage action runs."""
    pass


@actions.command("list")
@click.option("--status", default=None)
@click.option("--limit", default=20, show_default=True)
def actions_list(status: str | None, limit: int):
    """List recent action runs."""
    params: dict = {"limit": limit}
    if status:
        params["status"] = status
    data = _client().get("/action-runs", **params)
    rows = data if isinstance(data, list) else data.get("items", data)
    _print_table(rows, ["id", "action_name", "status", "created_at"])


@actions.command("run")
@click.argument("action_name")
@click.option("--input", "input_json", default="{}", help="JSON input payload")
@click.option("--lead-id", default=None)
def actions_run(action_name: str, input_json: str, lead_id: str | None):
    """Trigger an action by name."""
    try:
        payload = json.loads(input_json)
    except json.JSONDecodeError as e:
        console.print(f"[red]Invalid JSON: {e}[/red]")
        sys.exit(1)
    body: dict = {"action_name": action_name, "input": payload}
    if lead_id:
        body["lead_id"] = lead_id
    result = _client().post("/action-runs", body)
    console.print(f"[green]Action run created: {result['id']}[/green]")
    console.print_json(json.dumps(result, default=str))


# ── Supervisor ────────────────────────────────────────────────────────────────

@cli.command()
def supervisor():
    """Run a supervisor scan."""
    result = _client().post("/supervisor/scan")
    issues = result.get("issues", [])
    if not issues:
        console.print("[green]No issues detected.[/green]")
    else:
        console.print(f"[yellow]{len(issues)} issue(s) found:[/yellow]")
        for issue in issues:
            console.print(f"  • [{issue.get('severity', 'info')}] {issue.get('message', issue)}")


# ── Duplicates ────────────────────────────────────────────────────────────────

@cli.group()
def duplicates():
    """Manage duplicate candidates."""
    pass


@duplicates.command("list")
@click.option("--type", "entity_type", default=None)
def duplicates_list(entity_type: str | None):
    """List pending duplicate candidates."""
    params: dict = {"status": "pending"}
    if entity_type:
        params["entity_type"] = entity_type
    data = _client().get("/duplicates", **params)
    rows = data if isinstance(data, list) else []
    _print_table(rows, ["id", "entity_type", "entity_id_a", "entity_id_b", "score"])


# ── Chat (one-shot agent) ─────────────────────────────────────────────────────

@cli.command()
@click.argument("message")
@click.option("--lead-id", default=None)
def chat(message: str, lead_id: str | None):
    """Send a message to the AI assistant."""
    body: dict = {"message": message}
    if lead_id:
        body["lead_id"] = lead_id
    try:
        result = _client().post("/messenger-ai/chat", body)
        console.print(result.get("reply") or result.get("response") or json.dumps(result))
    except Exception as exc:
        console.print(f"[red]Error: {exc}[/red]")
        sys.exit(1)


if __name__ == "__main__":
    cli()
