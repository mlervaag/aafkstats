import { CORE_SCHEMA, load } from "js-yaml";

/**
 * Leser ett YAML-dokument slik arkivet gjør det overalt.
 *
 * CORE_SCHEMA er YAML 1.2s kjerneskjema — det samme `yaml` gir med
 * `schema: "core"`, som var det hele kodebasen ba om før. Datoer forblir
 * strenger i stedet for å bli Date avhengig av om verdien er sitert, og «no»
 * forblir «no» i stedet for å bli false slik YAML 1.1 ville gjort.
 *
 * Grunnen til at det er js-yaml og ikke `yaml` som leser, er farten alene.
 * Arkivet er over 4400 filer, og de fem største discovery-manifestene er på
 * 1-2 MB hver; `yaml` brukte 13 sekunder på å parse arkivet mot js-yamls 1,2.
 * Det er så godt som hele kostnaden ved å laste arkivet, og den ble betalt om
 * igjen for hver eneste last.
 *
 * `parse-equivalence.test.ts` leser hver fil i arkivet med begge bibliotekene
 * og krever identisk resultat. Skulle en framtidig datafil eller en ny
 * biblioteksversjon innføre et avvik, blir det en rød test med filnavnet i —
 * ikke en stille endring av hva arkivet inneholder.
 *
 * `yaml` er fortsatt det som skriver (stringify). Dette gjelder bare lesing.
 *
 * Returtypen er `any`, akkurat som `yaml.parse` ga. Det er med vilje: et
 * YAML-dokument er ukjent til noen har kontrollert det, og den kontrollen gjør
 * arkivet med zod i `load.ts`. Å returnere `unknown` herfra ville ikke gjort
 * noen av kallerne tryggere, bare tvunget inn en cast på hvert sted.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseArchiveYaml(text: string): any {
  return load(text, { schema: CORE_SCHEMA });
}
