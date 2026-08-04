import { z } from "zod";
import { seasonYear, slug, sourceRef } from "./primitives.js";

/**
 * En person i arkivet: spiller, trener, eller begge.
 *
 * ## Hvorfor dette finnes
 *
 * Navnene i lagoppstillingene er strenger, og `personKey()` gjør så godt den
 * kan: den slår sammen skrivemåter som er samme bokstav skrevet på to måter.
 * Det den ikke kan, er å avgjøre om «Mathias Kristensen» og «Mathias
 * Christensen» er samme mann.
 *
 * Wikipedia svarer på det. Begge står i samme stall, med hvert sitt draktnummer
 * og hver sin nasjonalitet. Med en fil per person kan arkivet *påstå* at de er
 * to, med kilde, i stedet for bare å la være å gjette.
 *
 * ## Hva filene ikke er
 *
 * Ikke en liste over alle som har spilt. De fleste finnes bare som et navn i en
 * oppstilling, og det er nok. En fil lages når det er noe å si: en skrivemåte
 * som må knyttes til personen, et draktnummer, en posisjon, eller en
 * trenerperiode fra før kampdataene rekker.
 *
 * Ikke et sted for biografi heller. Fødselsdato, karriere og klubbhistorikk
 * ligger på Wikidata, som er CC0, og `wikidata`-feltet peker dit i stedet for
 * at vi kopierer det hit.
 */

/** Posisjonene stallmalen på Wikipedia bruker, skrevet ut. */
export const playingPosition = z.enum(["keeper", "forsvar", "midtbane", "angrep"]);

export type PlayingPosition = z.infer<typeof playingPosition>;

/** Draktnummeret personen hadde en gitt sesong. Nummer flytter seg mellom år. */
export const squadNumber = z
  .object({
    season: seasonYear,
    number: z.number().int().min(1).max(99),
  })
  .strict();

/**
 * En periode personen var hovedtrener, oppgitt av en kilde.
 *
 * Periodene for 2010 og senere utledes av hvem som står oppført på hver kamp,
 * og de er de nøyaktige. Dette feltet er for årene før kampdataene rekker: der
 * har vi bare årstall, og det står det.
 */
export const declaredCoachSpell = z
  .object({
    fromSeason: seasonYear,
    /** Null når perioden ikke er avsluttet i kilden. */
    toSeason: seasonYear.nullable().default(null),
    note: z.string().optional(),
  })
  .strict();

export const person = z
  .object({
    /** Slug av navnet. `mathias-kristensen` og `mathias-christensen` er to. */
    id: slug,
    /** Navnet slik arkivet viser det. */
    name: z.string().min(1),
    /**
     * Andre skrivemåter kildene bruker.
     *
     * Det som ikke lar seg utlede av `personKey()`. «Sten Grytebust» og «Sten
     * Michael Grytebust» er samme mann, men mellomnavnet er ikke en
     * translitterasjon, og bare et menneske eller en kilde kan si det.
     */
    names: z.array(z.string().min(1)).default([]),
    /** Nasjonalitet slik kilden skrev den. Norsk Wikipedia skriver «Danmark». */
    nationality: z.string().min(1).optional(),
    position: playingPosition.optional(),
    /** Wikidata-ID. Data derfra er CC0, så vi lenker i stedet for å kopiere. */
    wikidata: z.string().regex(/^Q[1-9]\d*$/, "må være en Wikidata-ID, f.eks. Q1796755").optional(),
    squadNumbers: z.array(squadNumber).default([]),
    coachSpells: z.array(declaredCoachSpell).default([]),
    sources: z.array(sourceRef).default([]),
    note: z.string().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const seasons = new Set<number>();
    for (const entry of value.squadNumbers) {
      if (seasons.has(entry.season)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["squadNumbers"],
          message: `to draktnummer oppgitt for ${entry.season}`,
        });
      }
      seasons.add(entry.season);
    }

    for (const spell of value.coachSpells) {
      if (spell.toSeason !== null && spell.toSeason < spell.fromSeason) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["coachSpells"],
          message: `perioden slutter (${spell.toSeason}) før den begynner (${spell.fromSeason})`,
        });
      }
    }
  });

export type Person = z.infer<typeof person>;

/** Filstien en person får: `people/<id>.yaml`. */
export function personPath(id: string): string {
  return `people/${id}.yaml`;
}
