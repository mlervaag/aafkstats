import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { stringify } from "yaml";
import { person as personSchema, personKey, personPath } from "@aafkstats/schema";
import type { Person } from "@aafkstats/schema";
import { crossValidate, loadArchive, repoRoot } from "@aafkstats/schema/load";
import { fetchJson } from "../http.js";
import { assertMayFetch, assertMayPublish } from "../policy.js";

/**
 * Setter Wikidata-ID på personene vi allerede har.
 *
 * ## Hvorfor en ID og ikke dataene
 *
 * Wikidata er CC0, så vi *kunne* kopiert fødselsdato, posisjon og karriere hit
 * uten rettighetsspørsmål. Vi lar være. En ID er en peker som holder seg
 * oppdatert; en kopi er et øyeblikksbilde som blir gammelt uten at noen merker
 * det. Arkivet handler om AaFKs kamper, ikke om biografier.
 *
 * ## Hva ID-en gir
 *
 * En identitet som overlever navnevarianter. Så lenge to av våre personer har
 * hver sin Q-ID, er de to, uansett hvor likt kildene staver dem.
 *
 * ## Dekning
 *
 * Wikidata har rundt 169 AaFK-spillere, og treffer omtrent 40 % av navnene i
 * lagoppstillingene våre. Den er derfor et tillegg, ikke en erstatning.
 */

const ENDPOINT = "https://query.wikidata.org/sparql";
const AAFK = "Q214992";

interface SparqlResponse {
  results: { bindings: { p: { value: string }; pLabel: { value: string } }[] };
}

/**
 * Fornavn og etternavn, uten mellomnavn.
 *
 * Vi kaller keeperen «Sten Michael Grytebust», Wikidata «Sten Grytebust». Det er
 * samme mann, og mellomnavnet er den vanligste forskjellen mellom to kilder som
 * skriver det samme navnet.
 */
function ends(name: string): string {
  const parts = personKey(name).split(" ").filter(Boolean);
  return parts.length < 2 ? parts.join(" ") : `${parts[0]} ${parts.at(-1)}`;
}

export async function run(args: { write: boolean; refresh: boolean }): Promise<void> {
  const root = resolve(repoRoot(), process.env.AAFK_DATA_DIR ?? "data");
  const archive = await loadArchive(root);
  const before = [...archive.issues, ...crossValidate(archive)];
  if (before.length > 0) throw new Error(`arkivet har ${before.length} valideringsfeil før høsting`);

  assertMayFetch(archive, "wikidata");
  if (args.write) assertMayPublish(archive, "wikidata");

  const query = `SELECT ?p ?pLabel WHERE {
    ?p p:P54 ?s . ?s ps:P54 wd:${AAFK} .
    SERVICE wikibase:label { bd:serviceParam wikibase:language "nb,no,en". } } LIMIT 1000`;
  const body = await fetchJson<SparqlResponse>(
    `${ENDPOINT}?format=json&query=${encodeURIComponent(query)}`,
    { refresh: args.refresh },
  );

  const exact = new Map<string, { qid: string; label: string }>();
  const loose = new Map<string, { qid: string; label: string }[]>();
  for (const row of body.results.bindings) {
    const entry = { qid: row.p.value.split("/").pop()!, label: row.pLabel.value };
    exact.set(personKey(entry.label), entry);
    const key = ends(entry.label);
    loose.set(key, [...(loose.get(key) ?? []), entry]);
  }

  const written: Person[] = [];
  const ambiguous: string[] = [];

  for (const p of archive.people) {
    if (p.wikidata !== undefined) continue;
    const forms = [p.name, ...p.names];
    let hit = forms.map((n) => exact.get(personKey(n))).find(Boolean);
    if (!hit) {
      // Fallback på fornavn og etternavn. To personer som deler begge er ikke
      // til å skille fra hverandre her, og da settes ingen ID.
      const candidates = forms.flatMap((n) => loose.get(ends(n)) ?? []);
      const unique = new Map(candidates.map((c) => [c.qid, c]));
      if (unique.size > 1) {
        ambiguous.push(`${p.name}: ${[...unique.values()].map((c) => `${c.qid} «${c.label}»`).join(", ")}`);
        continue;
      }
      hit = [...unique.values()][0];
    }
    if (!hit) continue;

    written.push(personSchema.parse({
      ...p,
      wikidata: hit.qid,
      // Navnet Wikidata bruker tas vare på når det er en annen skrivemåte enn
      // vår. Da kan et navn fra en tredje kilde treffe personen senere.
      names: personKey(hit.label) === personKey(p.name) || p.names.some((n) => personKey(n) === personKey(hit!.label))
        ? p.names
        : [...p.names, hit.label],
      providers: [
        ...p.providers.filter((s) => s.providerId !== "wikidata"),
        {
          providerId: "wikidata",
          url: `https://www.wikidata.org/wiki/${hit.qid}`,
          retrievedAt: new Date().toISOString().slice(0, 10),
          fields: ["wikidata"],
          note: "Bare ID-en. Dataene bak den er CC0, men de hentes ikke hit.",
        },
      ],
    } satisfies Person));
  }

  console.log(JSON.stringify({
    iWikidata: exact.size,
    våre: archive.people.length,
    fikkId: written.length,
    tvetydige: ambiguous.length,
  }, null, 2));
  for (const line of ambiguous) console.error(`KONTROLL: ${line}`);

  if (!args.write) {
    console.log(`Ingen filer skrevet. Planen ville rørt ${written.length} personer.`);
    return;
  }
  for (const value of written) {
    await writeFile(
      resolve(root, personPath(value.id)),
      stringify(value, { lineWidth: 0, defaultStringType: "PLAIN" }),
      "utf8",
    );
  }
  const after = await loadArchive(root);
  const issues = [...after.issues, ...crossValidate(after)];
  if (issues.length > 0) throw new Error(`skrev filer, men arkivet har ${issues.length} feil; se pnpm validate`);
  console.log(`Skrev ${written.length} personfiler.`);
}

const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith("--")));
await run({ write: flags.has("--write"), refresh: flags.has("--refresh") });
