import { afterEach, describe, expect, it } from "vitest";
import { POST } from "../app/api/chat/route";

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENAI_API_KEY;
});

describe("chat-rutens request-grense", () => {
  it("avviser text/plain før tjenestekonfigurasjonen vurderes", async () => {
    const request = new Request("https://arkivet.test/api/chat", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: JSON.stringify({ question: "hei" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(415);
  });

  it("avviser cross-site før tjenestekonfigurasjonen vurderes", async () => {
    const request = new Request("https://arkivet.test/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://ondsinnet.test" },
      body: JSON.stringify({ question: "hei" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
  });
});
