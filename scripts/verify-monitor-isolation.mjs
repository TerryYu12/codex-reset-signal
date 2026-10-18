import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Run after `npm --prefix monitor ci --ignore-scripts`. A fresh temp tree has
// no root node_modules, so the root web/test install cannot mask missing deps.
assert.ok(process.execArgv.includes("--no-global-search-paths"), "Run with node --no-global-search-paths");
const root = fileURLToPath(new URL("../", import.meta.url));
const isolated = await mkdtemp(join(tmpdir(), "reset-monitor-isolation-"));
try {
  for (const directory of ["src", "history", "fixtures", "scripts"]) {
    await cp(join(root, directory), join(isolated, directory), { recursive: true });
  }
  await cp(join(root, "monitor"), join(isolated, "monitor"), {
    recursive: true,
    filter: (source) => !source.includes(".runtime"),
  });
  const lock = JSON.parse(await readFile(join(isolated, "monitor/package-lock.json"), "utf8"));
  assert.deepEqual(Object.keys(lock.packages[""].dependencies).sort(), ["chrono-node", "luxon", "tsx"]);
  const require = createRequire(join(isolated, "monitor/.runtime/src/cli.ts"));
  for (const dependency of ["chrono-node", "luxon", "tsx"]) {
    assert.ok(require.resolve(dependency).startsWith(join(isolated, "monitor/node_modules/")));
  }
  for (const dependency of ["react", "react-dom", "vinext", "vite", "vitest", "tinypool", "braces"]) {
    assert.throws(() => require.resolve(dependency), { code: "MODULE_NOT_FOUND" });
  }

  // Deliberately do not inherit credentials, .env or Node loader overrides.
  const env = { PATH: process.env.PATH, TARGET_TIMEZONE: "Asia/Shanghai" };
  const run = (cwd, args) => {
    const result = spawnSync(process.execPath, ["--no-global-search-paths", join(isolated, "monitor/run.mjs"), "--dry-run", ...args], {
      cwd, env, encoding: "utf8", timeout: 30_000,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Reset Signal/);
    return result.stdout;
  };
  const expected = run(isolated, []);
  assert.equal(run(join(isolated, "monitor"), ["--input", "fixtures/posts.json"]), expected);

  // Inspect paths from inside the staged boundary without running a live poll
  // or creating targets. This covers state, history, Gmail and summary paths.
  const probe = `
    import assert from 'node:assert/strict';
    import { existsSync } from 'node:fs';
    import { loadConfig } from './src/config.ts';
    import { historicalSignals } from './src/history.ts';
    const config = loadConfig();
    assert.equal(config.statePath, 'runtime/state.json');
    assert.equal(config.publicStatusPath, 'runtime/status.json');
    assert.ok(existsSync('scripts/send_gmail.py'));
    assert.ok(existsSync('scripts/actions-summary.mjs'));
    assert.ok(historicalSignals().length > 0);
  `;
  const { writeFile } = await import("node:fs/promises");
  const probePath = join(isolated, "monitor/.runtime/probe.mts");
  await writeFile(probePath, probe);
  const probeResult = spawnSync(process.execPath, ["--no-global-search-paths", "--import", require.resolve("tsx"), probePath], {
    cwd: isolated, encoding: "utf8", timeout: 30_000,
    env: { ...env, STATE_PATH: "runtime/state.json", PUBLIC_STATUS_PATH: "runtime/status.json" },
  });
  assert.equal(probeResult.status, 0, probeResult.stderr);
  console.log("Monitor isolation passed: no root dependencies, fixture-only dry runs, stable repository paths.");
} finally {
  await rm(isolated, { recursive: true, force: true });
}
