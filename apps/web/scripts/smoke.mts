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
    must: ["AaFK-arkivet", "Spør AI", "kamper"],
  },
  {
    page: "data",
    must: ["<code>matches</code>", "Dekning, slik spørrefunksjonen får den", "spilte kamper"],
    // Dette er påstanden som sto igjen fra det gamle testdatasettet.
    mustNot: ["fem kamper fra 2025"],
  },
  {
    page: "om",
    must: ["Offentlig beta", "terminlista", "akseptert risiko"],
    mustNot: ["MVP"],
  },
  {
    page: "sesong/1998",
    must: ["1998", "Sluttabell"],
  },
  {
    page: "motstander/sk-brann",
    must: ["AaFK mot", "Brann"],
  },
  {
    page: "kamp/1998-08-16-aalesunds-fk-sk-brann",
    must: ["16. august 1998", "Kilder"],
    mustNot: ["Kampen er ikke spilt"],
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
