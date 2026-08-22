import { describe, it, expect } from "vitest";
import {
  runArchivePreservationAudit,
  verifySourceResultMigration,
  type ArchivePreservationInput,
  type CoordinateMigrationManifest,
} from "../src/historical/archive-preservation.js";

describe("Source Coordinate Migration Preservation - Tests P1 to P10", () => {
  const sampleBaseSource = {
    sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9",
    seasons: [
      {
        year: 1954,
        results: [{ no: 1, opponent: "Rollon", score: [1, 0], page: 14, note: "Vår" }],
      },
      {
        year: 1955,
        results: [
          { no: 1, opponent: "Guard", score: [2, 0], page: 14, note: "ÅFK jubileum", opponentClubId: "guard" },
          { no: 24, opponent: "Aksla", score: [6, 2], page: 14, note: "Høst", opponentClubId: "aksla" },
        ],
      },
    ],
  };

  // TEST P1: Legitim coordinate move godtas
  it("TEST P1: legitim coordinate move godtas som APPROVED_COORDINATE_MIGRATION uten destructive changes", () => {
    const headSource = {
      sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9",
      seasons: [
        {
          year: 1954,
          results: [
            { no: 1, opponent: "Rollon", score: [1, 0], page: 14, note: "Vår" },
            { no: 10, opponent: "Guard", score: [2, 0], page: 14, note: "ÅFK jubileum", opponentClubId: "guard" },
          ],
        },
        {
          year: 1955,
          results: [
            { no: 1, opponent: "Aksla", score: [6, 2], page: 14, note: "Høst", opponentClubId: "aksla" },
          ],
        },
      ],
    };

    const manifest: CoordinateMigrationManifest = {
      contract: "source-coordinate-migration@1",
      movedItems: [
        {
          oldCoordinate: { sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9", season: 1955, no: 1 },
          newCoordinate: { sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9", season: 1954, no: 10 },
          claim: { opponent: "Guard", score: [2, 0], page: 14, note: "ÅFK jubileum" },
        },
      ],
      renumberedItems: [
        {
          oldCoordinate: { sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9", season: 1955, no: 24 },
          newCoordinate: { sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9", season: 1955, no: 1 },
          claim: { opponent: "Aksla", score: [6, 2], page: 14, note: "Høst" },
        },
      ],
    };

    const input: ArchivePreservationInput = {
      domain: "source_result",
      base: new Map([["medlemsblad-for-aalesunds-fotb-1965-a2c9", sampleBaseSource]]),
      head: new Map([["medlemsblad-for-aalesunds-fotb-1965-a2c9", headSource]]),
    };

    const res = runArchivePreservationAudit([input], [], [manifest]);
    expect(res.destructiveChanges).toBe(0);
    expect(res.approvedCoordinateMigrations).toBe(2);
    expect(res.changes.every((c) => c.status === "APPROVED_COORDINATE_MIGRATION")).toBe(true);
  });

  // TEST P2: Move uten manifest blokkeres
  it("TEST P2: flytting uten deklarert manifest blokkeres som DESTRUCTIVE_CHANGE", () => {
    const headSource = {
      sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9",
      seasons: [
        {
          year: 1954,
          results: [
            { no: 1, opponent: "Rollon", score: [1, 0], page: 14, note: "Vår" },
            { no: 10, opponent: "Guard", score: [2, 0], page: 14, note: "ÅFK jubileum", opponentClubId: "guard" },
          ],
        },
        {
          year: 1955,
          results: [
            { no: 1, opponent: "Aksla", score: [6, 2], page: 14, note: "Høst", opponentClubId: "aksla" },
          ],
        },
      ],
    };

    const input: ArchivePreservationInput = {
      domain: "source_result",
      base: new Map([["medlemsblad-for-aalesunds-fotb-1965-a2c9", sampleBaseSource]]),
      head: new Map([["medlemsblad-for-aalesunds-fotb-1965-a2c9", headSource]]),
    };

    // No migration manifest passed
    const res = runArchivePreservationAudit([input], [], []);
    expect(res.destructiveChanges).toBeGreaterThan(0);
    expect(res.approvedCoordinateMigrations).toBe(0);
  });

  // TEST P3: Opponent endres under migration
  it("TEST P3: endring av opponent under migration avvises som DESTRUCTIVE_CHANGE", () => {
    const headSource = {
      sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9",
      seasons: [
        {
          year: 1954,
          results: [
            { no: 1, opponent: "Rollon", score: [1, 0], page: 14, note: "Vår" },
            { no: 10, opponent: "Aksla", score: [2, 0], page: 14, note: "ÅFK jubileum" }, // Opponent changed to Aksla
          ],
        },
        {
          year: 1955,
          results: [
            { no: 1, opponent: "Aksla", score: [6, 2], page: 14, note: "Høst" },
          ],
        },
      ],
    };

    const manifest: CoordinateMigrationManifest = {
      contract: "source-coordinate-migration@1",
      movedItems: [
        {
          oldCoordinate: { sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9", season: 1955, no: 1 },
          newCoordinate: { sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9", season: 1954, no: 10 },
          claim: { opponent: "Guard", score: [2, 0] },
        },
      ],
      renumberedItems: [
        {
          oldCoordinate: { sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9", season: 1955, no: 24 },
          newCoordinate: { sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9", season: 1955, no: 1 },
          claim: { opponent: "Aksla", score: [6, 2] },
        },
      ],
    };

    const vRes = verifySourceResultMigration(manifest, sampleBaseSource, headSource);
    expect(vRes.valid).toBe(false);
    expect(vRes.error).toContain("Opponent mismatch");

    const input: ArchivePreservationInput = {
      domain: "source_result",
      base: new Map([["medlemsblad-for-aalesunds-fotb-1965-a2c9", sampleBaseSource]]),
      head: new Map([["medlemsblad-for-aalesunds-fotb-1965-a2c9", headSource]]),
    };
    const res = runArchivePreservationAudit([input], [], [manifest]);
    expect(res.destructiveChanges).toBeGreaterThan(0);
  });

  // TEST P4: Score endres under migration
  it("TEST P4: endring av score under migration avvises som DESTRUCTIVE_CHANGE", () => {
    const headSource = {
      sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9",
      seasons: [
        {
          year: 1954,
          results: [
            { no: 1, opponent: "Rollon", score: [1, 0], page: 14, note: "Vår" },
            { no: 10, opponent: "Guard", score: [3, 0], page: 14, note: "ÅFK jubileum" }, // Score changed to 3-0
          ],
        },
        {
          year: 1955,
          results: [
            { no: 1, opponent: "Aksla", score: [6, 2], page: 14, note: "Høst" },
          ],
        },
      ],
    };

    const manifest: CoordinateMigrationManifest = {
      contract: "source-coordinate-migration@1",
      movedItems: [
        {
          oldCoordinate: { sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9", season: 1955, no: 1 },
          newCoordinate: { sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9", season: 1954, no: 10 },
          claim: { opponent: "Guard", score: [2, 0] },
        },
      ],
    };

    const vRes = verifySourceResultMigration(manifest, sampleBaseSource, headSource);
    expect(vRes.valid).toBe(false);
    expect(vRes.error).toContain("Score mismatch");
  });

  // TEST P5: Claim forsvinner (destination mangler i HEAD)
  it("TEST P5: deklarert migrasjonsdestinasjon som mangler i HEAD avvises", () => {
    const headSource = {
      sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9",
      seasons: [
        {
          year: 1954,
          results: [
            { no: 1, opponent: "Rollon", score: [1, 0], page: 14, note: "Vår" },
            // no: 10 is missing!
          ],
        },
        {
          year: 1955,
          results: [
            { no: 1, opponent: "Aksla", score: [6, 2], page: 14, note: "Høst" },
          ],
        },
      ],
    };

    const manifest: CoordinateMigrationManifest = {
      contract: "source-coordinate-migration@1",
      movedItems: [
        {
          oldCoordinate: { sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9", season: 1955, no: 1 },
          newCoordinate: { sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9", season: 1954, no: 10 },
        },
      ],
    };

    const vRes = verifySourceResultMigration(manifest, sampleBaseSource, headSource);
    expect(vRes.valid).toBe(false);
  });

  // TEST P6: Claim dupliseres (én old peker til to new)
  it("TEST P6: én gammel koordinat som peker til to nye koordinater avvises", () => {
    const manifest: CoordinateMigrationManifest = {
      contract: "source-coordinate-migration@1",
      movedItems: [
        {
          oldCoordinate: { sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9", season: 1955, no: 1 },
          newCoordinate: { sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9", season: 1954, no: 10 },
        },
        {
          oldCoordinate: { sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9", season: 1955, no: 1 },
          newCoordinate: { sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9", season: 1954, no: 11 },
        },
      ],
    };

    const vRes = verifySourceResultMigration(manifest, sampleBaseSource, sampleBaseSource);
    expect(vRes.valid).toBe(false);
    expect(vRes.error).toContain("Duplicate oldCoordinate");
  });

  // TEST P7: To old coordinates peker til samme new coordinate
  it("TEST P7: to gamle koordinater som peker til samme nye koordinat avvises", () => {
    const manifest: CoordinateMigrationManifest = {
      contract: "source-coordinate-migration@1",
      movedItems: [
        {
          oldCoordinate: { sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9", season: 1955, no: 1 },
          newCoordinate: { sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9", season: 1954, no: 10 },
        },
        {
          oldCoordinate: { sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9", season: 1955, no: 2 },
          newCoordinate: { sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9", season: 1954, no: 10 },
        },
      ],
    };

    const vRes = verifySourceResultMigration(manifest, sampleBaseSource, sampleBaseSource);
    expect(vRes.valid).toBe(false);
    expect(vRes.error).toContain("Duplicate newCoordinate");
  });

  // TEST P8: Antall reduseres (1777 -> 1776)
  it("TEST P8: reduksjon i totalt antall kildepåstander avvises som ulovlig migrering", () => {
    const headSource = {
      sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9",
      seasons: [
        {
          year: 1954,
          results: [{ no: 1, opponent: "Rollon", score: [1, 0], page: 14 }],
        },
        {
          year: 1955,
          results: [{ no: 1, opponent: "Aksla", score: [6, 2], page: 14 }],
        },
      ],
    };

    const manifest: CoordinateMigrationManifest = {
      contract: "source-coordinate-migration@1",
      renumberedItems: [
        {
          oldCoordinate: { sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9", season: 1955, no: 24 },
          newCoordinate: { sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9", season: 1955, no: 1 },
        },
      ],
    };

    const vRes = verifySourceResultMigration(manifest, sampleBaseSource, headSource);
    expect(vRes.valid).toBe(false);
    expect(vRes.error).toContain("Total claims count changed");
  });

  // TEST P9: Antall økes uten eksplisitt ren migrering
  it("TEST P9: endring i totalantall godkjennes ikke som ren koordinatmigrering", () => {
    const headSource = {
      sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9",
      seasons: [
        {
          year: 1954,
          results: [
            { no: 1, opponent: "Rollon", score: [1, 0], page: 14 },
            { no: 2, opponent: "Vito", score: [3, 1], page: 14 },
            { no: 10, opponent: "Guard", score: [2, 0], page: 14 },
          ],
        },
        {
          year: 1955,
          results: [{ no: 1, opponent: "Aksla", score: [6, 2], page: 14 }],
        },
      ],
    };

    const manifest: CoordinateMigrationManifest = {
      contract: "source-coordinate-migration@1",
      movedItems: [
        {
          oldCoordinate: { sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9", season: 1955, no: 1 },
          newCoordinate: { sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9", season: 1954, no: 10 },
        },
      ],
    };

    const vRes = verifySourceResultMigration(manifest, sampleBaseSource, headSource);
    expect(vRes.valid).toBe(false);
    expect(vRes.error).toContain("Total claims count changed");
  });

  // TEST P10: Renumbering innen samme år godtas når payload er identisk
  it("TEST P10: renummerering innen samme år godtas som APPROVED_COORDINATE_MIGRATION", () => {
    const headSource = {
      sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9",
      seasons: [
        {
          year: 1954,
          results: [{ no: 1, opponent: "Rollon", score: [1, 0], page: 14, note: "Vår" }],
        },
        {
          year: 1955,
          results: [
            { no: 1, opponent: "Guard", score: [2, 0], page: 14, note: "ÅFK jubileum", opponentClubId: "guard" },
            { no: 2, opponent: "Aksla", score: [6, 2], page: 14, note: "Høst", opponentClubId: "aksla" }, // renumbered 24 -> 2
          ],
        },
      ],
    };

    const manifest: CoordinateMigrationManifest = {
      contract: "source-coordinate-migration@1",
      renumberedItems: [
        {
          oldCoordinate: { sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9", season: 1955, no: 24 },
          newCoordinate: { sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9", season: 1955, no: 2 },
          claim: { opponent: "Aksla", score: [6, 2], page: 14, note: "Høst" },
        },
      ],
    };

    const vRes = verifySourceResultMigration(manifest, sampleBaseSource, headSource);
    expect(vRes.valid).toBe(true);

    const input: ArchivePreservationInput = {
      domain: "source_result",
      base: new Map([["medlemsblad-for-aalesunds-fotb-1965-a2c9", sampleBaseSource]]),
      head: new Map([["medlemsblad-for-aalesunds-fotb-1965-a2c9", headSource]]),
    };
    const res = runArchivePreservationAudit([input], [], [manifest]);
    expect(res.destructiveChanges).toBe(0);
    expect(res.approvedCoordinateMigrations).toBe(1);
  });
});
