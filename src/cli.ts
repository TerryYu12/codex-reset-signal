import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import { loadConfig, validateConfig } from "./config";
import { extractEvents } from "./events";
import { createTargets, renderText } from "./notifications";
import { runMonitor } from "./monitor";
import type { PendingNotification, XPost } from "./types";

if (existsSync(".env")) process.loadEnvFile(".env");
const dryRun = process.argv.includes("--dry-run");
const loop = process.argv.includes("--loop");
const testNotify =
  process.argv.includes("--test-notify") || process.argv.includes("--test-email");
const config = loadConfig();
const errors = validateConfig(config, { offline: dryRun });
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else if (testNotify) {
  console.log("Triggering test notification to configured targets...");
  const targets = createTargets(config);
  if (targets.length === 0) {
    console.error("No notification targets configured.");
    process.exitCode = 1;
  } else {
    const testItem: PendingNotification = {
      key: `test-${Date.now()}`,
      post: {
        id: "test",
        text: "Codex Reset Signal - Test notification to verify SMTP delivery.",
        createdAt: new Date().toISOString(),
        url: `https://x.com/${config.username}`,
        media: [],
      },
      events: [],
      targets: [],
      delivered: [],
    };
    let hasError = false;
    for (const target of targets) {
      try {
        console.log(`Sending test notification to [${target.channel}]...`);
        await target.send(testItem);
        console.log(`Successfully delivered to [${target.channel}].`);
      } catch (err) {
        console.error(
          `Delivery failed for [${target.channel}]:`,
          err instanceof Error ? err.message : err,
        );
        hasError = true;
      }
    }
    if (hasError) process.exitCode = 1;
  }
} else if (dryRun) {
  const index = process.argv.indexOf("--input");
  const path =
    index >= 0
      ? process.argv[index + 1]
      : new URL("../fixtures/posts.json", import.meta.url);
  if (!path) throw new Error("--input requires a JSON file path");
  const posts = JSON.parse(await readFile(path, "utf8")) as XPost[];
  for (const post of posts) {
    const events = extractEvents(post, config.sourceTimezone).filter(
      (e) => config.includeMentions || e.type !== "mention",
    );
    if (events.length)
      console.log(renderText(post, events, config.timezone) + "\n");
  }
} else {
  const interval = Number(process.env.POLL_INTERVAL_SECONDS || 300);
  if (!Number.isFinite(interval) || interval < 60)
    throw new Error("POLL_INTERVAL_SECONDS must be at least 60");
  const shutdown = new AbortController();
  process.on("SIGTERM", () => shutdown.abort());
  process.on("SIGINT", () => shutdown.abort());
  do {
    try {
      const state = await runMonitor(config);
      console.log(
        `Checked @${state.username} via ${config.sourceProvider}; ${state.lastRunStatus}; ${state.outbox?.length ?? 0} pending.`,
      );
    } catch (error) {
      // Adapters redact provider responses and URL/token-bearing transport errors.
      console.error(error instanceof Error ? error.message : "Monitor failed");
      if (!loop) process.exitCode = 1;
    }
    if (!loop || shutdown.signal.aborted) break;
    try {
      await setTimeout(interval * 1000, undefined, { signal: shutdown.signal });
    } catch {
      break;
    }
  } while (!shutdown.signal.aborted);
}
