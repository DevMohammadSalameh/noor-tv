#!/bin/sh
# Pack Noor into an unsigned Samsung TV package: dist/Noor-<version>.wgt
#
#   sh scripts/build.sh            everything in this folder, your own photos (img/bg/mine) included
#   sh scripts/build.sh --release  only what git tracks, for a GitHub release (nothing of yours in it)
#
# The package is not signed. Apps2Samsung signs it with your own Samsung certificate when it
# installs it (docs/SAMSUNG.md).
set -e
cd "$(dirname "$0")/.."
VERSION=$(sed -n 's/.*<widget[^>]* version="\([^"]*\)".*/\1/p' config.xml)
[ -n "$VERSION" ] || { echo "could not read the version from config.xml"; exit 1; }
OUT="$PWD/dist/Noor-$VERSION.wgt"
FILES="config.xml index.html icon.png css js fonts img LICENSE NOTICE LICENSES CREDITS.md"
mkdir -p dist
rm -f "$OUT"
if [ "$1" = "--release" ]; then
  TMP=$(mktemp -d)
  git archive HEAD $FILES | tar -x -C "$TMP"
  (cd "$TMP" && zip -qr -X "$OUT" $FILES -x '*.DS_Store' 'js/mine.example.js')
  rm -rf "$TMP"
else
  zip -qr -X "$OUT" $FILES -x '*.DS_Store' 'js/mine.example.js'
fi
if unzip -l "$OUT" | grep -qi 'signature'; then echo "the package holds a signature file: it must be unsigned"; exit 1; fi
echo "$OUT ($(du -h "$OUT" | cut -f1 | tr -d ' '), unsigned)"
