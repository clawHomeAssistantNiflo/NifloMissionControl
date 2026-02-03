#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path


@dataclass
class Automation:
    id: str
    name: str
    status: str
    rrule: str | None
    updated_at: int | None


DAY_MAP = {
    "MO": 0,
    "TU": 1,
    "WE": 2,
    "TH": 3,
    "FR": 4,
    "SA": 5,
    "SU": 6,
}


def parse_simple_toml(path: Path) -> dict[str, object]:
    data: dict[str, object] = {}
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        match = re.match(r"([A-Za-z0-9_\-]+)\s*=\s*(.+)", line)
        if not match:
            continue
        key, value = match.group(1), match.group(2).strip()
        if value.startswith("\"") and value.endswith("\""):
            data[key] = value.strip("\"")
        elif value.startswith("[") and value.endswith("]"):
            items = re.findall(r"\"(.*?)\"", value)
            data[key] = items
        elif value.isdigit():
            data[key] = int(value)
        else:
            data[key] = value
    return data


def parse_rrule(rule: str) -> dict[str, str]:
    parts = rule.split(";") if rule else []
    parsed: dict[str, str] = {}
    for part in parts:
        if "=" in part:
            key, value = part.split("=", 1)
            parsed[key.strip().upper()] = value.strip()
    return parsed


def next_run_from_rrule(rule: str, now: datetime) -> datetime | None:
    if not rule:
        return None
    parsed = parse_rrule(rule)
    freq = parsed.get("FREQ", "").upper()

    if freq == "HOURLY":
        interval = int(parsed.get("INTERVAL", "1"))
        candidate = now.replace(minute=0, second=0, microsecond=0)
        if now.minute > 0 or now.second > 0 or now.microsecond > 0:
            candidate += timedelta(hours=1)
        hours_since = int((candidate - candidate.replace(hour=0)).total_seconds() // 3600)
        if hours_since % interval != 0:
            candidate += timedelta(hours=(interval - (hours_since % interval)))
        return candidate

    if freq == "WEEKLY":
        byday = parsed.get("BYDAY")
        byhour = int(parsed.get("BYHOUR", "9"))
        byminute = int(parsed.get("BYMINUTE", "0"))
        if byday:
            days = [DAY_MAP[d] for d in byday.split(",") if d in DAY_MAP]
        else:
            days = [now.weekday()]
        candidate = now.replace(hour=byhour, minute=byminute, second=0, microsecond=0)
        if candidate <= now:
            candidate += timedelta(days=1)
        for _ in range(8):
            if candidate.weekday() in days:
                return candidate
            candidate += timedelta(days=1)
        return candidate

    return None


def read_automations(root: Path) -> list[Automation]:
    automations = []
    if not root.exists():
        return automations
    for folder in sorted(root.iterdir()):
        toml_path = folder / "automation.toml"
        if not toml_path.exists():
            continue
        data = parse_simple_toml(toml_path)
        automations.append(
            Automation(
                id=str(data.get("id", folder.name)),
                name=str(data.get("name", folder.name)),
                status=str(data.get("status", "ACTIVE")),
                rrule=str(data.get("rrule", "")) or None,
                updated_at=int(data.get("updated_at", 0)) if str(data.get("updated_at", "")).isdigit() else None,
            )
        )
    return automations


def build_queue(automations: list[Automation]) -> list[dict[str, str]]:
    now = datetime.now()
    queue = []
    for item in automations:
        next_run = next_run_from_rrule(item.rrule or "", now)
        status = "ready" if item.status.upper() == "ACTIVE" else "blocked"
        queue.append(
            {
                "name": item.name,
                "status": status,
                "rrule": item.rrule or "",
                "next_run": next_run.strftime("%Y-%m-%d %H:%M") if next_run else "",
                "last_run": "",
                "notes": item.id,
            }
        )
    queue.sort(key=lambda x: (x["next_run"] or "9999"))
    for idx, item in enumerate(queue, start=1):
        item["order"] = idx
    return queue


def read_tasks(path: Path) -> list[dict[str, object]]:
    if not path.exists():
        return []
    return json.loads(path.read_text()).get("columns", [])


def main() -> None:
    codex_home = Path(os.environ.get("CODEX_HOME", Path.home() / ".codex"))
    automations_root = codex_home / "automations"
    tasks_path = Path(__file__).with_name("tasks.json")
    output_path = Path(__file__).with_name("data.json")

    automations = read_automations(automations_root)
    queue = build_queue(automations)
    columns = read_tasks(tasks_path)

    payload = {
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "queue": queue,
        "columns": columns,
    }
    output_path.write_text(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
