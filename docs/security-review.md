# Notification dependency hardening

Review date: 2026-10-18. Baseline: `d6b193481f9e65bacc6f7b108d80030ad48092d1`.

## Changes

- Notification/source secrets are supplied only to the monitor step. The configuration check receives presence booleans, not secret values.
- Both checkouts disable credential persistence. The existing `contents: write` permission remains necessary to save `monitor-state`; only the persistence step receives the ephemeral GitHub token and passes its masked authorization header to its two Git network operations.
- The monitor uses `npm ci --ignore-scripts`. A clean install with lifecycle scripts disabled passed the checks below. This reduces install-time exposure, but does not sandbox dependencies when the monitor itself runs.
- Lockfile-only patch updates: React, React DOM and React Server DOM Webpack 19.2.8 → 19.2.9; Vite 7.3.6 → 7.3.7; fast-uri → 3.1.8; nanoid → 3.3.20; source-map-js → 1.2.2. React's manifest minimum is 19.2.9. No major upgrades or forced audit fixes.

## Verification

In a clean environment without notification credentials, using Node 24.19.0 / npm 11.9.0:

- `npm ci --ignore-scripts --no-audit`
- `npm test`: 89 tests passed across 13 files
- `npm run typecheck`
- `npm run pages:validate`
- `npm run build`: passed, with source-map/dynamic-import warnings
- `npm run monitor:dry -- --input fixtures/posts.json`
- Parsed workflow YAML and asserted secret placement, boolean checks and disabled checkout credential persistence.

No real notification was sent. Actual GitHub token authentication/state persistence is not exercised locally. CI uses Node 22 and provides the separate compatibility check. Nothing is merged or deployed by this patch.

## Remaining audit findings

`npm audit --package-lock-only --ignore-scripts --json` against `https://registry.npmjs.org/` reports 12 affected package entries before and 9 after (273 total dependency entries). Before: 2 critical, 9 high, 1 moderate. After: 2 critical, 6 high, 1 moderate. Counts include propagated dependency findings, not just distinct vulnerabilities.

- Critical: `tinypool` and its parent `vitest`. [GHSA-5gmw-xhrv-c9v3](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3) and [GHSA-85c8-ppgw-ccpr](https://github.com/advisories/GHSA-85c8-ppgw-ccpr) concern prototype-pollution gadgets in worker options. The audit also reports [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) for Vitest/mock tooling. These are test dependencies, not imported by the monitor CLI. A test-runner major upgrade is intentionally deferred; do not expose Vitest servers or run untrusted tests/configuration with secrets.
- High: `braces` [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), propagated through micromatch, fast-glob, vite-plugin-dynamic-import, vite-plugin-commonjs and vinext. The audit identifies no patched braces version; its suggested vinext downgrade is not applied. This chain serves dashboard build tooling, not the CLI's chrono-node/luxon parsing path. Avoid untrusted glob patterns.

The earlier RSC/Vite advisory IDs GHSA-xqc2-xf4c-x3h3, GHSA-rq7h-c2jc-7f22 and GHSA-9jrq-w75r-8gcw were not returned by the current npm audit, and their GitHub advisory pages returned 404 during this review. The target package versions were verified against npm; the patch does not claim these inaccessible advisories were independently confirmed.

This is risk reduction, not a clean audit or evidence that credentials were compromised. Separating the monitor's dependency graph from dashboard/test tooling is a possible follow-up, not part of this minimal change.
