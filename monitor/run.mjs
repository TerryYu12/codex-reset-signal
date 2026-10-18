import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { register } from "tsx/esm/api";

// Stage the canonical sources beneath this package so Node resolves ONLY this
// package's dependencies on a clean runner. Never symlink sources outside it.
const root = new URL("../", import.meta.url);
const stagingRoot = new URL(".runtime/", import.meta.url);
await mkdir(stagingRoot, { recursive: true });
// Each invocation starts fresh: deleted sources cannot survive from an older
// checkout, and concurrent local processes do not overwrite each other's copy.
const staged = pathToFileURL(
  (await mkdtemp(fileURLToPath(new URL("run-", stagingRoot)))) + "/",
);
try {
  for (const directory of ["src", "history", "fixtures"]) {
    await cp(new URL(directory, root), new URL(directory, staged), { recursive: true });
  }

  // Keep .env, explicit --input, runtime/state.json, runtime/status.json and
  // scripts/send_gmail.py relative to the repository, exactly as before.
  process.chdir(fileURLToPath(root));
  register();
  await import(new URL("src/cli.ts", staged).href);
} finally {
  await rm(staged, { recursive: true, force: true });
}
