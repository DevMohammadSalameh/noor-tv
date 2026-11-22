#!/usr/bin/env python3
"""Pack Noor as an LG TV (webOS) app: dist/Noor-<version>.ipk

    python3 scripts/build-webos.py            everything in this folder, your own photos included
    python3 scripts/build-webos.py --release  only what git tracks, for a GitHub release

Then install it on an LG TV in Developer Mode (docs/LG.md):

    ares-install --device <tv name> dist/Noor-<version>.ipk

or open the .ipk in webOS Dev Manager. Needs only Python 3: no Node and none of LG's tools.

The .ipk is made by this script itself: an .ipk is a Debian-style "ar" archive (debian-binary,
control.tar.gz, data.tar.gz) with the app under usr/palm/applications/<id>/, laid out the way
LG's ares-package does it. The packer is couch-tv's (lg/build.py, https://github.com/Seagey/couch-tv,
MIT licence, Copyright (c) 2026 Seagey), which found that some LG TVs refuse an ares-package build
("ipk verified failed") and install this one.
"""
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tarfile
import time

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
FILES = ["index.html", "css", "js", "fonts", "img", "LICENSE", "NOTICE", "CREDITS.md"]


def _tar_gz(entries):
    """entries: (name in the archive, bytes or None for a folder). Same order every time."""
    buf = io.BytesIO()
    now = int(time.time())
    with tarfile.open(fileobj=buf, mode="w:gz", format=tarfile.GNU_FORMAT) as t:
        for name, data in entries:
            info = tarfile.TarInfo(name)
            info.mtime, info.uid, info.gid, info.uname, info.gname = now, 0, 0, "root", "root"
            if data is None:
                info.type, info.mode = tarfile.DIRTYPE, 0o755
                t.addfile(info)
            else:
                info.size, info.mode = len(data), 0o644
                t.addfile(info, io.BytesIO(data))
    return buf.getvalue()


def _ar(members):
    """A System V "ar" archive, as ares-package writes it."""
    out = [b"!<arch>\n"]
    now = str(int(time.time())).encode()
    for name, data in members:
        out.append(name.encode().ljust(16) + now.ljust(12) + b"0".ljust(6) + b"0".ljust(6)
                   + b"100644".ljust(8) + str(len(data)).encode().ljust(10) + b"\x60\n")
        out.append(data)
        if len(data) % 2:
            out.append(b"\n")
    return b"".join(out)


def pack(stage, info, ipk):
    app_id, version = info["id"], info["version"]
    files = []
    for dirpath, dirnames, names in os.walk(stage):
        dirnames.sort()
        rel = os.path.relpath(dirpath, stage)
        rel = "" if rel == "." else rel.replace(os.sep, "/") + "/"
        if rel:
            files.append((rel, None))
        for n in sorted(names):
            files.append((rel + n, os.path.join(dirpath, n)))
    entries, size = [], 0
    for d in ("usr", "usr/palm", "usr/palm/applications", "usr/palm/packages",
              f"usr/palm/applications/{app_id}", f"usr/palm/packages/{app_id}"):
        entries.append((d + "/", None))
    for rel, full in files:
        name = f"usr/palm/applications/{app_id}/{rel}"
        if full is None:
            entries.append((name, None))
        else:
            with open(full, "rb") as f:
                data = f.read()
            size += len(data)
            entries.append((name, data))
    pkginfo = json.dumps({"id": app_id, "version": version, "app": app_id}, indent=2).encode() + b"\n"
    entries.append((f"usr/palm/packages/{app_id}/packageinfo.json", pkginfo))
    control = "\n".join([
        f"Package: {app_id}", f"Version: {version}", "Section: misc", "Priority: optional",
        "Architecture: all", f"Installed-Size: {size}", "Maintainer: N/A <nobody@example.com>",
        "Description: This is a webOS application.", "webOS-Package-Format-Version: 2",
        "webOS-Packager-Version: x.y.x"]) + "\n"
    with open(ipk, "wb") as f:
        f.write(_ar([("debian-binary", b"2.0\n"),
                     ("control.tar.gz", _tar_gz([("control", control.encode())])),
                     ("data.tar.gz", _tar_gz(entries))]))


def main():
    release = "--release" in sys.argv[1:]
    with open(os.path.join(ROOT, "config.xml"), encoding="utf-8") as f:
        m = re.search(r'<widget[^>]* version="([^"]+)"', f.read())
    if not m:
        sys.exit("could not read the version from config.xml")
    version = m.group(1)
    stage = os.path.join(ROOT, "build", "webos", "app")
    shutil.rmtree(stage, ignore_errors=True)
    os.makedirs(stage)
    if release:   # only what git tracks
        tar = subprocess.run(["git", "-C", ROOT, "archive", "HEAD"] + FILES, check=True, stdout=subprocess.PIPE).stdout
        with tarfile.open(fileobj=io.BytesIO(tar)) as t:
            t.extractall(stage)
    else:
        skip = shutil.ignore_patterns(".DS_Store", "__pycache__")
        for name in FILES:
            src = os.path.join(ROOT, name)
            if os.path.isdir(src):
                shutil.copytree(src, os.path.join(stage, name), ignore=skip)
            else:
                shutil.copy2(src, os.path.join(stage, name))
    example = os.path.join(stage, "js", "mine.example.js")
    if os.path.exists(example):
        os.remove(example)
    mine = os.path.join(stage, "js", "mine.js")   # the page asks for it (your own photos); a release has none
    if not os.path.exists(mine):
        with open(mine, "w", encoding="utf-8") as f:
            f.write("/* no own photos in this build */\n")
    # the LG side: what the app is called and its two icons
    for name in ("icon.png", "largeIcon.png"):
        shutil.copy2(os.path.join(ROOT, "webos", name), os.path.join(stage, name))
    with open(os.path.join(ROOT, "webos", "appinfo.json"), encoding="utf-8") as f:
        info = json.load(f)
    info["version"] = version
    with open(os.path.join(stage, "appinfo.json"), "w", encoding="utf-8") as f:
        json.dump(info, f, indent=2)
        f.write("\n")
    os.makedirs(os.path.join(ROOT, "dist"), exist_ok=True)
    ipk = os.path.join(ROOT, "dist", f"Noor-{version}.ipk")
    pack(stage, info, ipk)
    print(f"{ipk} ({os.path.getsize(ipk) / 1e6:.0f} MB) for LG webOS, app id {info['id']}")


if __name__ == "__main__":
    main()
