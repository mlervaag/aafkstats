import { ROLE_TERMS, resolveRoles } from "./nb-roles.js";
import type { KnownPerson } from "./nb-roles.js";
import type { ResolvedRole } from "@aafkstats/schema";

/**
 * Roller fra de publikasjonene som ikke har ALTO.
 *
 * ## Hvorfor de trenger en egen vei inn
 *
 * To av de 98 publikasjonene har ingen ALTO i IIIF-manifestet: jubileumsskriftet
 * fra 1939 (119 sider) og 35-årsboka fra 1950 (20 sider). Masseuttrekket kunne
 * derfor ikke lese en eneste av de 139 sidene, og de står som `search_only` med
 * `pagesProcessed: 0`.
 *
 * Det er de to bøkene personhistorien faktisk ligger i. Formannsrekka piloten
 * leste for hånd — «Formenn: Sverre Mogstad 1925 og 1926, Rolf Mittet 1927,
 * Georg Haller 1914 og 1915 …» — står på trykt side 18 i 1939-boka, og hele
 * personpiloten i #73 hviler på den.
 *
 * ## Hva fulltekstsøket faktisk gir
 *
 * Mer enn første gjennomgang brukte. Hvert treff kommer med teksten før og
 * etter, ikke bare ordet:
 *
 *     «… med Georg Haller som dens første [[formann.]] Georg Haller var …»
 *
 * Det er rolle og navn i samme setning. Første gjennomgang reduserte det til
 * nøkkelordet «formann» og lette etter et navn på samme linje.
 *
 * Konteksten er dessuten allerede i leserekkefølge — søketjenesten leverer
 * løpende tekst, ikke spalter — så den kan gå rett inn i den samme
 * `resolveRoles` som den spaltevis leste ALTO-teksten.
 */

/** Ett treff fra `contentsearch`, med konteksten rundt. */
export interface SearchHit {
  /** Trykt sidetall, oversatt fra skann-nummeret i annoteringen. */
  page: string;
  before: string;
  match: string;
  after: string;
}

/**
 * Søkeordene som gir roller.
 *
 * Rolleordene finner setninger der tittelen står først. Personnavnene finner
 * dem der navnet står først — «Georg Haller … som klubbens formann» — og de er
 * dessuten den eneste måten å treffe en person søket ellers ikke ville lett
 * etter. Navnene kommer fra registeret, så et treff er avstemt i samme
 * øyeblikk som det oppstår.
 */
export function searchTerms(people: KnownPerson[], options: { names?: boolean } = {}): string[] {
  const terms = ROLE_TERMS.map((term) => term.term);
  if (options.names === false) return terms;
  return [...new Set([...terms, ...people.map((person) => person.name)])];
}

/**
 * Rollene i et sett med søketreff.
 *
 * ## Hvert vindu leses for seg
 *
 * Det er fristende å slå sammen alle treff på en side til én tekst før den
 * leses. Det gir falsk naboskap: side 18 i 1939-boka har to rekker etter
 * hverandre, «Formenn:» og «Opmenn:», og limer man vinduene sammen havner
 * hvert navn innenfor rekkevidde av begge overskriftene. Første forsøk ga
 * Georg Haller både formann og oppmann for 1914–1915, og halvparten av de 35
 * sikre rollene var slike dubletter.
 *
 * Et søkevindu er derimot sammenhengende tekst slik den står i boka. Leser vi
 * ett om gangen, kan en overskrift bare nå navnene som faktisk følger etter
 * den.
 *
 * Prisen er at et vindu uten overskrift ikke gir noen rolle — står navnet langt
 * nede i rekka, ser vi det ikke. Det er riktig vei å ta feil på: en rolle vi
 * ikke fant kan hentes senere, en rolle vi fant feil står i arkivet som et
 * faktum.
 */
export function resolveRolesFromSearch(
  hits: SearchHit[],
  options: { sourceId: string; people: KnownPerson[]; publicationYear?: number },
): ResolvedRole[] {
  const byPage = new Map<string, string[]>();
  for (const hit of hits) {
    const context = `${hit.before} ${hit.match} ${hit.after}`.replace(/\s+/g, " ").trim();
    if (context === "") continue;
    byPage.set(hit.page, [...(byPage.get(hit.page) ?? []), context]);
  }

  const seen = new Map<string, ResolvedRole>();
  for (const [page, contexts] of byPage) {
    for (const run of mergeOverlapping(contexts)) {
      for (const role of resolveRoles([run], run, {
        sourceId: options.sourceId,
        page,
        people: options.people,
        ...(options.publicationYear === undefined ? {} : { publicationYear: options.publicationYear }),
      })) {
        seen.set(role.id, role);
      }
    }
  }

  return [...seen.values()]
    .sort((a, b) => Number(a.page) - Number(b.page) || a.personName.localeCompare(b.personName, "nb"));
}

/** Minste overlapp som regnes som samme tekst. Kortere er tilfeldige ordsammenfall. */
const MIN_OVERLAP = 24;

/**
 * Setter overlappende søkevinduer sammen til lengre, sammenhengende tekst.
 *
 * Hvert søkeord gir sitt eget vindu rundt treffet, og på en side der flere ord
 * treffer i samme avsnitt overlapper vinduene hverandre. Settes de sammen på
 * overlappet, gjenoppstår avsnittet i riktig rekkefølge — og da rekker
 * overskriften «Formenn:» ned til navnene som faktisk står under den, også de
 * som ligger for langt nede til å ha havnet i sitt eget vindu.
 *
 * Uten dette må hvert navn ha overskriften i sitt eget vindu for å få en rolle,
 * og fire av vervene piloten leste på side 18 faller ut.
 */
export function mergeOverlapping(contexts: string[]): string[] {
  const runs: string[] = [];

  for (const context of [...contexts].sort((a, b) => b.length - a.length)) {
    let merged = false;
    for (const [index, run] of runs.entries()) {
      const joined = join(run, context);
      if (joined === null) continue;
      runs[index] = joined;
      merged = true;
      break;
    }
    if (!merged) runs.push(context);
  }

  // Én runde til: to løp kan ha blitt naboer først etter at et tredje vindu
  // limte dem sammen i midten.
  for (let index = runs.length - 1; index >= 0; index -= 1) {
    for (let other = 0; other < index; other += 1) {
      const joined = join(runs[other]!, runs[index]!);
      if (joined === null) continue;
      runs[other] = joined;
      runs.splice(index, 1);
      break;
    }
  }

  return runs;
}

/** To tekster limt på overlappet, eller null om de ikke hører sammen. */
function join(left: string, right: string): string | null {
  if (left.includes(right)) return left;
  if (right.includes(left)) return right;

  for (const [first, second] of [[left, right], [right, left]] as const) {
    const limit = Math.min(first.length, second.length);
    for (let size = limit; size >= MIN_OVERLAP; size -= 1) {
      if (first.endsWith(second.slice(0, size))) return first + second.slice(size);
    }
  }
  return null;
}
