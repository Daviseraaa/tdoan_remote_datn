# -*- mode: python ; coding: utf-8 -*-
# Build: pip install -e ../CloakBrowser pyinstaller
#        pyinstaller datn-cloak-runner.spec
# Output: dist/datn-cloak-runner/ → copy to agent/bin/cloak/

import sys
from pathlib import Path

block_cipher = None
root = Path(SPECPATH)
cloak_repo = root.parent / "CloakBrowser"

a = Analysis(
    [str(root / "main.py")],
    pathex=[str(cloak_repo)] if cloak_repo.is_dir() else [],
    binaries=[],
    datas=[],
    hiddenimports=[
        "chrome_system",
        "cloakbrowser",
        "cloakbrowser.browser",
        "cloakbrowser.download",
        "cloakbrowser.config",
        "playwright",
        "playwright.sync_api",
        "greenlet",
        "httpx",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="datn-cloak-runner",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="datn-cloak-runner",
)
