import { describe, expect, it } from "vitest";
import { matchStatus } from "@aafkstats/schema";
import { contributionPrompts } from "../lib/prompts.js";

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
  const alt = contributionPrompts.map((p) => p.prompt).join("\n\n");

  it("lister hver status fra skjemaet", () => {
    for (const status of matchStatus.options) {
      expect(alt, `status «${status}» mangler i promptene`).toContain(status);
    }
  });

  it("lister konkurransene som faktisk finnes i arkivet", () => {
    // Hentes fra databasen, ikke fra en håndskrevet liste. Kommer det en ny
    // konkurranse inn med en innhøsting, står den her uten at noen gjør noe.
    for (const id of ["eliteserien", "forstedivisjon", "nm", "tredjedivisjon", "treningskamp"]) {
      expect(alt, `konkurransen «${id}» mangler i promptene`).toContain(id);
    }
  });

  it("sier ikke lenger at arkivet er tynt før 2011", () => {
    // Sto der fra før RSSSF-innhøstingen. Kampryggraden rekker nå til 1917, og
    // en bidragsyter som tror alt før 2011 mangler leter feil sted.
    const all = contributionPrompts.map((p) => `${p.description} ${p.prompt}`).join("\n");
    expect(all).not.toMatch(/tynt før 2011/);
  });

  it("krever kildeføring i promptene som lager datafiler", () => {
    // De to som produserer YAML må be om sources[]. Uten det kommer bidrag inn
    // uten opphav, og hele etterprøvbarheten faller.
    for (const id of ["ny-kamp", "detaljer"]) {
      const prompt = contributionPrompts.find((p) => p.id === id);
      expect(prompt, `prompten «${id}» finnes ikke lenger`).toBeDefined();
      expect(prompt!.prompt, `«${id}» mangler kravet om sources[]`).toMatch(/sources\[\]/);
    }
  });

  it("forbyr kopiert tekst i referatprompten", () => {
    // Referatet er det eneste bidraget som er fritekst, og dermed det eneste som
    // kan bryte opphavsretten. Regelen må stå der uansett hvordan prompten ellers
    // skrives om.
    const referat = contributionPrompts.find((p) => p.id === "referat");
    expect(referat).toBeDefined();
    expect(referat!.prompt).toMatch(/ikke\s+kopiere/);
    expect(referat!.prompt).toMatch(/Fakta er frie\. Tekst er det ikke\./);
  });
});
