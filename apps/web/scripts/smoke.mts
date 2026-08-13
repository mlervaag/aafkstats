import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * Røyketest av det ferdige bygget.
 *
 * Kjøres etter `next build` og leser HTML-en som faktisk ble generert. Poenget
 * er de feilene enhetstestene ikke ser: en side som kaster under prerendering,
 * en tom seksjon, eller en tittel som falt tilbake til prosjektnavnet fordi
 * `generateMetadata` ikke ble kalt.
 *
 * Sidene velges så de dekker hver form arkivet har: forsiden, de to
 * dokumentasjonssidene, en sesong, en motstander, en spilt kamp og en kamp som
 * ikke er spilt.
 */

const root = resolve(import.meta.dirname, "..", ".next", "server", "app");

interface Check {
  /** Filen slik Next la den, uten .html. */
  page: string;
  /** Tekst som må stå i HTML-en. Mangler den, har siden mistet noe. */
  must: string[];
  /** Tekst som ikke får stå der. */
  mustNot?: string[];
}

/**
 * Fixture-arkivet er det CI bygger med, så ID-ene her er fixturens.
 *
 * Bygges det med det ekte arkivet, finnes ikke de samme kampene, og da sier
 * skriptet fra om det framfor å påstå at alt er i orden.
 */
const checks: Check[] = [
  {
    page: "index",
    must: ["AaFK-arkivet", "Spør arkivet", "kamper"],
  },
  {
    page: "data",
    must: ["<code>matches</code>", "Hva arkivet inneholder", "spilte kamper"],
    // Dette er påstanden som sto igjen fra det gamle testdatasettet.
    mustNot: ["fem kamper fra 2025"],
  },
  {
    page: "om",
    must: ["Aktivt, åpent supporterarkiv", "terminlista", "akseptert risiko"],
    mustNot: ["MVP"],
  },
  {
    page: "sesong/1998",
    // «Dette mangler for 1998» er dekningsgraden gjort handlingsorientert: den skal
    // stå der med en Bidra-knapp, ikke bare som et merke som sier «Delvis».
    must: ["1998", "Sluttabell", "Dette mangler for", "seriekamper", "Del et sesongminne"],
  },
  {
    page: "motstander/sk-brann",
    must: ["AaFK mot", "Brann"],
  },
  {
    page: "personer",
    must: ["Menneskene i arkivet", "Søk etter navn, rolle eller nasjonalitet", "Hjemmebaner"],
  },
  {
    page: "personer/jan-jonsson",
    must: ["Jan Jönsson", "Dette vet arkivet", "Roller og verv"],
  },
  // En spiller arkivet bare kjenner fra lagoppstillingene. Sida finnes uten at
  // noen har skrevet en personfil, og den skal si tydelig at den er utledet.
  {
    page: "personer/fixture-spiller-b",
    must: [
      "Spiller i AaFK-arkivet", "Utledet av lagoppstillingene",
      "Sesong for sesong", "Legg til en personfil",
    ],
    // En utledet side har ingen kilde for noe av dette, og skal ikke påstå det.
    mustNot: ["Roller og verv", "Omtalt i"],
  },
  {
    page: "hjemmebaner",
    // Sida finnes bare fordi banedataene lå ubrukt i arkivet: perioder,
    // dekkehistorikk, publikumsrekord og milepæler uten noe sted å stå.
    must: ["Der klubben har spilt", "Kråmyra stadion", "Publikumsrekord", "Milepæler", "1977"],
  },
  {
    page: "organisasjon",
    must: ["Klubben utenfor banen", "Formenn", "Trenere og sportslig apparat", "Fra dokument til struktur"],
  },
  {
    page: "mangler",
    must: [
      "Kan du kontrollere dette?", "Er Tor Hogne Aarøy riktig person i fixture-arkivet?",
      "Finn dokumentasjonen. Svar JA eller NEI", "Se alle 2 saker", "Hele mangellista",
    ],
  },
  {
    // Den brede arbeidsoversikten ble ikke fjernet da /mangler ble en enkel
    // community-kø. Den har fått en egen, stabil rute og skal fortsatt bygges.
    page: "mangler/oversikt",
    must: [
      "Hva mangler i AaFK-arkivet?", "Historiske resultater å identifisere",
      "Finn datoen bak et resultat", "Avklar historiske verv",
      "Knytt lagoppstillinger til riktig kamp", "Fixture Spiller A",
      "Om publikasjonen", "Jeg kjenner igjen kampen",
      // Sesongdekningen ble en oppgave i seg selv. Fixturen har to sesonger
      // som ikke kan kalles hele, og begge formene skal vises: med kjent
      // omfang («3 av 6») og uten («2 kamper registrert»).
      "Gjør en sesong hel", "Runder mangler", "3 av 6 kamper", "2 kamper registrert",
      // Identitetsjobben, begge veier: spillere uten personfil, og filer ført
      // som spillere uten at en eneste kamp er koblet til dem.
      "Knytt spillere til riktig identitet", "spillere uten personfil",
    ],
  },
  {
    // Publiserte lenker skal bestå etter at en sak er løst.
    page: "mangler/fixture-resolved",
    must: [
      "Saken er løst", "Fixture-kilden identifiserer personen uttrykkelig.",
      "Se vurderingen på GitHub", "Se dataendringen",
    ],
    mustNot: ["Send til vurdering"],
  },
  {
    page: "kamp/1998-08-16-aalesunds-fk-sk-brann",
    must: [
      "16. august 1998", "Kilder", "Kildene er uenige", "arkivet bruker denne",
      // Den diskrete merknaden øverst, med lenke til seksjonen lenger nede.
      "er uenige om tilskuertallet",
    ],
    mustNot: ["Kampen er ikke spilt"],
  },
  // Kildesidene var «force-dynamic» og fantes ikke som forhåndsgenerert HTML i det
  // hele tatt. At denne filen finnes er halve testen.
  {
    page: "kilder",
    must: ["Historisk kildearkiv", "AaFK Medlemsblad", "Serier og faste utgivelser"],
  },
  {
    page: "kilder/aafk-90-ar-1914-2004",
    must: [
      "Aalesunds fotballklubb 90 år",
      // Bibliografien: URN, forfatter og beskrivelse.
      "URN:NBN:no-nb_digibok_2011071108003", "Konstruert Forfatter", "Jubileumsbok",
      // Provenance-språket, og at bruken faktisk summeres opp.
      "Kamper der kilden er brukt",
      "Side 142",
      // Providernavnet skal komme fra core_providers, ikke fra en streng i JSX-en.
      "Les hos Nasjonalbiblioteket",
    ],
    mustNot: ["Dokumenterte kamper"],
  },
  {
    page: "kilder/aafk-medlemsblad",
    // Årsgruppering: to årganger, hver med sitt utgavenummer.
    must: ["AaFK Medlemsblad", "Utgivelser (", "1970", "1971", "Årgang"],
  },
  {
    page: "kamp/2024-11-24-sk-brann-aalesunds-fk",
    must: ["Kampen er ikke spilt", "24. november 2024"],
    // En kamp som ikke er spilt skal ikke ha tomme historikkseksjoner.
    mustNot: ["Ingen hendelser registrert", "Lagoppstilling"],
  },
];

let failures = 0;

for (const check of checks) {
  const file = resolve(root, `${check.page}.html`);
  let html: string;
  try {
    html = await readFile(file, "utf8");
  } catch {
    console.error(`✗ ${check.page}: ingen forhåndsgenerert side på ${file}`);
    failures += 1;
    continue;
  }

  const missing = check.must.filter((text) => !html.includes(text));
  const present = (check.mustNot ?? []).filter((text) => html.includes(text));

  if (missing.length === 0 && present.length === 0) {
    console.log(`✓ ${check.page}`);
    continue;
  }
  failures += 1;
  if (missing.length > 0) console.error(`✗ ${check.page}: mangler ${JSON.stringify(missing)}`);
  if (present.length > 0) console.error(`✗ ${check.page}: skulle ikke hatt ${JSON.stringify(present)}`);
}

if (failures > 0) {
  console.error(`\n${failures} av ${checks.length} sider feilet.`);
  process.exit(1);
}
console.log(`\n${checks.length} sider ser riktige ut.`);
