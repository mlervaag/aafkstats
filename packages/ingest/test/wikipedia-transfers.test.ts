import { describe, expect, it } from "vitest";
import {
  aalesundSection,
  parseTransferRows,
  windowFromTitle,
  type WikipediaTransferRow,
} from "../src/adapters/wikipedia-transfers.js";

/**
 * Utdraget under er ekte wikitekst fra «List of Norwegian football transfers
 * winter 2016–17» (hentet via `action=parse&prop=wikitext`), forkortet til
 * AaFK-seksjonen og nabolaget rundt den. Det holder to overskriftsformer
 * (`===Aalesund===` uten wikilenke) og en rekke av fallgruvene fra oppgaven:
 * nøstet `{{flagicon|...}}` inni `other=`, en lenke med visningstekst, en rad
 * uten fotnote i det hele tatt, og selvlukkende `<ref name=X />`-henvisninger
 * — noen som løser seg mot en definisjon i en helt annen klubbs seksjon
 * (Brann og Molde, begge lenger opp i artikkelen enn Aalesund), og noen som
 * ikke har noen definisjon i det hele tatt.
 */
const WINTER_2016_17 = `
===Brann===
{{col-begin}}
{{col-2}}
'''In:'''
{{Fs start|hidenote=y}}
{{Fs player|no=3|nat=NED|name=[[Vito Wormgoor]]|pos=DF|other=from {{flagicon|NOR}} [[Aalesunds FK|Aalesund]]}}<ref name=Vito>{{cite web|title=Her er Branns nye midtstopper|url=http://www.brann.no/news/article/1cdg2ofzuxrq61996knsljcwoz/title/her-er-branns-nye-midtstopper|website=www.brann.no|publisher=[[SK Brann]]|accessdate=19 December 2016|language=Norwegian|date=19 December 2016|archive-url=https://archive.today/20161220064459/http://www.brann.no/news/article/1cdg2ofzuxrq61996knsljcwoz/title/her-er-branns-nye-midtstopper|archive-date=20 December 2016|url-status=dead}}</ref>
{{Fs end}}
{{col-2}}
'''Out:'''
{{Fs start|hidenote=y}}
{{Fs end}}
{{col-end}}

===Molde===
{{col-begin}}
{{col-2}}
'''In:'''
{{Fs start|hidenote=y}}
{{Fs end}}
{{col-2}}
'''Out:'''
{{Fs start|hidenote=y}}
{{Fs player|no=|nat=NOR|name=[[Thomas Kind Bendiksen]]|pos=MF|other=Released, later to [[Sandefjord Fotball|Sandefjord]]}}<ref>{{cite web|title=Kind Bendiksen ferdig i Molde FK|url=http://www.moldefk.no/latest-news/article/1ndgr2kpt7zmu1cefoiwwl72rc/title/kind-bendiksen-ferdig-i-molde-fk|website=moldefk.no|publisher=Molde FK|accessdate=12 December 2016|language=Norwegian|date=5 December 2016|archive-date=20 December 2016|archive-url=https://web.archive.org/web/20161220124805/http://www.moldefk.no/latest-news/article/1ndgr2kpt7zmu1cefoiwwl72rc/title/kind-bendiksen-ferdig-i-molde-fk|url-status=dead}}</ref><ref name="Kastrati og Kind Bendiksen">{{cite web|title=To nye forsterkninger på plass|url=http://www.sandefjordfotball.no/nyheter/to-nye-forsterkninger-pa-plass|website=sandefjordfotball.no|publisher=Sandefjord Fotball|accessdate=17 December 2016|language=Norwegian|date=13 December 2016}}</ref>
{{Fs end}}
{{col-end}}

===Aalesund===
{{col-begin}}
{{col-2}}
'''In:'''
{{Fs start|hidenote=y}}
{{Fs player|no=6|nat=NED|name=[[Kaj Ramsteijn]]|pos=DF|other=from {{flagicon|NED}} [[Almere City FC|Almere City]]}}<ref>{{cite web|title=Ramsteijn klar for AaFK|url=http://www.aafk.no/nyheter/ramsteijn-klar-for-aafk|website=www.aafk.no|publisher=[[Aalesunds FK]]|accessdate=9 January 2017|language=Norwegian|date=9 January 2017}}</ref>
{{Fs player|no=10|nat=RSA|name=[[Lars Veldwijk]]|pos=FW|other=on loan from {{flagicon|BEL}} [[K.V. Kortrijk|Kortrijk]]}}<ref>{{cite web|title=AaFK signerer ny spiss|url=http://www.aafk.no/nyheter/aafk-signerer-ny-spiss|website=www.aafk.no|publisher=[[Aalesunds FK]]|accessdate=3 April 2017|language=Norwegian|date=2017-03-31}}</ref>
{{Fs player|no=23|nat=NOR|name=[[Pål Vestly Heigre]]|pos=GK|other=from {{flagicon|NOR}} [[Viking FK|Viking]]}}<ref name=Heigre/>
{{Fs end}}
{{col-2}}
'''Out:'''
{{Fs start|hidenote=y}}
{{Fs player|no=6|nat=NED|name=[[Vito Wormgoor]]|pos=DF|other=to {{flagicon|NOR}} [[SK Brann|Brann]]}}<ref name=Vito/>
{{Fs player|no=7|nat=CIV|name=[[Franck Boli]]|pos=FW|other=loan return to {{flagicon|CHN}} [[Liaoning Whowin F.C.|Liaoning Whowin]]}}<ref name=Boli/>
{{Fs player|no=10|nat=NOR|name=[[Peter Orry Larsen]]|pos=MF|other=released}}<ref name=Eliteserien/>
{{Fs player|no=19|nat=KOS|name=[[Flamur Kastrati]]|pos=FW|other=to {{flagicon|NOR}} [[Sandefjord Fotball|Sandefjord]]}}<ref name="Kastrati og Kind Bendiksen" />
{{Fs player|no=24|nat=NOR|name=[[Lars Cramer]]|pos=GK|other=retired}}<ref>{{cite web|title=Lars Cramer gir seg i AaFK|url=http://www.aafk.no/news/article/1k1r75gyn4jss1edubsbnti207/title/lars-cramer-gir-seg-i-aafk|website=www.aafk.no|publisher=[[Aalesunds FK]]|accessdate=12 November 2016|language=Norwegian|date=November 11, 2016|url-status=dead|archiveurl=https://web.archive.org/web/20161111193100/http://www.aafk.no/news/article/1k1r75gyn4jss1edubsbnti207/title/lars-cramer-gir-seg-i-aafk|archivedate=11 November 2016}}</ref>
{{Fs end}}
{{col-end}}

==OBOS-ligaen==

===Arendal===
{{col-begin}}
{{col-2}}
'''In:'''
{{Fs start|hidenote=y}}
{{Fs player|no=26|nat=NOR|name=[[Lars Kilen]]|pos=MF|other=Promoted}}<ref name=NordicBet/>
{{Fs end}}
{{col-2}}
'''Out:'''
{{Fs start|hidenote=y}}
{{Fs end}}
{{col-end}}
`;

