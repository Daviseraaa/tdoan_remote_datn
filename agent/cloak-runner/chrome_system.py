"""Mở Google Chrome đã cài với profile thật (cookies / đăng nhập)."""

from __future__ import annotations

import os
import platform
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

_WIN_BREAKAWAY = 0x0100_0000
_WIN_NO_WINDOW = 0x0800_0000


def find_chrome_executable(override: str | None = None) -> str | None:
    if override and str(override).strip():
        p = Path(override).expanduser()
        if p.is_file():
            return str(p.resolve())
        return None

    system = platform.system()
    if system == "Darwin":
        candidates = [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
        ]
    elif system == "Linux":
        candidates = []
        for cmd in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser"):
            try:
                r = subprocess.run(["which", cmd], capture_output=True, text=True, check=False)
                if r.returncode == 0 and r.stdout.strip():
                    candidates.append(r.stdout.strip())
            except Exception:
                pass
    else:
        candidates = [
            os.path.expandvars(r"%ProgramFiles%\Google\Chrome\Application\chrome.exe"),
            os.path.expandvars(r"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"),
            os.path.expandvars(r"%LocalAppData%\Google\Chrome\Application\chrome.exe"),
        ]

    for path in candidates:
        if path and Path(path).is_file():
            return path
    return None


def default_chrome_user_data_dir(override: str | None = None) -> str:
    if override and str(override).strip():
        return str(Path(override).expanduser().resolve())

    system = platform.system()
    if system == "Darwin":
        return str(Path.home() / "Library" / "Application Support" / "Google" / "Chrome")
    if system == "Linux":
        base = Path.home() / ".config"
        for name in ("google-chrome", "chromium"):
            p = base / name
            if p.is_dir():
                return str(p)
        return str(base / "google-chrome")
    return os.path.expandvars(r"%LocalAppData%\Google\Chrome\User Data")


def _windows_detached_flags() -> int:
    if sys.platform != "win32":
        return 0
    return (
        subprocess.CREATE_NEW_PROCESS_GROUP
        | subprocess.DETACHED_PROCESS
        | _WIN_BREAKAWAY
        | _WIN_NO_WINDOW
    )


def spawn_system_chrome(
    url: str,
    profile_directory: str,
    *,
    headless: bool = False,
    user_data_dir: str | None = None,
    executable_path: str | None = None,
) -> dict[str, Any]:
    """Chrome hệ thống + profile thật. Cần đóng Chrome đang dùng cùng profile."""
    exe = find_chrome_executable(executable_path)
    if not exe:
        return {
            "ok": False,
            "error": "Không tìm thấy Google Chrome. Cài Chrome hoặc set chromeExecutablePath.",
        }

    udd = default_chrome_user_data_dir(user_data_dir)
    profile = (profile_directory or "Default").strip() or "Default"
    profile_path = Path(udd) / profile
    if not profile_path.is_dir() and profile != "Default":
        return {
            "ok": False,
            "error": f'Không thấy profile "{profile}" trong {udd}',
        }

    chrome_args = [
        f"--user-data-dir={udd}",
        f"--profile-directory={profile}",
        "--no-first-run",
        "--no-default-browser-check",
        "--new-window",
    ]
    if headless:
        chrome_args.append("--headless=new")
    chrome_args.append(url)

    try:
        proc = subprocess.Popen(
            [exe, *chrome_args],
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=_windows_detached_flags(),
            close_fds=(sys.platform != "win32"),
        )
    except OSError as e:
        return {"ok": False, "error": f"Không spawn Chrome: {e}"}

    time.sleep(2.0)
    return {
        "ok": True,
        "url": url,
        "title": None,
        "method": "chrome-system-profile",
        "headless": headless,
        "persistent": True,
        "keepOpen": True,
        "chromeExecutable": exe,
        "chromeUserDataDir": udd,
        "chromeProfile": profile,
        "runnerPid": os.getpid(),
        "browserPid": proc.pid,
        "humanizeApplied": False,
    }
