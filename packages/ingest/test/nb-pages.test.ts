import { describe, expect, it } from "vitest";
import { detectColumns, joinLines, parseAltoWords, readPageColumns, readPageText } from "../src/adapters/nb-pages.js";

/**
 * Fixturene er skrevet her, ikke hentet fra en publikasjon. Rå OCR fra
 * Nasjonalbiblioteket skal ikke ligge i repoet, og en oppdiktet side tester
 * mekanismen like godt som en ekte.
 */

interface Word { text: string; x: number; y: number; width?: number }

function alto(words: Word[]): string {
  const strings = words
    .map((word, index) =>
      `<String ID="S${index}" HPOS="${word.x}" VPOS="${word.y}" WIDTH="${word.width ?? word.text.length * 12}" HEIGHT="22" CONTENT="${word.text}"/>`)
    .join("");
  return `<?xml version="1.0"?><alto><Layout><Page><PrintSpace><TextBlock><TextLine>${strings}</TextLine></TextBlock></PrintSpace></Page></Layout></alto>`;
}

/**
 * To spalter med en renne mellom seg, satt opp som en boksside: ordene ligger
 * etter hverandre med en vanlig ordluke, og spaltene skilles av noe langt
 * bredere enn den luka.
 */
function column(text: string, left: number, top: number, width: number): Word[] {
  const words: Word[] = [];
  let x = left;
  let y = top;
  for (const token of text.split(" ")) {
    const size = token.length * 12;
    if (x + size > left + width) { x = left; y += 40; }
    words.push({ text: token, x, y, width: size });
    x += size + 18;
  }
  return words;
}

function twoColumnPage(): string {
  return alto([
    ...column("Klubben holdt sitt årsmøte i gymnastikksalen denne kvelden", 300, 200, 460),
    ...column("Formann, Ola Nordmann, nestformann, Kari Nordmann", 900, 200, 460),
  ]);
}

describe("parseAltoWords", () => {
  it("setter delte ord sammen igjen fra SUBS_CONTENT", () => {
    const xml = `<alto><String HPOS="10" VPOS="10" WIDTH="40" HEIGHT="20" CONTENT="nestfor" SUBS_TYPE="HypPart1" SUBS_CONTENT="nestformann"/>`
      + `<String HPOS="10" VPOS="40" WIDTH="40" HEIGHT="20" CONTENT="mann" SUBS_TYPE="HypPart2" SUBS_CONTENT="nestformann"/></alto>`;
    expect(parseAltoWords(xml).map((word) => word.text)).toEqual(["nestformann"]);
  });

  it("hopper over ord uten innhold eller uten koordinat", () => {
    const xml = `<alto><String HPOS="10" VPOS="10" CONTENT=""/><String CONTENT="Ola"/><String HPOS="10" VPOS="10" CONTENT="Kari"/></alto>`;
    expect(parseAltoWords(xml).map((word) => word.text)).toEqual(["Kari"]);
  });
});

describe("detectColumns", () => {
  it("finner rennen mellom to spalter", () => {
    const columns = detectColumns(parseAltoWords(twoColumnPage()));
    expect(columns).toHaveLength(2);
    expect(columns[0]!.to).toBeLessThan(columns[1]!.from);
  });

  it("lar en enspaltet side være i fred", () => {
    const words = parseAltoWords(alto(column("Ett sammenhengende avsnitt uten noen renne i seg", 300, 100, 900)));
    expect(detectColumns(words)).toHaveLength(1);
  });

  it("deler ikke på mellomrommet mellom to ord", () => {
    // Ordmellomrom er titalls enheter; en renne er hundretalls. Uten
    // minstebredden ville hver eneste ordluke blitt en spaltegrense.
    const words = parseAltoWords(alto(column("Ola Nordmann satt som formann i klubben", 300, 100, 900)));
    expect(detectColumns(words)).toHaveLength(1);
  });
});

describe("readPageColumns", () => {
  /**
   * Kjernen i hele andre gjennomgang. Med linjevis lesing blir «gymnastikksalen»
   * og «Formann, Ola Nordmann» én setning, og rolleordet får navnet fra en
   * annen spalte. Slik ble Einar Helseth sekretær i kandidatlaget, når siden
   * sier nestformann.
   */
  it("holder spaltene fra hverandre selv om OCR-en la dem i samme linje", () => {
    const columns = readPageColumns(twoColumnPage());
    expect(columns).toHaveLength(2);
    expect(columns[0]!.lines.join(" ")).toContain("årsmøte");
    expect(columns[0]!.lines.join(" ")).not.toContain("Formann");
    expect(columns[1]!.lines.join(" ")).toContain("Formann");
    expect(columns[1]!.lines.join(" ")).not.toContain("årsmøte");
  });

  it("gir hver spalte som egen tekst", () => {
    const texts = readPageText(twoColumnPage());
    expect(texts).toHaveLength(2);
    expect(texts[1]).toBe("Formann, Ola Nordmann, nestformann, Kari Nordmann");
  });
});

describe("joinLines", () => {
  it("limer sammen ord som er delt over linjeskift", () => {
    // OCR-en merker ikke alltid delingen i SUBS. Da står bindestreken i teksten,
    // og uten denne reparasjonen finnes ikke ordet «nestformann» på siden.
    expect(joinLines(["Formann, Ola Nordmann, nestfor-", "mann, Kari Nordmann"]))
      .toBe("Formann, Ola Nordmann, nestformann, Kari Nordmann");
  });

  it("lar årstallsspenn stå", () => {
    expect(joinLines(["Han satt i årene 1918 —19", "og i 1923 —24."])).toBe("Han satt i årene 1918 —19 og i 1923 —24.");
  });

  it("limer ikke når neste linje starter med stor bokstav", () => {
    expect(joinLines(["kretsmester i kl.-", "A i 1917"])).toBe("kretsmester i kl.- A i 1917");
  });
});
