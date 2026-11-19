import { describe, expect, it } from "vitest";
import { isTerminalPollError, pollBackoffDelay, PollHttpError } from "@/lib/data-ops/poll";

describe("pollBackoffDelay", () => {
  it("gấp đôi mỗi lần, chạm trần (khớp quy tắc badge: 20s -> 40s -> 45s)", () => {
    expect(pollBackoffDelay(20_000, 1, 45_000)).toBe(40_000);
    expect(pollBackoffDelay(20_000, 2, 45_000)).toBe(45_000);
    expect(pollBackoffDelay(20_000, 9, 45_000)).toBe(45_000);
    expect(pollBackoffDelay(6_000, 1, 45_000)).toBe(12_000);
  });
  it("retryCount âm/lẻ không làm vỡ", () => {
    expect(pollBackoffDelay(6_000, -3, 45_000)).toBe(6_000);
    expect(pollBackoffDelay(6_000, 1.9, 45_000)).toBe(12_000);
  });
});

describe("isTerminalPollError", () => {
  it("401 và 403 dừng hẳn; lỗi khác thì thử lại", () => {
    expect(isTerminalPollError(new PollHttpError(401))).toBe(true);
    expect(isTerminalPollError(new PollHttpError(403))).toBe(true);
    expect(isTerminalPollError(new PollHttpError(429))).toBe(false);
    expect(isTerminalPollError(new PollHttpError(502))).toBe(false);
    expect(isTerminalPollError(new Error("network"))).toBe(false);
  });
});
