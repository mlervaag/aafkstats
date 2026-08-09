import { describe, expect, it } from "vitest";
import { checkRateLimit, clientIp, redactSqlLiterals } from "../lib/rate-limit";

const req = (headers: Record<string, string>) =>
  new Request("https://aafkstats.test/api/chat", { method: "POST", headers });

describe("clientIp", () => {
  it("foretrekker hodene plattformen setter", () => {
    // x-forwarded-for er fri tekst avsenderen kan legge til i. Settes et
    // plattformsatt hode, er det dét som gjelder.
    expect(
      clientIp(req({ "x-forwarded-for": "1.1.1.1", "x-real-ip": "9.9.9.9" })),
    ).toBe("9.9.9.9");
    expect(
      clientIp(req({ "x-forwarded-for": "1.1.1.1", "x-vercel-forwarded-for": "8.8.8.8" })),
    ).toBe("8.8.8.8");
  });

  it("tar siste ledd i x-forwarded-for, ikke første", () => {
    // Siste ledd er lagt på av proxyen nærmest oss. Første er den avsenderen
    // selv kan finne på å sende, og var det vi brukte før.
    expect(clientIp(req({ "x-forwarded-for": "9.9.9.9, 203.0.113.7" }))).toBe("203.0.113.7");
  });

  it("faller tilbake når ingenting finnes", () => {
    expect(clientIp(req({}))).toBe("ukjent");
  });
});

describe("loggredigering", () => {
  it("fjerner tekstverdier som kan stamme fra brukerens spørsmål", () => {
    expect(
      redactSqlLiterals("SELECT * FROM matches WHERE opponent = 'O''Brien' AND season = 2024"),
    ).toBe("SELECT * FROM matches WHERE opponent = '?' AND season = 2024");
  });
});

describe("checkRateLimit", () => {
  it("stopper etter grensen for samme avsender", () => {
    const ip = `test-${Math.random()}`;
    const call = () => checkRateLimit(req({ "x-real-ip": ip }));
    const verdicts = Array.from({ length: 12 }, call);
    expect(verdicts.filter((v) => v.allowed).length).toBe(10);
    const blocked = verdicts.at(-1)!;
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("vokser ikke uten grense når avsenderne er nye hver gang", () => {
    // Opprydningen slettet før bare utløpte vinduer. En strøm av nye avsendere
    // ryddet derfor ingenting, og utløste i stedet en full gjennomgang av kartet
    // ved hver eneste forespørsel — med et kart som aldri sluttet å vokse.
    const started = Date.now();
    for (let i = 0; i < 12_000; i++) {
      checkRateLimit(req({ "x-real-ip": `flom-${i}` }));
    }
    // Uten et hardt tak blir dette kvadratisk og bruker mange sekunder.
    expect(Date.now() - started).toBeLessThan(5000);
  });
});
