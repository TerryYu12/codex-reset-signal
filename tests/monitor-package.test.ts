import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("scheduled monitor dependency boundary", () => {
  it("keeps a standalone production-only CLI dependency graph", () => {
    const pkg = JSON.parse(read("monitor/package.json"));
    const lock = JSON.parse(read("monitor/package-lock.json"));
    expect(Object.keys(pkg.dependencies).sort()).toEqual(["chrono-node", "luxon", "tsx"]);
    expect(pkg.devDependencies).toBeUndefined();
    expect(lock.packages[""].dependencies).toEqual(pkg.dependencies);
    expect(Object.keys(lock.packages).some((path) => /node_modules\/(vinext|vite|vitest|tinypool|braces|react)$/.test(path))).toBe(false);
  });

  it("installs and caches the monitor lockfile without weakening credentials", () => {
    const workflow = read(".github/workflows/monitor.yml");
    expect(workflow).toContain("cache-dependency-path: monitor/package-lock.json");
    expect(workflow).toContain("run: npm ci --ignore-scripts\n        working-directory: monitor");
    expect(workflow).toContain("npm --prefix monitor run monitor -- --test-notify");
    expect(workflow).toContain("npm --prefix monitor run monitor\n");
    expect(workflow.match(/persist-credentials: false/g)).toHaveLength(2);
    const installSection = workflow.split("      - name: Verify notification secrets configuration")[0];
    expect(installSection).not.toContain("secrets.");
    expect(installSection).not.toContain("github.token");
    expect(workflow).toContain("STATE_PATH: runtime/state.json");
    expect(workflow).toContain("PUBLIC_STATUS_PATH: runtime/status.json");
    expect(workflow).toContain("working-directory: runtime");
    expect(workflow).toContain("run: node scripts/actions-summary.mjs");
    expect(workflow).toContain("git -c http.https://github.com/.extraheader=\"$auth_header\" push origin HEAD:monitor-state");
  });
});