function rowNamed(rows: WikipediaTransferRow[], name: string): WikipediaTransferRow {
  const row = rows.find((entry) => entry.name === name);
  if (!row) throw new Error(`fant ingen rad for ${name}`);
  return row;
}

describe("aalesundSection", () => {
  it("henter bare teksten mellom AaFK-overskriften og neste lag", () => {
    const section = aalesundSection(WINTER_2016_17);
    expect(section).toContain("Kaj Ramsteijn");
    expect(section).toContain("Lars Cramer");
    // Brann og Molde kommer før i artikkelen og skal ikke bli med.
    expect(section).not.toContain("Her er Branns nye midtstopper");
    expect(section).not.toContain("Thomas Kind Bendiksen");
    // OBOS-ligaen-overskriften er nivå to og skal stoppe seksjonen.
    expect(section).not.toContain("Lars Kilen");
  });

  it("finner også en wikilenket overskrift", () => {
    const withLink = WINTER_2016_17.replace("===Aalesund===", "===[[Aalesunds FK|Aalesund]]===");
    const section = aalesundSection(withLink);
    expect(section).toContain("Kaj Ramsteijn");
  });

  it("gir null når artikkelen ikke har seksjonen", () => {
    expect(aalesundSection("===Brann===\ningenting her")).toBeNull();
  });
});

