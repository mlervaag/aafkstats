import { describe, expect, it } from "vitest";
import { source as sourceSchema } from "@aafkstats/schema";
import type { Archive } from "@aafkstats/schema/load";
import { assertMayFetch, assertMayPublish, SourcePolicyError } from "../src/policy.js";

const archive = (...sources: unknown[]): Archive =>
  ({
    clubs: [], venues: [], competitions: [], seasons: [], matches: [], observations: [], standings: [], people: [], issues: [],
    sources: sources.map((s) => sourceSchema.parse(s)),
  }) as unknown as Archive;

const base = { id: "kilde", name: "En kilde", priority: 50 };

describe("rettighetsporten", () => {
  it("slipper gjennom en kilde som uttrykkelig tillater begge deler", () => {
    const a = archive({ ...base, automatedAccess: "allowed", publicRedistribution: "allowed" });
    expect(() => assertMayFetch(a, "kilde")).not.toThrow();
    expect(() => assertMayPublish(a, "kilde")).not.toThrow();
  });

  /**
   * Kjernen i hele opplegget: at noe kan hentes er ikke et argument for at det
   * kan publiseres. En adapter som virker teknisk er ikke en rettighetsavklaring.
   */
  it("skiller henting fra publisering", () => {
    const a = archive({
      ...base,
      automatedAccess: "allowed",
      publicRedistribution: "permission_required",
      permissionStatus: "pending",
    });
    expect(() => assertMayFetch(a, "kilde")).not.toThrow();
    expect(() => assertMayPublish(a, "kilde")).toThrow(SourcePolicyError);
  });

  it("regner «unknown» som nei, ikke som ja", () => {
    const a = archive({ ...base });
    expect(() => assertMayPublish(a, "kilde")).toThrow(/ikke avklart/i);
  });

  it("åpner når tillatelse faktisk er gitt", () => {
    const a = archive({
      ...base,
      publicRedistribution: "permission_required",
      permissionStatus: "granted",
    });
    expect(() => assertMayPublish(a, "kilde")).not.toThrow();
  });

  /**
   * En risikobeslutning er noe annet enn en tillatelse, men den er en beslutning
   * og skal virke. Skillet er at den nå ligger i et eget felt, og at feltet sier
   * hvem som bestemte og når.
   */
  const risk = {
    ingestDecision: "accepted_risk",
    riskAcceptedAt: "2026-08-03",
    riskAcceptedBy: "mlervaag",
    permissionNote: "Prosjekteier besluttet dette 2026-08-03.",
  };

  it("åpner ved registrert risikobeslutning", () => {
    const a = archive({ ...base, publicRedistribution: "permission_required", ...risk });
    expect(() => assertMayPublish(a, "kilde")).not.toThrow();
  });

  /**
   * Kombinasjonen issuen ba om: forespurt hos motparten, videreført av oss.
   * Den lot seg ikke uttrykke før, fordi ett felt bar begge deler.
   */
  it("lar en kilde være både forespurt og videreført på akseptert risiko", () => {
    const a = archive({
      ...base,
      publicRedistribution: "permission_required",
      permissionStatus: "requested",
      permissionRequestedAt: "2026-08-03",
      ...risk,
    });
    const parsed = a.sources[0]!;
    expect(parsed.permissionStatus).toBe("requested");
    expect(parsed.ingestDecision).toBe("accepted_risk");
    expect(() => assertMayPublish(a, "kilde")).not.toThrow();
  });

  it("krever navn og dato på en risikobeslutning", () => {
    expect(() => sourceSchema.parse({ ...base, ingestDecision: "accepted_risk" }))
      .toThrow(/riskAcceptedAt/);
    expect(() => sourceSchema.parse({
      ...base, ingestDecision: "accepted_risk",
      riskAcceptedAt: "2026-08-03", riskAcceptedBy: "mlervaag",
    })).toThrow(/permissionNote/);
  });

  it("krever dato når en forespørsel er sendt", () => {
    expect(() => sourceSchema.parse({ ...base, permissionStatus: "requested" }))
      .toThrow(/permissionRequestedAt/);
  });

  it("nekter å gå videre når motparten har sagt nei", () => {
    // Et avslag er et svar, ikke en avveining. Skjemaet avviser kombinasjonen
    // før den rekker å bli en gate-beslutning.
    expect(() => sourceSchema.parse({
      ...base, permissionStatus: "denied", ...risk,
    })).toThrow(/blocked/);
  });

  it("stenger uansett når publisering er uttrykkelig nektet", () => {
    const a = archive({ ...base, publicRedistribution: "denied", ...risk });
    expect(() => assertMayPublish(a, "kilde")).toThrow();
  });

  it("stenger når vi selv har blokkert kilden", () => {
    const a = archive({
      ...base, automatedAccess: "allowed", publicRedistribution: "allowed",
      ingestDecision: "blocked",
    });
    expect(() => assertMayFetch(a, "kilde")).toThrow();
    expect(() => assertMayPublish(a, "kilde")).toThrow();
  });

  it("stenger henting når kilden er blokkert", () => {
    const a = archive({ ...base, automatedAccess: "blocked", ...risk });
    expect(() => assertMayFetch(a, "kilde")).toThrow();
  });

  it("sier fra når kilden ikke er registrert i det hele tatt", () => {
    expect(() => assertMayPublish(archive(), "ukjent")).toThrow(/finnes ikke/i);
  });

  it("forklarer hva som mangler og hvor det står", () => {
    const a = archive({
      ...base,
      id: "rsssf",
      name: "RSSSF",
      publicRedistribution: "permission_required",
      permissionStatus: "pending",
      permissionNote: "Be lars@rsssf.no om skriftlig tillatelse.",
    });
    try {
      assertMayPublish(a, "rsssf");
      expect.unreachable("skulle kastet");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toMatch(/lars@rsssf\.no/);
      expect(message).toMatch(/data\/sources\/rsssf\.yaml/);
      // Tørrkjøring skal fortsatt være mulig, og meldingen skal si det.
      expect(message).toMatch(/Tørrkjøring virker fortsatt/);
    }
  });
});
