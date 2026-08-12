import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SITE_ORIGIN } from "../lib/site.js";
import {
  CONTRIBUTION_TEMPLATE_FIELDS,
  CONTRIBUTION_TEMPLATES,
  contributionIssueUrl,
  pageReference,
} from "../lib/contribution-links.js";

const TEMPLATE_DIR = resolve(process.cwd(), ".github", "ISSUE_TEMPLATE");

/** `id:`-verdiene i en mal, i den rekkefølgen de står. */
function templateFieldIds(template: string): string[] {
  const yaml = readFileSync(resolve(TEMPLATE_DIR, `${template}.yml`), "utf8");
  return [...yaml.matchAll(/^\s{4}id:\s*(\S+)\s*$/gm)].map((match) => match[1]!);
}

/** Feltene i en mal som er avkryssingsbokser, og som ikke kan forhåndsutfylles. */
function checkboxFieldIds(template: string): string[] {
  const yaml = readFileSync(resolve(TEMPLATE_DIR, `${template}.yml`), "utf8");
  return [...yaml.matchAll(/^\s{2}- type: checkboxes\n\s{4}id:\s*(\S+)\s*$/gm)].map((m) => m[1]!);
}

describe("contributionIssueUrl", () => {
  it("åpner den valgte issue-malen", () => {
    expect(contributionIssueUrl("datafeil"))
      .toBe("https://github.com/mlervaag/aafkstats/issues/new?template=datafeil.yml");
  });

  it("tar med sidekontekst i tittelen", () => {
    const url = new URL(contributionIssueUrl("ny-kilde", "AaFK mot Brann 1. april 2024"));
    expect(url.searchParams.get("template")).toBe("ny-kilde.yml");
    expect(url.searchParams.get("title")).toBe("Kilde: AaFK mot Brann 1. april 2024");
  });

  it("fyller ut feltene i malen, ikke bare tittelen", () => {
    const url = new URL(
      contributionIssueUrl("datafeil", "Georg Haller", {
        sted: pageReference("Georg Haller", "/personer/georg-haller"),
      }),
    );
    expect(url.searchParams.get("title")).toBe("Datafeil: Georg Haller");
    expect(url.searchParams.get("sted")).toBe("Georg Haller — /personer/georg-haller");
  });

  it("tar ikke med felt uten verdi", () => {
    // Et påkrevd felt som er fylt med tom streng ser utfylt ut, og skjuler at
    // det faktisk må fylles ut.
    const url = new URL(contributionIssueUrl("datafeil", "Noe", { sted: "", feil: "   " }));
    expect(url.searchParams.has("sted")).toBe(false);
    expect(url.searchParams.has("feil")).toBe(false);
  });

  /**
   * Den feilen som ellers ikke ville sagt fra.
   *
   * GitHub ignorerer en parameter som ikke treffer et felt, uten feilmelding.
   * Skrives feltnavnet feil, eller får feltet en ny `id` i malen, blir lenken
   * bare stående og fylle ut ingenting — og skjemaet ser ut som før. Testen
   * krysser feltlista mot YAML-filene, så begge retninger fanges.
   */
  it("kjenner nøyaktig de feltene malene faktisk har", () => {
    for (const template of CONTRIBUTION_TEMPLATES) {
      const inYaml = templateFieldIds(template).filter(
        (id) => !checkboxFieldIds(template).includes(id),
      );
      expect([...CONTRIBUTION_TEMPLATE_FIELDS[template]].sort(), template).toEqual(inYaml.sort());
    }
  });

  it("peker bare på issue-maler som finnes", () => {
    for (const template of CONTRIBUTION_TEMPLATES) {
      const path = resolve(process.cwd(), ".github", "ISSUE_TEMPLATE", `${template}.yml`);
      expect(existsSync(path), path).toBe(true);
    }
  });

  /**
   * Den andre veien, som er den som faktisk sviktet.
   *
   * `klubbidentitet` fantes som mal uten å være nevnt noe sted på nettstedet.
   * En bidragsyter som så en dublett i motstanderlista hadde ingen vei dit, og
   * ingenting sa fra: testen over var grønn hele tiden, fordi den bare sjekket
   * at lenkene vi hadde, pekte på noe.
   */
  it("lenker til hver mal som finnes", () => {
    const dir = resolve(process.cwd(), ".github", "ISSUE_TEMPLATE");
    const templates = readdirSync(dir)
      .filter((file) => file.endsWith(".yml") && file !== "config.yml")
      .map((file) => file.replace(/\.yml$/, ""));

    expect([...templates].sort()).toEqual([...CONTRIBUTION_TEMPLATES].sort());
  });
});

/**
 * Malene er tekst som leses av bidragsytere, og de peker på nettstedet.
 *
 * Da arkivet flyttet domene, ble `.yml`-filene stående igjen med det gamle: fem
 * maler ba folk lete på et domene som nå bare omdirigerer, og som ikke lenger er
 * navnet på arkivet. Ingenting sa fra, fordi ingen test leste dem.
 */
describe("malenes lenker til nettstedet", () => {
  const host = new URL(SITE_ORIGIN).host;

  it("bruker samme domene som nettstedet", () => {
    const files = readdirSync(TEMPLATE_DIR).filter((file) => file.endsWith(".yml"));
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const text = readFileSync(resolve(TEMPLATE_DIR, file), "utf8");
      // Alle vertsnavn som ser ut som arkivet selv, uansett om de står med
      // protokoll eller bare som «aafkarkivet.no» midt i en setning.
      for (const [, found] of text.matchAll(/\b([a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:no|app|com))\b/g)) {
        if (!/aafk/i.test(found)) continue;
        // github.com-lenker til repoet er ikke nettstedet.
        if (found.endsWith("github.com")) continue;
        expect(found, `${file} peker på ${found}`).toBe(host);
      }
    }
  });
});