describe("parseTransferRows", () => {
  const rows = parseTransferRows(WINTER_2016_17);

  it("skiller inn fra ut på '''In:''' og '''Out:'''", () => {
    const directions = new Map(rows.map((row) => [row.name, row.direction]));
    expect(directions.get("Kaj Ramsteijn")).toBe("in");
    expect(directions.get("Vito Wormgoor")).toBe("out");
  });

  it("løser opp {{flagicon}} og [[A|B]]-lenke i klubben, uten å endre other", () => {
    const row = rowNamed(rows, "Kaj Ramsteijn");
    expect(row.other).toBe("from {{flagicon|NED}} [[Almere City FC|Almere City]]");
    expect(row.club).toBe("Almere City");
  });

  it("leser en enkel lenke uten visningstekst", () => {
    // «other=retired» har ingen lenke i det hele tatt, men navnefeltet til
    // Lars Cramer er en enkel [[Lars Cramer]]-lenke.
    const row = rowNamed(rows, "Lars Cramer");
    expect(row.name).toBe("Lars Cramer");
  });

  it("utleder loan fra 'on loan from'", () => {
    const row = rowNamed(rows, "Lars Veldwijk");
    expect(row.kind).toBe("loan");
    expect(row.club).toBe("Kortrijk");
  });

  it("utleder loan_return fra 'loan return to'", () => {
    const row = rowNamed(rows, "Franck Boli");
    expect(row.kind).toBe("loan_return");
    expect(row.club).toBe("Liaoning Whowin");
  });

  it("utleder released bare når retningen er ut", () => {
    const row = rowNamed(rows, "Peter Orry Larsen");
    expect(row.kind).toBe("released");
    expect(row.club).toBeNull();
  });

  it("utleder retired bare når retningen er ut", () => {
    const row = rowNamed(rows, "Lars Cramer");
    expect(row.kind).toBe("retired");
    expect(row.club).toBeNull();
  });

  it("faller tilbake til transfer for en vanlig overgang", () => {
    const row = rowNamed(rows, "Flamur Kastrati");
    expect(row.kind).toBe("transfer");
    expect(row.club).toBe("Sandefjord");
    expect(row.number).toBe(19);
    expect(row.nationality).toBe("KOS");
    expect(row.position).toBe("FW");
  });

  it("har en rad uten fotnote når det ikke finnes noen definisjon å slå opp", () => {
    // Pål Vestly Heigre har et selvlukkende <ref name=Heigre/>, men ingen
    // <ref name=Heigre>...</ref> med innhold finnes noe sted i artikkelen —
    // da står raden uten fotnote, i stedet for å late som den har en.
    const row = rowNamed(rows, "Pål Vestly Heigre");
    expect(row.refs).toEqual([]);
  });

  it("slår opp et selvlukkende <ref name=X /> mot definisjonen i en annen klubbs seksjon", () => {
    // Vito Wormgoors avgang har bare <ref name=Vito/> i AaFK-seksjonen — hele
    // fotnoten står i Branns egen «In»-seksjon, lenger opp i artikkelen. Dette
    // er det ekte tilfellet fra winter 2016–17 som kostet 95 av 323 rader.
    const row = rowNamed(rows, "Vito Wormgoor");
    expect(row.refs).toEqual([
      {
        title: "Her er Branns nye midtstopper",
        url: "http://www.brann.no/news/article/1cdg2ofzuxrq61996knsljcwoz/title/her-er-branns-nye-midtstopper",
        publisher: "SK Brann",
        date: "2016-12-19",
        archiveUrl: "https://archive.today/20161220064459/http://www.brann.no/news/article/1cdg2ofzuxrq61996knsljcwoz/title/her-er-branns-nye-midtstopper",
      },
    ]);
  });

  it("slår opp et navngitt selvlukkende <ref name=\"...\" /> med anførselstegn mot en tredje klubbs seksjon", () => {
    // Navnet er definert i Moldes seksjon, og både Sandefjord og Aalesund
    // viser bare til det med <ref name="Kastrati og Kind Bendiksen" />.
    const row = rowNamed(rows, "Flamur Kastrati");
    expect(row.refs).toEqual([
      {
        title: "To nye forsterkninger på plass",
        url: "http://www.sandefjordfotball.no/nyheter/to-nye-forsterkninger-pa-plass",
        publisher: "Sandefjord Fotball",
        date: "2016-12-13",
      },
    ]);
  });

  it("leser tittel, url, publisher og arkivlenke fra {{cite web}}, og fjerner lenkesyntaks fra publisher", () => {
    const row = rowNamed(rows, "Kaj Ramsteijn");
    expect(row.refs).toEqual([
      {
        title: "Ramsteijn klar for AaFK",
        url: "http://www.aafk.no/nyheter/ramsteijn-klar-for-aafk",
        publisher: "Aalesunds FK",
        date: "2017-01-09",
      },
    ]);
  });

  it("normaliserer 'day month year'", () => {
    const row = rowNamed(rows, "Kaj Ramsteijn");
    expect(row.refs[0]?.date).toBe("2017-01-09");
  });

  it("normaliserer ISO-datoen uendret", () => {
    const row = rowNamed(rows, "Lars Veldwijk");
    expect(row.refs[0]?.date).toBe("2017-03-31");
  });

  it("normaliserer 'month day, year'", () => {
    const row = rowNamed(rows, "Lars Cramer");
    expect(row.refs[0]?.date).toBe("2016-11-11");
  });

  it("leser archive-url både med og uten bindestrek i parameternavnet", () => {
    expect(rowNamed(rows, "Lars Cramer").refs[0]?.archiveUrl).toBe(
      "https://web.archive.org/web/20161111193100/http://www.aafk.no/news/article/1k1r75gyn4jss1edubsbnti207/title/lars-cramer-gir-seg-i-aafk",
    );
  });

  it("utleder academy bare når retningen er inn", () => {
    // Arendal-raden ligger utenfor AaFK-seksjonen og skal derfor ikke dukke
    // opp her i det hele tatt.
    expect(rows.some((row) => row.name === "Lars Kilen")).toBe(false);
  });

  it("gir tom liste uten '''In:'''-markør, i stedet for å gjette", () => {
    const withoutIn = `===Aalesund===
{{col-begin}}
{{col-2}}
'''Out:'''
{{Fs start|hidenote=y}}
{{Fs player|no=6|nat=NED|name=[[Vito Wormgoor]]|pos=DF|other=to {{flagicon|NOR}} [[SK Brann|Brann]]}}
{{Fs end}}
{{col-end}}`;
    const rowsWithoutIn = parseTransferRows(withoutIn);
    expect(rowsWithoutIn).toHaveLength(1);
    expect(rowsWithoutIn[0]?.direction).toBe("out");
  });
});

