"""
ADMIN ONLY — SMTP for scheduled job alerts. See ARCHITECTURE.md.

Secrets live in .env; recipient prefs in data/email_settings.json.
"""
from __future__ import annotations

import hashlib
import json
import os
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import Any, Callable

import agent.env  # noqa: F401

from agent.data_paths import user_data_dir

DATA_DIR = user_data_dir()
EMAIL_SETTINGS_PATH = DATA_DIR / "email_settings.json"

DEFAULT_SETTINGS: dict[str, Any] = {
    "enabled": False,
    "to": "",
    "notify_major_only": True,
    "from_name": "Nakshatra Chakram",
    "last_sent_digest": "",
}


def _smtp_config() -> dict[str, Any]:
    host = os.environ.get("SMTP_HOST", "").strip()
    port = int(os.environ.get("SMTP_PORT", "587") or "587")
    user = os.environ.get("SMTP_USER", "").strip()
    password = os.environ.get("SMTP_PASSWORD", "").strip()
    from_addr = os.environ.get("SMTP_FROM", user).strip() or user
    use_tls = os.environ.get("SMTP_USE_TLS", "1").strip().lower() not in ("0", "false", "no")
    return {
        "host": host,
        "port": port,
        "user": user,
        "password": password,
        "from_addr": from_addr,
        "use_tls": use_tls,
    }


def get_email_settings() -> dict[str, Any]:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not EMAIL_SETTINGS_PATH.exists():
        return dict(DEFAULT_SETTINGS)
    try:
        data = json.loads(EMAIL_SETTINGS_PATH.read_text(encoding="utf-8"))
        out = dict(DEFAULT_SETTINGS)
        out.update(data)
        return out
    except (json.JSONDecodeError, OSError):
        return dict(DEFAULT_SETTINGS)


def save_email_settings(settings: dict[str, Any]) -> dict[str, Any]:
    current = get_email_settings()
    for key in ("enabled", "to", "notify_major_only", "from_name"):
        if key in settings:
            current[key] = settings[key]
    if isinstance(current.get("to"), str):
        current["to"] = current["to"].strip()
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    EMAIL_SETTINGS_PATH.write_text(json.dumps(current, indent=2), encoding="utf-8")
    return get_email_settings_public()


def get_email_settings_public() -> dict[str, Any]:
    """Settings safe for API/UI (no secrets)."""
    ui = get_email_settings()
    smtp = _smtp_config()
    configured = bool(smtp["host"] and smtp["user"] and smtp["password"] and ui.get("to"))
    return {
        "enabled": bool(ui.get("enabled")),
        "to": ui.get("to") or "",
        "notify_major_only": bool(ui.get("notify_major_only", True)),
        "from_name": ui.get("from_name") or DEFAULT_SETTINGS["from_name"],
        "smtp_configured": bool(smtp["host"] and smtp["user"] and smtp["password"]),
        "smtp_host": smtp["host"] or None,
        "smtp_user": smtp["user"] or None,
        "smtp_from": smtp["from_addr"] or None,
        "smtp_port": smtp["port"],
        "smtp_use_tls": smtp["use_tls"],
        "ready": configured and ui.get("enabled"),
    }


def _digest_alerts(alerts: list[dict]) -> str:
    parts = []
    for a in alerts:
        parts.append(
            f"{a.get('type','')}|{a.get('planet','')}|{a.get('sign','')}|"
            f"{a.get('house_from','')}|{a.get('severity','')}|{a.get('phase','')}"
        )
    raw = "\n".join(sorted(parts))
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def should_send_alert_email(alerts: list[dict]) -> tuple[bool, list[dict], str]:
    """Return (should_send, alerts_to_include, reason)."""
    ui = get_email_settings()
    if not ui.get("enabled"):
        return False, [], "email disabled in settings"
    pub = get_email_settings_public()
    if not pub["smtp_configured"]:
        return False, [], "SMTP not configured in .env"
    if not ui.get("to"):
        return False, [], "no recipient address"

    if ui.get("notify_major_only", True):
        chosen = [a for a in alerts if a.get("severity") in ("critical", "major")]
        if not chosen:
            return False, [], "no critical/major alerts"
    else:
        chosen = list(alerts)
        if not chosen:
            return False, [], "no alerts"

    digest = _digest_alerts(chosen)
    if digest == ui.get("last_sent_digest"):
        return False, chosen, "same digest as last email (deduped)"

    return True, chosen, "ok"


def mark_alert_email_sent(alerts: list[dict]) -> None:
    ui = get_email_settings()
    ui["last_sent_digest"] = _digest_alerts(alerts)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    EMAIL_SETTINGS_PATH.write_text(json.dumps(ui, indent=2), encoding="utf-8")


