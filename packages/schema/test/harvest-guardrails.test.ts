import { describe, it, expect } from "vitest";
import {
  diffStructuralAdditivity,
  runArchivePreservationAudit,
} from "../src/historical/archive-preservation.js";
import {
  resolveAuthorizedExceptions,
  preservationExceptionKey,
  type PreservationException,
} from "../src/preservation-exceptions.js";
import { auditSourceInventory } from "../src/historical/source-inventory.js";
import { markdownV1Parser } from "../src/historical/review-parser.js";
import {
  collectAttributedAdditions,
  findUnaccountedAdditions,
} from "../src/historical/harvest-attribution.js";
import type { Person } from "../src/person.js";
import type { HarvestFinding } from "../src/historical/harvest-finding.js";

describe("Strukturell additivitet i arkivet", () => {
  it("godtar berikelse: nye felter, nye listeelementer og utfylte tomme verdier", () => {
    const base = { id: "a", title: "Kamp", sources: [{ sourceId: "s1", page: "4" }], note: "" };
    const head = {
      id: "a",
      title: "Kamp",
      sources: [
        { sourceId: "s1", page: "4" },
        { sourceId: "s2", page: "9" },
      ],
      note: "Nå utfylt",
      venue: "Kråmyra",
    };

    expect(diffStructuralAdditivity(base, head, "")).toHaveLength(0);
  });

  it("fanger fjernet listeelement, endret skalar og tømt felt", () => {
    const base = {
      id: "a",
      title: "Kamp",
      sources: [
        { sourceId: "s1", page: "4" },
        { sourceId: "s2", page: "9" },
      ],
    };
    const head = { id: "a", title: "Trening", sources: [{ sourceId: "s1", page: "4" }] };

    const removals = diffStructuralAdditivity(base, head, "");

    expect(removals).toHaveLength(2);
    expect(removals.map((r) => r.changeType).sort()).toEqual(["mutate", "remove"]);
    expect(removals.some((r) => r.path.includes("s2"))).toBe(true);
  });

  it("skiller to kildereferanser til samme kilde på ulike sider", () => {
    const base = {
      sources: [
        { sourceId: "s1", page: "4" },
        { sourceId: "s1", page: "66" },
      ],
    };
    const head = { sources: [{ sourceId: "s1", page: "4" }] };

    const removals = diffStructuralAdditivity(base, head, "");

    expect(removals).toHaveLength(1);
    expect(removals[0]?.path).toContain("s1:66");
  });

  it("melder sletting av en hel entitet som destruktiv", () => {
    const result = runArchivePreservationAudit([
      {
        domain: "source_result",
        base: new Map([["sr-1", { sourceId: "sr-1", seasons: [] }]]),
        head: new Map(),
      },
    ]);

    expect(result.destructiveChanges).toBe(1);
    expect(result.filesDeleted).toBe(1);
    expect(result.changes[0]?.entity).toBe("source_result");
  });

  it("lar et godkjent unntak dekke nøyaktig den ene endringen det gjelder", () => {
    const exception: PreservationException = {
      entity: "source_result",
      id: "sr-1",
      path: "file",
      change: "delete_file",
      reason: "Kilden viste seg å være en dublett av sr-2, dokumentert i PR #200.",
      sources: [],
    };

    const result = runArchivePreservationAudit(
      [
        {
          domain: "source_result",
          base: new Map([
            ["sr-1", { sourceId: "sr-1", seasons: [] }],
            ["sr-2", { sourceId: "sr-2", seasons: [] }],
          ]),
          head: new Map([["sr-2", { sourceId: "sr-2", seasons: [] }]]),
        },
      ],
      [exception],
    );

    expect(result.destructiveChanges).toBe(0);
    expect(result.approvedExceptions).toBe(1);
  });
});

describe("Unntak kan ikke godkjennes av endringen som bruker dem", () => {
  const exception: PreservationException = {
    entity: "person",
    id: "lauritz-giske",
    path: "roles/formann-1924",
    change: "remove",
    reason: "Rollen tilhørte feil person, bekreftet mot faksimile side 12.",
    sources: [],
  };

  it("regner et unntak som fantes i BASE som godkjent", () => {
    const result = resolveAuthorizedExceptions([exception], [exception]);
    expect(result.authorized).toHaveLength(1);
    expect(result.selfApproved).toHaveLength(0);
  });

  it("regner et unntak som først dukker opp i HEAD som selvgodkjent", () => {
    const result = resolveAuthorizedExceptions([], [exception]);
    expect(result.authorized).toHaveLength(0);
    expect(result.selfApproved).toHaveLength(1);
  });

  it("lar begrunnelsen endres uten at dispensasjonen regnes som en ny", () => {
    const reworded = { ...exception, reason: "Omformulert begrunnelse, samme dispensasjon." };
    const result = resolveAuthorizedExceptions([exception], [reworded]);
    expect(result.authorized).toHaveLength(1);
    expect(result.selfApproved).toHaveLength(0);
  });

  it("skiller unntak som gjelder ulik sti eller endringstype", () => {
    const otherPath = { ...exception, path: "roles/kasserer-1930" };
    expect(preservationExceptionKey(exception)).not.toBe(preservationExceptionKey(otherPath));
    expect(resolveAuthorizedExceptions([exception], [otherPath]).selfApproved).toHaveLength(1);
  });
});

