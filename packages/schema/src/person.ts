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

/** Hvilken vei spilleren gikk. AaFK er alltid den ene siden, så retningen holder. */
export const transferDirection = z.enum(["in", "out"]);

export type TransferDirection = z.infer<typeof transferDirection>;

/**
 * Hva slags overgang det var.
 *
 * `transfer` dekker det vanlige og er standard. De andre finnes fordi de betyr
 * noe annet for den som leser — et lån er ikke et salg, og en som la opp gikk
 * ikke til noen — ikke fordi lista skal være uttømmende.
 */
export const transferKind = z.enum([
  "transfer",
  "loan",
  "loan_return",
  "free",
  /** Opp fra egen ungdomsavdeling. Bare `in`. */
  "academy",
  /** Kontrakt utløpt eller hevet, uten at kilden oppgir noen ny klubb. Bare `out`. */
  "released",
  /** La opp. Bare `out`. */
  "retired",
]);

export type TransferKind = z.infer<typeof transferKind>;

/**
 * En kildeført overgang inn til eller ut av AaFK.
 *
 * ## Hvorfor den ikke er en rolle
 *
 * Fire overganger fra medlemsbladet 1950 lå tidligere i `roles`, med retning og
 * klubb bare i fritekstnotatet: «Meldte overgang fra AaFK til Volda T. & I.L.
 * høsten 1950.» En rolle er en *periode i et verv* med tittel og organ; en
 * overgang er en *hendelse med retning og motpart*. Lagret som rolle er den
 * verken søkbar, grupperbar per sesong eller mulig å vise, og det er grunnen
 * til at arkivet ikke har hatt overganger.
 *
 * ## Hva den gjør mulig
 *
 * Stallen vet allerede hvem som var «ny» en sesong, men ikke hvorfor: en som
 * var skadet hele fjoråret ser like ny ut som en nysignering. En overgang er
 * nettopp kilden som skiller dem, og gjør «ny» til «hentet fra Hødd». Den
 * andre veien har manglet helt, fordi «sluttet» uten kilde ville vært en
 * påstand om hva som skjedde med spilleren.
 *
 * ## Hva den ikke inneholder
 *
 * Ingen overgangssum. Beløp er sjelden dokumentert, ofte et rykte, og et felt
 * som finnes blir fylt. Oppgir en kilde faktisk en sum, hører den hjemme i
 * `note` sammen med kilden som sa den.
 */
export const transfer = z
  .object({
    /** Stabil innenfor personfila, som rolle-ID-ene: `ut-volda-1950`. */
    id: slug,
    direction: transferDirection,
    kind: transferKind.default("transfer"),
    /**
     * Klubben slik kilden skriver den, og den skrivemåten bevares alltid.
     * «Volda T. & I.L.» er hva medlemsbladet sa. Null bare når kilden ikke
     * navngir noen klubb — en som la opp, eller en kontrakt som løp ut.
     */
    club: z.string().min(1).nullable().default(null),
    /**
     * Arkivets klubb-ID, når klubben finnes i `data/clubs/`. De klubbene er
     * motstandere, og en spiller går ofte til en klubb AaFK aldri har møtt.
     * Da står feltet tomt; det skal ikke opprettes en klubbfil for å fylle det.
     */
    clubId: slug.optional(),
    /** Datoen kilden oppgir. «Høsten 1950» er `"1950"` — ikke en gjettet dag. */
    date: historicalDate,
    /**
     * Sesongen overgangen gjelder for. Standard er året i `date`, som stemmer
     * for nesten alt. Feltet finnes for vintervinduet: en spiller hentet i
     * desember 2015 hører til stallen i 2016, ikke i 2015.
     */
    season: seasonYear.optional(),
    /**
     * Historiske publikasjoner som dokumenterer overgangen.
     *
     * Tom når kilden er en nettmelding og ikke et dokument i `data/sources/`.
     * Da bærer `providers` provenienset i stedet — se regelen under.
     */
    sources: z.array(sourceRef).default([]),
    /**
     * Dataleverandører som dokumenterer overgangen, med adressen og hentetiden.
     *
     * Samme skille som kampene gjør: en klubbmelding på nett er ikke et
     * historisk dokument med sidetall, og å opprette en `source`-fil per
     * nyhetssak ville fylt publikasjonskatalogen med lenker. Leverandøren er
     * riktig sted, og `url` er det en leser kan kontrollere påstanden mot.
     */
    providers: z.array(providerRef).default([]),
    note: z.string().optional(),
  })
  .strict()
  .refine(
    (value) => value.sources.length > 0 || value.providers.length > 0,
    { message: "en overgang må ha minst én kilde — enten en publikasjon eller en leverandør" },
  );

export type Transfer = z.infer<typeof transfer>;

/** Sesongen overgangen føres på: den kilden oppgir, ellers året i datoen. */
export function transferSeason(entry: Pick<Transfer, "date" | "season">): number {
  return entry.season ?? Number(entry.date.slice(0, 4));
}

/** Draktnummeret personen hadde en gitt sesong. Nummer flytter seg mellom år. */
export const squadNumber = z
  .object({
    season: seasonYear,
    number: z.number().int().min(1).max(99),
  })
  .strict();

export type SquadNumber = z.infer<typeof squadNumber>;

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

export type DeclaredCoachSpell = z.infer<typeof declaredCoachSpell>;

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
    /**
     * Overganger inn til og ut av klubben, slik en kilde dokumenterer dem.
     *
     * At feltet står her og ikke i en egen katalog er med vilje: en overgang
     * uten en person er ingenting, og personfilene lastes og valideres
     * allerede. Prisen er at en overgang krever at personfila finnes — og det
     * er riktig utfall. «En fil lages når det er noe å si», og en kildeført
     * overgang er en sterkere grunn til en fil enn et draktnummer er.
     */
    transfers: z.array(transfer).default([]),
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

    const transferIds = new Set<string>();
    const inbound = new Set<TransferKind>(["academy"]);
    const outbound = new Set<TransferKind>(["released", "retired"]);
    const clubless = new Set<TransferKind>(["released", "retired"]);
    for (const entry of value.transfers) {
      const at = (message: string) => ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["transfers", entry.id],
        message,
      });

      if (transferIds.has(entry.id)) at(`to overganger har ID-en «${entry.id}»`);
      transferIds.add(entry.id);

      if (inbound.has(entry.kind) && entry.direction !== "in") {
        at(`«${entry.kind}» er en overgang inn, ikke ut`);
      }
      if (outbound.has(entry.kind) && entry.direction !== "out") {
        at(`«${entry.kind}» er en overgang ut, ikke inn`);
      }
      // «La opp» med en klubb oppgitt er to påstander som motsier hverandre.
      // Gikk han til noen, er det ikke det kilden sier.
      if (clubless.has(entry.kind) && (entry.club !== null || entry.clubId !== undefined)) {
        at(`«${entry.kind}» betyr at kilden ikke oppgir noen klubb — fjern club/clubId eller endre kind`);
      }

      // Vintervinduet strekker seg over årsskiftet, og ikke lenger. Alt annet er
      // en skrivefeil som ellers ville flyttet spilleren til feil sesongside.
      const year = Number(entry.date.slice(0, 4));
      if (entry.season !== undefined && entry.season !== year && entry.season !== year + 1) {
        at(`sesongen ${entry.season} hører ikke til datoen ${entry.date}`);
      }
    }
  });

export type Person = z.infer<typeof person>;

/** Filstien en person får: `people/<id>.yaml`. */
export function personPath(id: string): string {
  return `people/${id}.yaml`;
}