def format_alerts_email(
    alerts: list[dict],
    *,
    profile: dict | None,
    subject_prefix: str = "Transit alert",
) -> tuple[str, str, str]:
    lines = []
    for a in alerts:
        lines.append(
            f"• {a.get('type', 'Alert')} — {a.get('planet', '')} in {a.get('sign', '')} "
            f"({a.get('house_from', '')}) [{a.get('severity', '')}]"
        )
        body = a.get("body") or ""
        if body:
            lines.append(f"  {body[:280]}{'…' if len(body) > 280 else ''}")

    prof = ""
    if profile:
        prof = f"\nChart: {profile.get('date', '')} {profile.get('time', '')} @ {profile.get('place', '')}\n"

    text = f"Nakshatra Chakram — Gochara notification\n{prof}\n" + "\n".join(lines)
    html_lines = "".join(
        f"<li><strong>{a.get('type', 'Alert')}</strong> — {a.get('planet', '')} "
        f"{a.get('sign', '')} ({a.get('house_from', '')}) "
        f"<em>[{a.get('severity', '')}]</em><br><span style='color:#555'>"
        f"{(a.get('body') or '')[:400]}</span></li>"
        for a in alerts
    )
    html = f"""
    <html><body style="font-family:sans-serif;color:#111">
    <h2 style="color:#4f46e5">{subject_prefix}</h2>
    {f'<p>{prof.replace(chr(10), "<br>")}</p>' if prof else ''}
    <ul>{html_lines}</ul>
    <p style="font-size:12px;color:#888">Sent by Nakshatra Chakram jobs.</p>
    </body></html>
    """
    subject = f"{subject_prefix}: {alerts[0].get('type', 'update')} ({len(alerts)} alert{'s' if len(alerts) != 1 else ''})"
    return subject, text, html


def send_email(
    to: str,
    subject: str,
    body_text: str,
    body_html: str | None = None,
) -> None:
    smtp = _smtp_config()
    if not smtp["host"] or not smtp["user"] or not smtp["password"]:
        raise RuntimeError("SMTP not configured: set SMTP_HOST, SMTP_USER, SMTP_PASSWORD in .env")

    ui = get_email_settings()
    from_name = ui.get("from_name") or "Nakshatra Chakram"
    from_addr = smtp["from_addr"]
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{from_name} <{from_addr}>"
    msg["To"] = to
    msg.attach(MIMEText(body_text, "plain", "utf-8"))
    if body_html:
        msg.attach(MIMEText(body_html, "html", "utf-8"))

    if smtp["use_tls"]:
        with smtplib.SMTP(smtp["host"], smtp["port"], timeout=30) as server:
            server.ehlo()
            server.starttls(context=ssl.create_default_context())
            server.ehlo()
            server.login(smtp["user"], smtp["password"])
            server.sendmail(from_addr, [to], msg.as_string())
    else:
        with smtplib.SMTP_SSL(smtp["host"], smtp["port"], timeout=30) as server:
            server.login(smtp["user"], smtp["password"])
            server.sendmail(from_addr, [to], msg.as_string())


def send_test_email() -> str:
    pub = get_email_settings_public()
    if not pub["smtp_configured"]:
        raise RuntimeError("SMTP not configured in .env (SMTP_HOST, SMTP_USER, SMTP_PASSWORD)")
    to = pub["to"]
    if not to:
        raise RuntimeError("Set a recipient email on the Jobs tab")

    subject = "Nakshatra Chakram — test email"
    text = "This is a test message from your Nakshatra Chakram job runner. SMTP is working."
    html = "<p>This is a <strong>test</strong> from Nakshatra Chakram.</p>"
    send_email(to, subject, text, html)
    return f"Test email sent to {to}"


def maybe_send_gochara_email(
    alerts: list[dict],
    profile: dict | None,
    trace_log: Callable[[str, str], None] | None = None,
) -> str | None:
    """Send email if settings allow; return status message or None if skipped."""

    def log(msg: str, level: str = "info") -> None:
        if trace_log:
            trace_log(msg, level)

    should, chosen, reason = should_send_alert_email(alerts)
    if not should:
        log(f"Email skipped: {reason}", "debug")
        return None

    ui = get_email_settings()
    to = ui["to"]
    subject, text, html = format_alerts_email(
        chosen, profile=profile, subject_prefix="Gochara transit alert"
    )
    try:
        send_email(to, subject, text, html)
        mark_alert_email_sent(chosen)
        log(f"Email sent to {to} ({len(chosen)} alert(s))", "info")
        return f"Emailed {to}"
    except Exception as exc:
        log(f"Email failed: {exc}", "error")
        raise
