import { describe, expect, it } from "vitest";
import { accessNote, newspaperPageUrl, readAccess } from "../src/adapters/nb-newspaper-access.js";

/** Slik NB svarer for Søndmørsposten/Sunnmørsposten til og med 1935. */
const OPEN = { viewability: "ALL", accessAllowedFrom: "EVERYWHERE", license: "ccbyncnd", isPublicDomain: false, isDigital: true };
/** Slik NB svarer fra 1936 og fram til i dag. */
const CLOSED = {
  viewability: "NONE",
  accessAllowedFrom: "NB",
  license: "copyrighted",
  isPublicDomain: false,
  isDigital: true,
  legalDepositLoginText: "4 lisenser for Feide-brukere ved norske universitet og høyskoler.",
};

describe("readAccess", () => {
  it("åpner for lagring av hele teksten når alle slipper inn", () => {
    const access = readAccess(OPEN, "Søndmørsposten", "19200612");
    expect(access.mayStoreFullText).toBe(true);
    expect(access.attribution).toBe("Søndmørsposten 12.06.1920, Nasjonalbiblioteket (CC BY-NC-ND)");
  });

  it("stenger for lagring av teksten når utgaven krever innlogging", () => {
    const access = readAccess(CLOSED, "Sunnmørsposten", "19760630");
    expect(access.mayStoreFullText).toBe(false);
    expect(access.loginText).toContain("Feide");
    expect(access.attribution).toContain("opphavsrettsbeskyttet");
  });

  /**
   * Samme regel som resten av innhøstingen: `unknown` er aldri et ja. Mangler
   * opplysningen, lagres ikke teksten.
   */
  it("regner manglende opplysning som stengt", () => {
    expect(readAccess(undefined, "Sunnmørsposten", "19760630").mayStoreFullText).toBe(false);
    expect(readAccess({ viewability: "ALL", accessAllowedFrom: "LIBRARY" }, "Sunnmørsposten", "19860609").mayStoreFullText).toBe(false);
  });
});

describe("accessNote", () => {
  it("sier hva leseren kan gjøre, på begge sider av skillet", () => {
    expect(accessNote(readAccess(OPEN, "Søndmørsposten", "19200612")))
      .toBe("Fritt tilgjengelig hos Nasjonalbiblioteket. Søndmørsposten 12.06.1920, Nasjonalbiblioteket (CC BY-NC-ND)");
    expect(accessNote(readAccess(CLOSED, "Sunnmørsposten", "19760630")))
      .toContain("Krever innlogging eller besøk hos Nasjonalbiblioteket. 4 lisenser for Feide-brukere");
  });
});

describe("newspaperPageUrl", () => {
  /** For en stengt årgang er lenka alt leseren får. Da må den treffe siden. */
  it("peker på siden når sidetallet er kjent", () => {
    expect(newspaperPageUrl("abc123", "6")).toBe("https://www.nb.no/items/abc123?page=6");
  });

  it("faller tilbake til utgaven uten brukbart sidetall", () => {
    expect(newspaperPageUrl("abc123")).toBe("https://www.nb.no/items/abc123");
    expect(newspaperPageUrl("abc123", "forside")).toBe("https://www.nb.no/items/abc123");
  });
});
