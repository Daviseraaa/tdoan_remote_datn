#!/usr/bin/env python3
"""StationHub browser runner — CloakBrowser hoặc Chrome hệ thống + profile thật."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

# Giữ Playwright sống khi cần humanize + keepOpen (fallback)
_HELD_CONTEXT: Any = None
_HELD_PW: Any = None

_WIN_BREAKAWAY = 0x0100_0000
_WIN_NO_WINDOW = 0x0800_0000


def _ensure_cloak_import() -> None:
    try:
        import cloakbrowser  # noqa: F401
        return
    except ImportError:
        pass
    repo = Path(__file__).resolve().parent.parent / "CloakBrowser"
    if repo.is_dir():
        sys.path.insert(0, str(repo))
    try:
        import cloakbrowser  # noqa: F401
    except ImportError as e:
        raise SystemExit(
            "Thiếu cloakbrowser. Chạy: pip install -e agent/CloakBrowser"
        ) from e


def _apply_cache_dir() -> None:
    cache = os.environ.get("CLOAKBROWSER_CACHE_DIR", "").strip()
    if cache:
        return
    pd = os.environ.get("ProgramData", r"C:\ProgramData")
    default = Path(pd) / "StationHub" / "cloak-cache"
    default.mkdir(parents=True, exist_ok=True)
    os.environ["CLOAKBROWSER_CACHE_DIR"] = str(default)


def _profile_dir(req: dict[str, Any]) -> str:
    user_data_dir = req.get("userDataDir")
    if user_data_dir and str(user_data_dir).strip():
        return str(user_data_dir).strip()
    pd = os.environ.get("ProgramData", r"C:\ProgramData")
    return str(Path(pd) / "StationHub" / "browser-profiles" / "default")


def _windows_detached_flags() -> int:
    if sys.platform != "win32":
        return 0
    return (
        subprocess.CREATE_NEW_PROCESS_GROUP
        | subprocess.DETACHED_PROCESS
        | _WIN_BREAKAWAY
        | _WIN_NO_WINDOW
    )


def _spawn_detached_chromium(
    url: str, profile_dir: str, headless: bool
) -> dict[str, Any]:
    """Mở Chromium stealth tách khỏi Python — browser sống khi runner thoát."""
    from cloakbrowser.browser import (
        build_args,
        maybe_resolve_geoip,
        _resolve_proxy_config,
        _resolve_webrtc_args,
    )
    from cloakbrowser.config import IGNORE_DEFAULT_ARGS
    from cloakbrowser.download import ensure_binary

    Path(profile_dir).mkdir(parents=True, exist_ok=True)
    binary_path = ensure_binary()
    timezone, locale, exit_ip = maybe_resolve_geoip(False, None, None, None)
    _proxy_kwargs, proxy_extra_args = _resolve_proxy_config(None)
    args = _resolve_webrtc_args(None, None)
    if exit_ip and not (args and any(a.startswith("--fingerprint-webrtc-ip") for a in args)):
        args = list(args or [])
        args.append(f"--fingerprint-webrtc-ip={exit_ip}")
    chrome_args = build_args(
        True, (args or []) + proxy_extra_args, timezone=timezone, locale=locale, headless=headless
    )
    chrome_args = list(chrome_args) + [
        f"--user-data-dir={profile_dir}",
        "--no-first-run",
        "--no-default-browser-check",
        url,
    ]

    proc = subprocess.Popen(
        [binary_path, *chrome_args],
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=_windows_detached_flags(),
        close_fds=(sys.platform != "win32"),
    )
    time.sleep(2.0)
    return {
        "ok": True,
        "url": url,
        "title": None,
        "method": "cloakbrowser-detached",
        "headless": headless,
        "persistent": True,
        "keepOpen": True,
        "profileDir": profile_dir,
        "runnerPid": os.getpid(),
        "browserPid": proc.pid,
        "humanizeApplied": False,
    }


def _run_open_url_playwright(req: dict[str, Any]) -> dict[str, Any]:
    """Playwright + giữ driver (humanize hoặc keepOpen cần tương tác)."""
    global _HELD_CONTEXT, _HELD_PW
    from cloakbrowser.browser import (
        _import_sync_playwright,
        _resolve_backend,
        build_args,
        maybe_resolve_geoip,
        _resolve_proxy_config,
        _resolve_webrtc_args,
    )
    from cloakbrowser.config import DEFAULT_VIEWPORT, IGNORE_DEFAULT_ARGS
    from cloakbrowser.download import ensure_binary

    url = (req.get("url") or "").strip()
    headless = bool(req.get("headless", False))
    humanize = bool(req.get("humanize", True))
    keep_open = bool(req.get("keepOpen", True))
    timeout_ms = int(req.get("timeoutMs") or 120_000)
    deadline = time.monotonic() + max(timeout_ms, 5_000) / 1000.0
    profile_dir = _profile_dir(req)

    sync_playwright = _import_sync_playwright(_resolve_backend(None))
    pw = sync_playwright().start()
    _HELD_PW = pw

    binary_path = ensure_binary()
    timezone, locale, exit_ip = maybe_resolve_geoip(False, None, None, None)
    proxy_kwargs, proxy_extra_args = _resolve_proxy_config(None)
    args = _resolve_webrtc_args(None, None)
    if exit_ip and not (args and any(a.startswith("--fingerprint-webrtc-ip") for a in args)):
        args = list(args or [])
        args.append(f"--fingerprint-webrtc-ip={exit_ip}")
    chrome_args = build_args(
        True, (args or []) + proxy_extra_args, timezone=timezone, locale=locale, headless=headless
    )

    context = pw.chromium.launch_persistent_context(
        user_data_dir=os.fspath(profile_dir),
        executable_path=binary_path,
        headless=headless,
        args=chrome_args,
        ignore_default_args=IGNORE_DEFAULT_ARGS,
        **proxy_kwargs,
        viewport=DEFAULT_VIEWPORT,
    )
    _HELD_CONTEXT = context

    if humanize:
        from cloakbrowser.human import patch_context
        from cloakbrowser.human.config import resolve_config

        patch_context(context, resolve_config("default", None))

    page = context.new_page()
    remaining = max(1.0, deadline - time.monotonic())
    page.goto(url, timeout=int(remaining * 1000))
    title = page.title()
    final_url = page.url
    return {
        "ok": True,
        "url": final_url,
        "title": title,
        "method": "cloakbrowser-playwright",
        "headless": headless,
        "persistent": True,
        "keepOpen": keep_open,
        "profileDir": profile_dir,
        "runnerPid": os.getpid(),
        "humanizeApplied": humanize,
    }


def _use_chrome_profile(req: dict[str, Any]) -> bool:
    return bool(req.get("useChromeProfile", False))


def _run_open_url(req: dict[str, Any]) -> dict[str, Any]:
    url = (req.get("url") or "").strip()
    if not url:
        return {"ok": False, "error": "url trống"}

    headless = bool(req.get("headless", False))
    humanize = bool(req.get("humanize", True))
    keep_open = bool(req.get("keepOpen", True))

    if _use_chrome_profile(req):
        from chrome_system import spawn_system_chrome

        profile = str(req.get("chromeProfile") or "Default").strip() or "Default"
        udd = req.get("chromeUserDataDir")
        udd_s = str(udd).strip() if udd and str(udd).strip() else None
        exe = req.get("chromeExecutablePath")
        exe_s = str(exe).strip() if exe and str(exe).strip() else None
        return spawn_system_chrome(
            url,
            profile,
            headless=headless,
            user_data_dir=udd_s,
            executable_path=exe_s,
        )

    profile_dir = _profile_dir(req)

    try:
        Path(profile_dir).mkdir(parents=True, exist_ok=True)
        # keepOpen: Chromium detached — browser sống khi runner/agent task xong.
        if keep_open:
            out = _spawn_detached_chromium(url, profile_dir, headless)
            if humanize:
                out["humanizeSkipped"] = True
            return out
        return _run_open_url_playwright(req)
    except Exception as e:
        return {"ok": False, "error": str(e)}


def main() -> int:
    global _HELD_CONTEXT, _HELD_PW
    parser = argparse.ArgumentParser(description="StationHub Cloak browser runner")
    parser.add_argument("--request-file", required=True)
    parser.add_argument("--response-file", required=True)
    args = parser.parse_args()

    req_path = Path(args.request_file)
    res_path = Path(args.response_file)

    try:
        req = json.loads(req_path.read_text(encoding="utf-8"))
    except Exception as e:
        out = {"ok": False, "error": f"Đọc request: {e}"}
        res_path.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
        return 1

    action = (req.get("action") or "open_url").strip()
    if action == "open_url" and not _use_chrome_profile(req):
        _ensure_cloak_import()
        _apply_cache_dir()
    if action == "open_url":
        out = _run_open_url(req)
    else:
        out = {"ok": False, "error": f"action không hỗ trợ: {action}"}

    res_path.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")

    method = out.get("method") or ""
    keep_open = bool(out.get("keepOpen"))
    # Detached: Python có thể thoát ngay. Playwright + keepOpen: giữ process.
    if (
        out.get("ok")
        and keep_open
        and method not in ("cloakbrowser-detached", "chrome-system-profile")
    ):
        sys.stdout.flush()
        sys.stderr.flush()
        try:
            import signal

            signal.signal(signal.SIGINT, signal.SIG_IGN)
            signal.signal(signal.SIGTERM, signal.SIG_IGN)
        except Exception:
            pass
        while True:
            time.sleep(86400)

    if out.get("ok") and _HELD_CONTEXT is not None and not keep_open:
        try:
            _HELD_CONTEXT.close()
        except Exception:
            pass
        _HELD_CONTEXT = None
        _HELD_PW = None

    return 0 if out.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