describe("parseTransferRows — academy utledet fra retning", () => {
  it("gir academy for en spiller opp fra egen ungdomsavdeling", () => {
    const section = `===Aalesund===
'''In:'''
{{Fs start|hidenote=y}}
{{Fs player|no=30|nat=NOR|name=[[Test Spiller]]|pos=MF|other=Promoted from youth team}}<ref>{{cite web|title=Ny fra akademiet|url=http://www.aafk.no/x|publisher=[[Aalesunds FK]]|date=2020-01-01}}</ref>
{{Fs end}}
'''Out:'''
{{Fs start|hidenote=y}}
{{Fs end}}`;
    const [row] = parseTransferRows(section);
    expect(row?.kind).toBe("academy");
    expect(row?.club).toBeNull();
  });

  it("faller tilbake til transfer når 'academy'-ordlyd står på en ut-rad", () => {
    // En hypotetisk, ikke reell, rad — for å vise at retningsregelen faktisk
    // håndheves og ikke bare tilfeldigvis stemmer på de ekte eksemplene.
    const section = `===Aalesund===
'''In:'''
{{Fs start|hidenote=y}}
{{Fs end}}
'''Out:'''
{{Fs start|hidenote=y}}
{{Fs player|no=31|nat=NOR|name=[[Ute Spiller]]|pos=MF|other=to academy}}<ref>{{cite web|title=X|url=http://x|date=2020-01-01}}</ref>
{{Fs end}}`;
    const [row] = parseTransferRows(section);
    expect(row?.kind).toBe("transfer");
  });
});

