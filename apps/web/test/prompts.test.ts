import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { matchStatus, personRoleCategory } from "@aafkstats/schema";
import { loadValidateAndBuild } from "@aafkstats/db/build";
import { loadCompetitionIds } from "../lib/archive.js";
import { contributionPrompts } from "../lib/prompts.js";

const previousDbPath = process.env.AAFK_DB_PATH;

// Promptene leser konkurransene fra databasen. Testen bygger sin egen, som de
// andre web-testene, i stedet for å regne med at noen har kjørt db:build først —
// det var nettopp den antakelsen som gjorde at CI feilet der lokalt var grønt.
beforeAll(async () => {
  const dbPath = join(mkdtempSync(join(tmpdir(), "aafk-prompts-")), "archive.sqlite");
  await loadValidateAndBuild(resolve(import.meta.dirname, "../../../fixtures/data"), dbPath);
  process.env.AAFK_DB_PATH = dbPath;
});

afterAll(() => {
  if (previousDbPath === undefined) delete process.env.AAFK_DB_PATH;
  else process.env.AAFK_DB_PATH = previousDbPath;
});

/**
 * Bidragspromptene beskriver formatet en bidragsyter skal treffe. Er
 * beskrivelsen gal, lager bidragsyteren en fil valideringen avviser — og det er
 * den verst tenkelige feilen for en side som finnes for å senke terskelen.
 *
 * Det hadde skjedd to ganger da disse ble skrevet: `tredjedivisjon` kom inn med
 * RSSSF-innhøstingen uten å bli lagt til i lista, og `postponed` hadde vært i
 * `matchStatus` hele tiden uten å stå der. Begge lister genereres nå, og disse
 * testene fanger det hvis noen skriver dem av igjen.
 */
describe("bidragspromptene", () => {
  // Kalles inne i hver test, ikke på describe-nivå: databasen bygges i beforeAll,
  // og alt på describe-nivå kjører før den.
  const alt = () => contributionPrompts().map((p) => p.prompt).join("\n\n");

  it("lister hver status fra skjemaet", () => {
    for (const status of matchStatus.options) {
      expect(alt(), `status «${status}» mangler i promptene`).toContain(status);
    }
  });

  it("lister hver konkurranse som finnes i arkivet", () => {
    // Sammenlignes mot databasen, ikke mot en liste skrevet av her. En hardkodet
    // liste i testen ville hatt nøyaktig samme feil som den i prompten hadde.
    const ids = loadCompetitionIds();
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      expect(alt(), `konkurransen «${id}» mangler i promptene`).toContain(id);
    }
  });

  it("sier ikke lenger at arkivet er tynt før 2011", () => {
    // Sto der fra før RSSSF-innhøstingen. Kampryggraden rekker nå til 1917, og
    // en bidragsyter som tror alt før 2011 mangler leter feil sted.
    const all = contributionPrompts().map((p) => `${p.description} ${p.prompt}`).join("\n");
    expect(all).not.toMatch(/tynt før 2011/);
    expect(all).not.toContain("tilbake til 1917");
    expect(all).toContain("tilbake til 1998");
  });

  it("krever kildeføring i promptene som lager datafiler", () => {
    // Promptene som produserer YAML må skille nettkilder i providers[] fra
    // registrerte arkivdokumenter i sources[]. Uten det validerer ikke filene.
    for (const id of ["ny-kamp", "detaljer", "personrolle"]) {
      const prompt = contributionPrompts().find((p) => p.id === id);
      expect(prompt, `prompten «${id}» finnes ikke lenger`).toBeDefined();
      expect(prompt!.prompt, `«${id}» mangler kravet om sources[]`).toMatch(/sources\[\]/);
      if (id !== "personrolle") {
        expect(prompt!.prompt, `«${id}» mangler riktig format for nettkilder`).toMatch(/providers\[\]/);
      }
    }
  });

  it("lister hver gyldige personrollekategori", () => {
    const prompt = contributionPrompts().find((p) => p.id === "personrolle");
    expect(prompt).toBeDefined();
    for (const category of personRoleCategory.options) {
      expect(prompt!.prompt, `rollekategorien «${category}» mangler`).toContain(category);
    }
  });

  it("forbyr kopiert tekst i referatprompten", () => {
    // Referatet er det eneste bidraget som er fritekst, og dermed det eneste som
    // kan bryte opphavsretten. Regelen må stå der uansett hvordan prompten ellers
    // skrives om.
    const referat = contributionPrompts().find((p) => p.id === "referat");
    expect(referat).toBeDefined();
    expect(referat!.prompt).toMatch(/ikke\s+kopiere/);
    expect(referat!.prompt).toMatch(/Fakta er frie\. Tekst er det ikke\./);
  });
});
