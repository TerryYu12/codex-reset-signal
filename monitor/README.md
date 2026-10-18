# Isolated scheduled monitor

This is a standalone npm package, not a root npm workspace. Its lockfile contains
only the CLI's production dependencies: `chrono-node`, `luxon`, and `tsx` (plus
their transitive/platform dependencies). The scheduled workflow installs here;
it never installs the dashboard or test toolchain.

From the repository root, using Node 22 or newer:

```sh
npm --prefix monitor ci --ignore-scripts
npm --prefix monitor run monitor:dry -- --input fixtures/posts.json
npm --prefix monitor audit --omit=dev --audit-level=low
node --no-global-search-paths scripts/verify-monitor-isolation.mjs
```

`npm --prefix monitor run monitor` performs the real configured poll and can
send notifications. Do not use it for offline verification. The `--test-notify`
flag also sends real notifications.

## Source and path boundary

`run.mjs` copies the canonical `src/`, `history/`, and `fixtures/` into ignored
`monitor/.runtime/run-*/` before loading the CLI. Every invocation gets a fresh
directory, cleaned up when the CLI exits normally or throws; obsolete sources
are never reused, and concurrent local processes do not share staged files.
These are copies, not symlinks: Node
resolves imports from `monitor/node_modules`, even when root dependencies are
absent. The staging is explicit at execution time, not a dependency lifecycle
script. Do not edit staged files; update the canonical sources instead.

The runner restores the working directory to the repository root. `.env`,
explicit `--input` paths, `runtime/state.json`, `runtime/status.json`, generated
feeds and `scripts/send_gmail.py` therefore retain their existing paths. Actions
summary and state persistence steps still run from their original directories.
Arguments are passed unchanged, including loop and notification-test modes.

The isolation check copies the installed monitor package into a fresh temporary
tree without root dependencies, disables Node global search paths, runs only
fixture dry runs, and checks imports and path assumptions. CI installs and audits
this package in a separate job without installing root dependencies first.

## Dashboard and maintenance

Root scripts, application/API/feed sources and dependencies remain available
for the full dashboard and development workflow. Run `npm audit` at the root as
well as in `monitor/`: a clean monitor audit does not mean the whole project is
vulnerability-free. Keep shared runtime dependency versions in sync when updating
either manifest, and regenerate each lockfile independently with scripts disabled.
