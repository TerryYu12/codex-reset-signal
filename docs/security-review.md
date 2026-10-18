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

## Stage 2: isolated monitor and Vitest 4 (2026-10-18)

Based on merged `31c8390edc2a92665f2f828220b6ab6e8518053b`.

- Upgraded Vitest 3.2.7 to the registry-verified 4.1.11. The resolved mocker is
  4.1.11, and `tinypool` is absent from the root lockfile. The root audit no
  longer reports the earlier critical worker-pool or moderate mocker findings.
- Added independent `monitor/package.json` and `monitor/package-lock.json` with
  only chrono-node, luxon and tsx as production dependencies. Scheduled Actions
  install this lockfile with lifecycle scripts disabled and use its cache key.
- Shared CLI source is staged beneath the isolated dependency directory; all
  dashboard/API/server source and root scripts remain unchanged. Existing state,
  summary, Gmail helper and fixture paths are preserved. See
  [monitor setup and boundary](../monitor/README.md).
- Preserved step-scoped notification secrets, presence-only configuration checks,
  both credential-free checkouts and persistence-only ephemeral Git authentication.

### Stage 2 verification

Using Node 24.19.0 / npm 11.9.0 locally, with no notification credentials:

- Clean root `npm ci --ignore-scripts --no-audit`.
- 91 tests across 14 files, typecheck, Pages validation and full dashboard build.
- Independent `npm --prefix monitor ci --ignore-scripts --no-audit` in a fresh
  temporary checkout with no root `node_modules`: 7 packages installed.
- Fixture-only monitor dry runs from repository and package working directories;
  default and explicit fixture paths produce the same output.
- Isolation probe with global module search disabled: chrono-node/luxon/tsx
  resolve inside the monitor package; web/test packages cannot resolve. State,
  status, historical seed, Gmail helper and Actions summary paths pass.
- Cloudflare dashboard and scheduler Worker deploy commands with `--dry-run`
  only, never a deployment. The normal build's source-map/dynamic-import warnings
  are unchanged.

CI retains the full root verification job and adds an independent Node 22
monitor install/audit/isolation job. No real poll, test notification, merge or
production deployment is performed by this change. Local verification does not
exercise actual GitHub token persistence or delivery credentials.

### Current audit scope and residual risk

Primary registry: `https://registry.npmjs.org/`, checked with
`npm audit --package-lock-only --ignore-scripts --json` for both lockfiles.

- **Root: 6 high, 0 critical, 0 moderate** (269 dependency entries). The remaining
  affected entries are braces, micromatch, fast-glob, vite-plugin-commonjs,
  vite-plugin-dynamic-import and vinext. These are the existing web/build chain;
  no patched compatible braces release was available in this audit. We did not
  force incompatible overrides or remove dashboard features to hide findings.
- **Monitor: 0 reported vulnerabilities** (33 dependency entries including
  optional platform packages; 7 installed on the test platform). None of the
  above web dependencies, Vitest or tinypool are in this lockfile.

These are point-in-time advisory results, not a guarantee against unknown
vulnerabilities. The monitor still executes its own runtime dependencies while
notification secrets are present, so this reduces exposure rather than creating
an execution sandbox. Continue auditing both lockfiles.
