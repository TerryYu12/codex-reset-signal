import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config";

describe("source timezone defaults", () => {
  it("defaults @thsottiaux announcements to America/Los_Angeles", () => {
    const config = loadConfig({});
    expect(config.username).toBe("thsottiaux");
    expect(config.sourceTimezone).toBe("America/Los_Angeles");
  });

  it("does not impose the Tibo timezone on other monitored accounts", () => {
    const config = loadConfig({ X_USERNAME: "someone_else" });
    expect(config.sourceTimezone).toBeUndefined();
  });

  it("lets SOURCE_TIMEZONE override the canonical default", () => {
    const config = loadConfig({
      X_USERNAME: "thsottiaux",
      SOURCE_TIMEZONE: "Europe/London",
    });
    expect(config.sourceTimezone).toBe("Europe/London");
  });
});

describe("email recipient config", () => {
  it("falls back to EMAIL_T0 if EMAIL_TO is missing", () => {
    const config = loadConfig({ EMAIL_T0: "user@example.com" });
    expect(config.emailTo).toEqual(["user@example.com"]);
  });

  it("deduplicates EMAIL_TO and EMAIL_T0", () => {
    const config = loadConfig({
      EMAIL_TO: "a@example.com, b@example.com",
      EMAIL_T0: "b@example.com, c@example.com",
    });
    expect(config.emailTo).toEqual([
      "a@example.com",
      "b@example.com",
      "c@example.com",
    ]);
  });
});

