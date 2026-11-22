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
sh scripts/build.sh --release >/dev/null
sh scripts/build-android.sh --release >/dev/null 2>&1
python3 scripts/build-webos.py --release >/dev/null
mkdir -p dist/release
for e in wgt apk ipk; do cp "dist/Noor-$VERSION.$e" "dist/release/Noor.$e"; done
case "$(unzip -l dist/release/Noor.wgt dist/release/Noor.apk 2>/dev/null | grep -c -E 'mine/|author-signature|signature1')" in 0) ;; *) echo "a package holds personal photos or a Samsung signature"; exit 1;; esac
ls -l dist/release | awk 'NR>1 {print $5, $9}'
echo "Noor $VERSION: gh release create v$VERSION dist/release/Noor.wgt dist/release/Noor.apk dist/release/Noor.ipk"
