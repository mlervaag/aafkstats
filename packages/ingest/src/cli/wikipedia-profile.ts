import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { stringify } from "yaml";
import { personPath } from "@aafkstats/schema";
import { crossValidate, loadArchive, repoRoot } from "@aafkstats/schema/load";
import { fetchWikipediaProfile } from "../adapters/wikipedia-profile.js";
import { assertMayFetch, assertMayPublish } from "../policy.js";
import { planWikipediaProfile, resolvePlayerTarget } from "../wikipedia-profile.js";

const { values } = parseArgs({
  args: process.argv.slice(2).filter((argument, index) => argument !== "--" || index > 0),
  options: {
    player: { type: "string" },
    title: { type: "string" },
    lang: { type: "string", default: "no" },
    refresh: { type: "boolean", default: false },
    write: { type: "boolean", default: false },
  },
  strict: true,
});

if (!values.player || !values.title || (values.lang !== "no" && values.lang !== "en")) {
  throw new Error(
    "bruk: --player PERSON-ID-ELLER-NAVN --title WIKIPEDIA-TITTEL [--lang no|en] [--refresh] [--write]",
  );
}

const root = resolve(repoRoot(), process.env.AAFK_DATA_DIR ?? "data");
const archive = await loadArchive(root);
const before = [...archive.issues, ...crossValidate(archive)];
if (before.length > 0) throw new Error(`arkivet har ${before.length} valideringsfeil før høsting`);

assertMayFetch(archive, "wikipedia");
if (values.write) assertMayPublish(archive, "wikipedia");

const target = resolvePlayerTarget(archive, values.player);
console.log(`Wikipedia-profil: ${target.name}${values.write ? " (skriv)" : " (tørrkjøring)"}`);
const profile = await fetchWikipediaProfile(values.lang, values.title, { refresh: values.refresh });
const plan = planWikipediaProfile(target, profile);

console.log(JSON.stringify({
  spiller: { id: target.id, navn: target.name, personfilFinnes: target.existing !== undefined },
  wikipedia: {
    språk: profile.language,
    tittel: profile.title,
    revisjon: profile.revisionId,
    dato: profile.timestamp,
    råPosisjon: profile.rawPosition,
  },
  endringer: plan.changes,
  konflikter: plan.conflicts,
}, null, 2));

if (profile.rawPosition && !profile.position) {
  console.error(`KONTROLL: posisjonen «${profile.rawPosition}» er tvetydig eller ukjent og blir ikke skrevet`);
}
if (plan.conflicts.length > 0) {
  for (const conflict of plan.conflicts) console.error(`KONTROLL: ${conflict}`);
  if (values.write) throw new Error("Wikipedia motsier eksisterende fakta; skriver ikke");
}
if (!values.write) {
  console.log("Ingen fil skrevet. Bruk --write etter at side og differanse er kontrollert.");
  process.exit(0);
}
if (plan.changes.length === 0) {
  console.log("Personfila mangler ingen fakta denne profilen kan fylle.");
  process.exit(0);
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
