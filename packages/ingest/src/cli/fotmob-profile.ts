import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { stringify } from "yaml";
import { personPath } from "@aafkstats/schema";
import { crossValidate, loadArchive, repoRoot } from "@aafkstats/schema/load";
import { discoverFotmobPlayers, fetchFotmobPlayerProfile } from "../adapters/fotmob-profile.js";
import { planFotmobProfile } from "../fotmob-profile.js";
import { resolvePlayerTarget } from "../player-profile.js";
import { assertMayFetch, assertMayPublish } from "../policy.js";

const { values } = parseArgs({
  args: process.argv.slice(2).filter((argument, index) => argument !== "--" || index > 0),
  options: {
    player: { type: "string" },
    discover: { type: "boolean", default: false },
    "fotmob-id": { type: "string" },
    "retrieved-at": { type: "string" },
    refresh: { type: "boolean", default: false },
    write: { type: "boolean", default: false },
  },
  strict: true,
});

const fotmobId = values["fotmob-id"];
const retrievedAt = values["retrieved-at"];
const player = values.player;
if (!player || values.discover === Boolean(fotmobId)) {
  throw new Error(
    "bruk: --player PERSON-ID-ELLER-NAVN (--discover | --fotmob-id ID) "
    + "[--retrieved-at ÅÅÅÅ-MM-DD] [--refresh] [--write]",
  );
}
if (values.write && values.discover) throw new Error("--discover skriver aldri; velg en ID og bruk --fotmob-id");
if (values.write && !/^\d{4}-\d{2}-\d{2}$/.test(retrievedAt ?? "")) {
  throw new Error("--write krever --retrieved-at ÅÅÅÅ-MM-DD");
}

async function run(playerName: string): Promise<void> {
const root = resolve(repoRoot(), process.env.AAFK_DATA_DIR ?? "data");
const archive = await loadArchive(root);
const before = [...archive.issues, ...crossValidate(archive)];
if (before.length > 0) throw new Error(`arkivet har ${before.length} valideringsfeil før høsting`);
assertMayFetch(archive, "fotmob");
if (values.write) assertMayPublish(archive, "fotmob");

const target = resolvePlayerTarget(archive, playerName);
if (values.discover) {
  console.log(`FotMob-kandidater for ${target.name} (skriver aldri)`);
  const candidates = await discoverFotmobPlayers(target.name, { refresh: values.refresh });
  console.log(JSON.stringify({
    spiller: { id: target.id, navn: target.name, personfilFinnes: target.existing !== undefined },
    kandidater: candidates,
    nesteSteg: candidates.length === 0
      ? "Ingen kandidat funnet. Kontroller skrivemåten eller bruk en annen kilde."
      : "Kontroller profilene manuelt og kjør på nytt med valgt --fotmob-id.",
  }, null, 2));
  return;
}

const profile = await fetchFotmobPlayerProfile(fotmobId!, { refresh: values.refresh });
const plan = planFotmobProfile(target, profile, retrievedAt);
console.log(`FotMob-profil: ${target.name}${values.write ? " (skriv)" : " (tørrkjøring)"}`);
console.log(JSON.stringify({
  spiller: { id: target.id, navn: target.name, personfilFinnes: target.existing !== undefined },
  fotmob: {
    id: profile.id,
    navn: profile.name,
    url: profile.url,
    råPosisjon: profile.rawPosition,
    råNasjonalitet: profile.rawNationality,
    landkode: profile.countryCode,
    aafkPerioder: profile.aafkCareer,
  },
  endringer: plan.changes,
  konflikter: plan.conflicts,
}, null, 2));

if (profile.rawPosition && !profile.position) {
  console.error(`KONTROLL: posisjonen «${profile.rawPosition}» er ukjent og blir ikke skrevet`);
}
if (profile.rawNationality && !profile.nationality) {
  console.error(
    `KONTROLL: landkoden «${profile.countryCode ?? "ukjent"}» (${profile.rawNationality}) `
    + "mangler norsk arkivform og blir ikke skrevet",
  );
}
if (plan.conflicts.length > 0) {
  for (const conflict of plan.conflicts) console.error(`KONTROLL: ${conflict}`);
  if (values.write) throw new Error("FotMob motsier eksisterende fakta; skriver ikke");
}
if (!values.write) {
  console.log("Ingen fil skrevet. Bruk --write etter at ID, AaFK-periode og differanse er kontrollert.");
  return;
}
if (plan.changes.length === 0) {
  console.log("Personfila mangler ingen fakta denne profilen kan fylle.");
  return;
}

const absolute = resolve(root, personPath(plan.person.id));
await mkdir(dirname(absolute), { recursive: true });
await writeFile(absolute, stringify(plan.person, { lineWidth: 0, defaultStringType: "PLAIN" }), "utf8");
const after = await loadArchive(root);
const afterIssues = [...after.issues, ...crossValidate(after)];
if (afterIssues.length > 0) {
  throw new Error(`skrev ${personPath(plan.person.id)}, men arkivet har ${afterIssues.length} feil; se pnpm validate`);
}
console.log(`${plan.create ? "Opprettet" : "Oppdaterte"} ${personPath(plan.person.id)}.`);
}

await run(player);
