import { z } from "zod";
import { conflict, seasonYear, slug, providerRef, sourceRef } from "./primitives.js";

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

/**
 * En person kan ha flere slags tilknytning til klubben gjennom livet. Kategorien
 * er stabil og søkbar; `title` beholder den historiske betegnelsen kilden bruker.
 */
export const personRoleCategory = z.enum([
  "player",
  "coach",
  "sporting_staff",
  "board",
  "administration",
  "honorary",
  "founder",
  "project",
]);

/** År eller eksakt dato. Mange eldre kilder sier bare hvilket styreår vervet gjaldt. */
export const historicalDate = z.string().regex(/^\d{4}(?:-\d{2}-\d{2})?$/, "må være ÅÅÅÅ eller ÅÅÅÅ-MM-DD");

export const personRole = z
  .object({
    /** Stabil innenfor personfila; gjør rollen adresserbar uten å gjette fra tittelen. */
    id: slug,
    category: personRoleCategory,
    title: z.string().min(1),
    /** Juridisk eller organisatorisk enhet rollen er knyttet til. */
    organizationId: slug.optional(),
    /** Organisasjonsdelen rollen hører til, for eksempel Hovedstyret eller A-laget. */
    body: z.string().min(1).optional(),
    from: historicalDate,
    /** Null betyr at kilden ikke oppgir noen slutt eller at rollen fortsatt løper. */
    to: historicalDate.nullable().default(null),
    sources: z.array(sourceRef).min(1, "en rolle må ha minst én historisk kilde"),
    note: z.string().optional(),
  })
  .strict();

export type PersonRole = z.infer<typeof personRole>;

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
    /**
     * Dagen perioden begynte og sluttet, der kilden oppgir den.
     *
     * En trenerjobb begynner sjelden 1. januar: Kjetil Rekdal ble ansatt 4.
     * september 2008 og fikk oppsigelsen 26. november 2012. Sesongtallene
     * alene sier «2008-2012», og det er riktig, men det er ikke det kilden
     * sier. Datoene er valgfrie fordi de eldre periodene bare finnes som
     * årstall — de fleste kildene oppgir aldri en dag.
     */
    fromDate: historicalDate.optional(),
    toDate: historicalDate.optional(),
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
    roles: z.array(personRole).default([]),
    providers: z.array(providerRef).default([]),
    sources: z.array(sourceRef).default([]),
    /**
     * Kilder som er uenige om et verv.
     *
     * Klubbens egne sider og jubileumsbøkene oppgir ulike navn for samme år, og
     * medlemsbladenes kolofoner sier iblant noe tredje. Uenigheten er en
     * opplysning i seg selv — at to kilder skriver forskjellig er nettopp det
     * en leser trenger å vite — og den bevares i stedet for at maskinen velger
     * i stillhet.
     *
     * `field` er vervet og året, som «formann.1968». Verdiene er navnene
     * kildene oppgir. Ingen løses automatisk: `unresolved` er en ærlig
     * tilstand, og et bidrag utenfra kan avgjøre den med `manual`.
     */
    conflicts: z.array(conflict).default([]),
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
      // En dato som ikke hører til sesongen den står under er en skrivefeil, og
      // den ville ellers vist en periode som begynner et annet år enn den gjør.
      if (spell.fromDate && Number(spell.fromDate.slice(0, 4)) !== spell.fromSeason) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["coachSpells"],
          message: `fromDate (${spell.fromDate}) hører ikke til sesongen ${spell.fromSeason}`,
        });
      }
      if (spell.toDate && spell.toSeason !== null && Number(spell.toDate.slice(0, 4)) !== spell.toSeason) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["coachSpells"],
          message: `toDate (${spell.toDate}) hører ikke til sesongen ${spell.toSeason}`,
        });
      }
      if (spell.toDate && spell.toSeason === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["coachSpells"],
          message: "en periode uten sluttsesong kan ikke ha en sluttdato",
        });
      }
      if (spell.toSeason !== null && spell.toSeason < spell.fromSeason) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["coachSpells"],
          message: `perioden slutter (${spell.toSeason}) før den begynner (${spell.fromSeason})`,
        });
      }
    }

    const roleIds = new Set<string>();
    for (const role of value.roles) {
      if (roleIds.has(role.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["roles"],
          message: `to roller har ID-en «${role.id}»`,
        });
      }
      roleIds.add(role.id);
      if (role.to !== null && role.to < role.from) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["roles", role.id, "to"],
          message: `rollen slutter (${role.to}) før den begynner (${role.from})`,
        });
      }
    }
  });

export type Person = z.infer<typeof person>;

/** Filstien en person får: `people/<id>.yaml`. */
export function personPath(id: string): string {
  return `people/${id}.yaml`;
}
