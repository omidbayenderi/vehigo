#!/bin/sh
# Clears state that regularly gets corrupted on this repo's exFAT external drive:
# Turbopack's persistent cache DB, and Playwright's own output dir (which macOS's
# AppleDouble ._ sidecar files sometimes leave rm -rf unable to fully remove).
set -e

rm -rf .next/cache .next/dev/cache

if [ -d test-results ]; then
  rm -rf test-results 2>/dev/null || mv test-results ".test-results-stale-$(date +%s)"
fi

npm run e2e:safety
npm run db:verify:test-schema
npm run e2e:context:provision
