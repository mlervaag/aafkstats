import { crossValidate, dataDir, loadArchive } from "../load.js";

const RED = "[31m";
const GREEN = "[32m";
const DIM = "[2m";
const RESET = "[0m";

const root = dataDir();
const archive = await loadArchive(root);
const issues = [...archive.issues, ...crossValidate(archive)];

// Et tomt arkiv er nesten alltid feil sti, ikke et gyldig arkiv. Å melde «✓» på null
// filer er verre enn å feile: det ser ut som alt er i orden.
if (archive.clubs.length === 0 && archive.matches.length === 0) {
  console.error(`${RED}✗${RESET} Fant ingen data i ${root}`);
  console.error(`${DIM}  Sjekk stien, eller sett AAFK_DATA_DIR (relativ til repo-rota).${RESET}`);
  process.exit(1);
}

const counts = [
  `${archive.matches.length} kamper`,
  `${archive.seasons.length} sesonger`,
  `${archive.clubs.length} klubber`,
  `${archive.venues.length} stadion`,
  `${archive.competitions.length} konkurranser`,
  `${archive.providers.length} kilder`,
  // Vises bare når laget er tatt i bruk. Å skrive «0 observasjoner» for hvert
  // kall ville lest som en mangel, ikke som at ingen kilde er høstet inn ennå.
  ...(archive.observations.length > 0 ? [`${archive.observations.length} leverandørobservasjoner`] : []),
  // De kanoniske historiske faktaene er en annen modell enn leverandørenes
  // råobservasjoner, og telles for seg. Sto de ikke her, hadde README ingen
  // kilde til tallet — og «pnpm validate skriver ut de gjeldende» ville løyet.
  ...(archive.historicalObservations.length > 0 ? [`${archive.historicalObservations.length} historiske observasjoner`] : []),
  ...(archive.standings.length > 0 ? [`${archive.standings.length} tabeller`] : []),
  ...(archive.people.length > 0 ? [`${archive.people.length} personer`] : []),
  ...(archive.extractions.length > 0 ? [`${archive.extractions.length} publikasjoner analysert`] : []),
  ...(archive.sourceResults.length > 0 ? [`${archive.sourceResults.reduce((sum, collection) => sum + collection.seasons.reduce((seasonSum, season) => seasonSum + season.results.length, 0), 0)} kildedokumenterte resultater`] : []),
  ...(archive.harvests.length > 0 ? [`${archive.harvests.length} innhøstingsbatcher`] : []),
  ...(archive.verificationCases.length > 0 ? [`${archive.verificationCases.length} verifiseringssaker`] : []),
].join(" · ");

if (issues.length === 0) {
  console.log(`${GREEN}✓${RESET} Arkivet validerer. ${DIM}${counts}${RESET}`);
  process.exit(0);
}

// Grupper etter fil så en ødelagt fil vises som én blokk i stedet for spredte linjer.
const byFile = new Map<string, typeof issues>();
for (const issue of issues) {
  const list = byFile.get(issue.file) ?? [];
  list.push(issue);
  byFile.set(issue.file, list);
}

console.error(`${RED}✗${RESET} ${issues.length} feil i ${byFile.size} fil(er):\n`);
for (const [file, fileIssues] of [...byFile].sort()) {
  console.error(`  ${file}`);
  for (const issue of fileIssues) {
    const where = issue.path === "" ? "" : `${DIM}${issue.path}${RESET} — `;
    console.error(`    ${where}${issue.message}`);
  }
  console.error("");
}
console.error(`${DIM}Datakatalog: ${root}${RESET}`);
process.exit(1);