describe("Tomt utvalg er ikke en bestått audit", () => {
  it("feiler når scope ikke traff en eneste kilde", () => {
    const result = auditSourceInventory(
      new Map(),
      new Map(),
      new Map(),
      new Map(),
      { parentSourceId: "skrivefeil-i-kildenavnet", requireCompleteReview: true },
    );

    expect(result.summary.inScope).toBe(0);
    expect(result.scopeIsEmpty).toBe(true);
    expect(result.allSourcesPassed).toBe(false);
  });
});

describe("Review-parseren", () => {
  it("lar seg ikke slå av ved å nevne parserens egne konstanter", () => {
    const doc = [
      "# Review",
      "",
      "Denne linjen nevner APPROVED_DISPOSITIONS og inneholder <PLACEHOLDER>.",
    ].join("\n");

    const result = markdownV1Parser.parseReview(doc);

    expect(result.placeholdersFound.length).toBeGreaterThan(0);
    expect(result.passed).toBe(false);
  });

  it("summerer sidekontroll over alle årganger i stedet for bare den første", () => {
    const doc = [
      "# Review",
      "",
      "Sidekontroll 1961: 40/40",
      "Sidekontroll 1962: 10/62",
    ].join("\n");

    const result = markdownV1Parser.parseReview(doc);

    expect(result.pagesReviewedClaim).toEqual({ reviewed: 50, total: 102, isFull: false });
    expect(result.passed).toBe(false);
  });

  it("finner kildekolonnen når overskriften har en presisering", () => {
    const doc = [
      "| Kilde (sourceId) | Disposisjon / handling |",
      "|---|---|",
      "| medlemsblad-1962 | `reviewed` |",
    ].join("\n");

    const result = markdownV1Parser.parseReview(doc, {
      knownSourceIds: new Set(["medlemsblad-1962"]),
    });

    expect(result.sourceIdsFound).toEqual(["medlemsblad-1962"]);
    expect(result.sourceReviewStatuses.get("medlemsblad-1962")).toBe("reviewed");
    expect(result.issues).toHaveLength(0);
  });

  it("godtar en disposisjon med forklarende parentes", () => {
    const doc = [
      "| SourceId | Disposisjon |",
      "|---|---|",
      "| medlemsblad-1962 | `reviewed` (kontrollert mot faksimile) |",
    ].join("\n");

    const result = markdownV1Parser.parseReview(doc, {
      knownSourceIds: new Set(["medlemsblad-1962"]),
    });

    expect(result.issues.filter((i) => i.type === "invalid_disposition")).toHaveLength(0);
    expect(result.dispositionsFound).toContain("reviewed");
  });

  it("forkaster ikke en ugyldig kilde-ID i stillhet", () => {
    const doc = [
      "| SourceId | Disposisjon |",
      "|---|---|",
      "| AaFK Medlemsblad 1962 | `reviewed` |",
    ].join("\n");

    const result = markdownV1Parser.parseReview(doc, {
      knownSourceIds: new Set(["medlemsblad-1962"]),
    });

    expect(result.issues.some((i) => i.type === "unknown_source")).toBe(true);
    expect(result.passed).toBe(false);
  });
});

describe("Tilskriving av nye opplysninger til en batch", () => {
  function personWithRole(sourceId: string): Person {
    return {
      id: "lauritz-giske",
      name: "Lauritz Giske",
      names: [],
      squadNumbers: [],
      coachSpells: [],
      roles: [
        {
          id: "formann-1953",
          category: "board",
          title: "Formann",
          from: "1953",
          to: "1953",
          sources: [{ sourceId, page: "12", fields: ["roles"] }],
        },
      ],
      providers: [],
      sources: [{ sourceId, page: "12", fields: ["roles"] }],
      conflicts: [],
    };
  }

  const emptyArchive = {
    people: new Map<string, Person>(),
    sourceResults: new Map(),
    matches: new Map(),
    observations: new Map(),
    snapshots: new Map(),
  };

  it("fanger en ny person og rolle som siterer batchens kilde", () => {
    const additions = collectAttributedAdditions(
      new Set(["medlemsblad-1953"]),
      emptyArchive,
      { ...emptyArchive, people: new Map([["lauritz-giske", personWithRole("medlemsblad-1953")]]) },
    );

    expect(additions).toHaveLength(2);
    expect(additions.map((a) => a.path ?? "(hele entiteten)").sort()).toEqual([
      "(hele entiteten)",
      "roles/formann-1953",
    ]);
  });

  it("ignorerer data som siterer en kilde utenfor batchen", () => {
    const additions = collectAttributedAdditions(
      new Set(["medlemsblad-1953"]),
      emptyArchive,
      { ...emptyArchive, people: new Map([["lauritz-giske", personWithRole("en-annen-kilde")]]) },
    );

    expect(additions).toHaveLength(0);
  });

  it("lar et rollefunn stå inne for personfilen, men ikke for andre roller", () => {
    const additions = collectAttributedAdditions(
      new Set(["medlemsblad-1953"]),
      emptyArchive,
      { ...emptyArchive, people: new Map([["lauritz-giske", personWithRole("medlemsblad-1953")]]) },
    );

    const roleFinding: HarvestFinding = {
      id: "f-1",
      source: { sourceId: "medlemsblad-1953", page: 12 },
      type: "person_role",
      claim: { text: "Formann" },
      disposition: "role_created",
      targets: [{ entity: "person", id: "lauritz-giske", path: "roles/formann-1953" }],
      status: "normalized",
      notes: [],
      sources: [],
    };

    expect(findUnaccountedAdditions(additions, [roleFinding])).toHaveLength(0);

    const unrelatedRole = { ...additions[0]!, path: "roles/kasserer-1954" };
    expect(findUnaccountedAdditions([unrelatedRole], [roleFinding])).toHaveLength(1);
  });
});
