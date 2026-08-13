import { afterEach, describe, expect, it, vi } from "vitest";
import { createRequestLogger, logUpstreamFailure } from "../lib/runtime-logging.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("strukturerte runtime-logger", () => {
  it("logger start, status og varighet uten forespørselskroppen", () => {
    const info = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const request = new Request("https://aafkarkivet.no/api/contributions", {
      headers: { "x-vercel-id": "arn1::test" },
      body: "hemmelig bidragstekst",
      method: "POST",
    });
    const logger = createRequestLogger(request, "/api/contributions");
    const response = logger.complete(new Response(null, { status: 201 }));

    expect(response.status).toBe(201);
    expect(info).toHaveBeenCalledTimes(2);
    const done = JSON.parse(String(info.mock.calls[1]![0]));
    expect(done).toMatchObject({
      level: "info",
      msg: "done",
      route: "/api/contributions",
      request_id: "arn1::test",
      status: 201,
    });
    expect(done.ms).toEqual(expect.any(Number));
    expect(info.mock.calls.flat().join(" ")).not.toContain("hemmelig bidragstekst");
  });

  it("logger bare trygg feiltype og status for oppstrømsfeil", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logUpstreamFailure("/api/verifications", "github_request_failed", 502);

    expect(JSON.parse(String(error.mock.calls[0]![0]))).toEqual({
      level: "error",
      msg: "github_request_failed",
      route: "/api/verifications",
      upstream_status: 502,
    });
  });
});
