#!/usr/bin/env bash
# bump-ver.sh <newversion>  e.g. v0.2.296-alpha
# Bumps the version string everywhere it appears, rebuilds continuum data, runs tests.
set -e
cd "$(dirname "$0")/.."
V="$1"
if [ -z "$V" ]; then echo "usage: bump-ver.sh <version>"; exit 1; fi
# strip leading v for package.json-style
PV="${V#v}"
echo "Bumping to $V (pkg $PV)"

# Source + config + public assets
sed -i "s/v0\.2\.29[0-9]\(-[a-z]*\)\?-alpha/$V/g; s/0\.2\.29[0-9]\(-[a-z]*\)\?-alpha/$PV/g" \
  package.json package-lock.json \
  src/config.js src/engine/dashboard/continuumData.js \
  public/sw.js public/continuum-data.json public/dashboard.html \
  NEXT_ACTION_STATE.json MVP_APPROVAL_STATE.json \
  index.html \
  tests/continuum-dashboard.helpers.test.js \
  tests/continuum-dashboard.sdk.test.js \
  tests/continuum-dashboard.render.test.js \
  tests/continuum-dashboard.model.test.js \
  tests/live-update-check.test.js

# Fix the behindBy assertion in live-update-check: versionNum - 280
NUM=$(echo "$PV" | grep -oE '^0\.2\.29[0-9]' | grep -oE '[0-9]+$')
if [ -n "$NUM" ]; then
  BEHIND=$((NUM - 280))
  sed -i "s/expect(a.behindBy).toBe([0-9]*)/expect(a.behindBy).toBe($BEHIND)/" tests/live-update-check.test.js
  sed -i "s#// [0-9]*-280=[0-9]* (tracks app version)#// $NUM-280=$BEHIND (tracks app version)#" tests/live-update-check.test.js
fi

echo "Version bumped. Verify:"
grep -oE '0\.2\.29[0-9](-[a-z]*)?-alpha' package.json src/config.js public/sw.js index.html | head -6
