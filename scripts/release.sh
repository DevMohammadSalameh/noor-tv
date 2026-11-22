#!/bin/sh
# Build the three packages a GitHub release carries, from what git tracks only:
#   dist/release/Noor.wgt   Samsung (unsigned: each person's install tool signs it for their TV)
#   dist/release/Noor.apk   Android TV, Google TV, Fire TV (signed with the release key, see build-android.sh)
#   dist/release/Noor.ipk   LG webOS
# The names carry no version, so these links always give the newest release:
#   https://github.com/DevMohammadSalameh/noor-tv/releases/latest/download/Noor.apk  (and .wgt, .ipk)
set -e
cd "$(dirname "$0")/.."
[ -z "$(git status --porcelain)" ] || { echo "commit your changes first: a release is built from what git tracks"; exit 1; }
VERSION=$(sed -n 's/.*<widget[^>]* version="\([^"]*\)".*/\1/p' config.xml)
# A published app can only be updated by a build signed with the same key, so a release is never
# signed with the throwaway one.
if [ -z "$NOOR_KEYSTORE" ] && [ ! -f "$HOME/.config/noor-tv/release.jks" ]; then
  echo "no release key: set NOOR_KEYSTORE and NOOR_KEYSTORE_PASS, or put the key in ~/.config/noor-tv/ (scripts/build-android.sh)"; exit 1
fi
sh scripts/build.sh --release >/dev/null
ANDROID=$(sh scripts/build-android.sh --release 2>&1) || { echo "$ANDROID"; exit 1; }
case "$ANDROID" in *"signed with your key"*) ;; *) echo "$ANDROID"; echo "the Android app was not signed with the release key"; exit 1;; esac
python3 scripts/build-webos.py --release >/dev/null
mkdir -p dist/release
for e in wgt apk ipk; do cp "dist/Noor-$VERSION.$e" "dist/release/Noor.$e"; done
# nothing personal and no Samsung signature may be in what is published
for f in dist/release/Noor.wgt dist/release/Noor.apk; do
  if unzip -l "$f" | grep -q -E 'img/(bg|thumb)/mine/|author-signature\.xml|signature1\.xml'; then
    echo "$f holds personal photos or a Samsung signature"; exit 1
  fi
done
python3 - "dist/release/Noor.ipk" <<'PY' || exit 1
import io, sys, tarfile
b = open(sys.argv[1], "rb").read(); i = 8; data = None
while i < len(b):
    name = b[i:i+16].decode().strip(); size = int(b[i+48:i+58]); body = b[i+60:i+60+size]; i += 60 + size + size % 2
    if name == "data.tar.gz": data = body
names = tarfile.open(fileobj=io.BytesIO(data)).getnames()
if any("/mine/" in n for n in names): sys.exit("Noor.ipk holds personal photos")
PY
ls -l dist/release | awk 'NR>1 {print $5, $9}'
echo "Noor $VERSION: gh release create v$VERSION dist/release/Noor.wgt dist/release/Noor.apk dist/release/Noor.ipk"