/**
 * Ekte wikitekst fra «List of Norwegian football transfers summer 2013».
 * Artiklene fra før ca. 2015 bruker `{{football squad player}}` med
 * `{{football squad start}}`/`{{football squad end}}` rundt, ikke `{{Fs
 * player}}` — og `nat=` er her et fullt landsnavn («Nigeria»), ikke en kode.
 */
const SUMMER_2013 = `===Aalesund===
{{col-begin}}
{{col-2}}
'''In:'''
{{football squad start}}
{{football squad player|nat=Nigeria|name=[[Akeem Latifu]]|pos=DF|other=on loan from [[IL Hødd|Hødd]]}}
{{football squad player|nat=Morocco|name=[[Houcine Zaidoun]]|pos=MF|other=on loan from [[OC Safi]]}}
{{football squad end}}
{{col-2}}
'''Out:'''
{{football squad start}}
{{football squad player|nat=Jamaica|name=[[Jason Morrison (footballer)|Jason Morrison]]|pos=MF|other=released}}
{{football squad end}}
{{col-end}}`;

describe("parseTransferRows — {{football squad player}} (artikler før ca. 2015)", () => {
  const rows = parseTransferRows(SUMMER_2013);

  it("leser rader fra den eldre malen", () => {
    expect(rows).toHaveLength(3);
  });

  it("beholder nat= som fullt landsnavn, uendret", () => {
    const row = rowNamed(rows, "Akeem Latifu");
    expect(row.nationality).toBe("Nigeria");
    expect(row.direction).toBe("in");
    expect(row.kind).toBe("loan");
    expect(row.club).toBe("Hødd");
  });

  it("leser en visningstekst-lenke i navnefeltet, og released ut", () => {
    const row = rowNamed(rows, "Jason Morrison");
    expect(row.direction).toBe("out");
    expect(row.kind).toBe("released");
    expect(row.nationality).toBe("Jamaica");
  });
});

describe("windowFromTitle", () => {
  it("leser sommervinduet", () => {
    expect(windowFromTitle("List of Norwegian football transfers summer 2017")).toEqual({
      season: 2017,
      window: "summer",
    });
  });

  it("leser vintervinduet med en-strek, og bruker det senere året", () => {
    expect(windowFromTitle("List of Norwegian football transfers winter 2016–17")).toEqual({
      season: 2017,
      window: "winter",
    });
  });

  it("leser vintervinduet med vanlig bindestrek", () => {
    expect(windowFromTitle("List of Norwegian football transfers winter 2016-17")).toEqual({
      season: 2017,
      window: "winter",
    });
  });

  it("behandler en artikkel uten vindu som sommer", () => {
    expect(windowFromTitle("List of Norwegian football transfers 2010")).toEqual({
      season: 2010,
      window: "summer",
    });
  });

  it("gir null for en tittel den ikke kjenner igjen", () => {
    expect(windowFromTitle("List of Norwegian football transfers")).toBeNull();
  });
});
