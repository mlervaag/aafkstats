import { z } from "zod";
import { foundingYear, historicalName, httpUrl, isoDate, seasonYear, slug } from "./primitives.js";

/** AaFKs egen klubb-ID. Brukt overalt der arkivet må vite «hvilken side er oss». */
export const AAFK_CLUB_ID = "aalesunds-fk";

/**
 * En klubb — AaFK selv eller en motstander.
 *
 * `names` er tidsavhengig fordi klubber bytter navn (Lyn, Bodø/Glimt, Kristiansund).
 * En kamp fra 1975 skal vise navnet som gjaldt i 1975, ikke dagens.
 */
export const club = z
  .object({
    id: slug,
    name: z.string().min(1),
    shortName: z.string().min(1).optional(),
    names: z.array(historicalName).default([]),
    country: z.string().length(2).default("NO"),
    city: z.string().optional(),
    founded: foundingYear.optional(),
    aliases: z.record(z.union([z.string(), z.number()])).default({}),
    note: z.string().optional(),
  })
  .strict();

export type Club = z.infer<typeof club>;

/** Stadion eller bane. Navn er tidsavhengig av samme grunn som for klubber. */
export const venue = z
  .object({
    id: slug,
    name: z.string().min(1),
    names: z.array(historicalName).default([]),
    city: z.string().optional(),
    country: z.string().length(2).default("NO"),
    capacity: z.number().int().positive().optional(),
    opened: foundingYear.optional(),
    closed: foundingYear.optional(),
    note: z.string().optional(),
  })
  .strict();

export type Venue = z.infer<typeof venue>;

/**
 * Konkurransetype. Dette feltet driver hele navigasjonen på nettstedet
 * (Liga / Cup / Europa / Treningskamper) — derfor er det en lukket enum og ikke fritekst.
 */
export const competitionType = z.enum([
  "league",
  "national_cup",
  "european",
  "friendly",
  "playoff",
]);

export type CompetitionType = z.infer<typeof competitionType>;

/**
 * En konkurranse. `names` dekker navnebyttene: 1. divisjon → Tippeligaen → Eliteserien
 * er samme konkurranse, og en kamp fra 1998 skal si «Tippeligaen».
 */
export const competition = z
  .object({
    id: slug,
    name: z.string().min(1),
    names: z.array(historicalName).default([]),
    type: competitionType,
    /** Nivå i seriepyramiden. 1 = øverste. Kun for `league`. */
    tier: z.number().int().min(1).max(10).optional(),
    organizer: z.string().optional(),
    country: z.string().length(2).nullable().default("NO"),
    note: z.string().optional(),
  })
  .strict();

export type Competition = z.infer<typeof competition>;

/** En kildekatalogoppføring — hvem leverer data, under hvilken lisens, og hvor mye vi stoler på den. */
/**
 * Om kilden kan hentes automatisk.
 *
 * `blocked` betyr at vi vet vi ikke skal: robots.txt, uttrykkelig forbud mot
 * roboter, eller en teknisk sperre som bare kan omgås ved å late som noe annet.
 */
export const automatedAccess = z.enum(["allowed", "permission_required", "blocked", "unknown"]);

/**
 * Om det vi henter kan publiseres videre i et offentlig arkiv.
 *
 * Dette er et *annet* spørsmål enn om vi kan hente. At et sluttresultat er et
 * faktum uten opphavsrett sier ingenting om databasevernet på samlingen det ble
 * hentet fra, og heller ikke om vilkårene kilden selv har satt. RSSSF tillater
 * for eksempel privat, ikke-kommersiell kopiering med kreditering — et offentlig
 * GitHub-arkiv og et offentlig nettsted er ikke åpenbart privat bruk.
 */
export const publicRedistribution = z.enum(["allowed", "permission_required", "denied", "unknown"]);

/**
 * Hvor langt en forespørsel om tillatelse har kommet.
 *
 * Dette er utelukkende hva *motparten* har sagt. Vår egen beslutning om å høste
 * inn ligger i `ingestDecision`, og det er et annet spørsmål.
 *
 * Skillet var borte tidligere: `accepted_risk` sto som en tillatelsesstatus, og
 * da kunne ikke RSSSF være både forespurt og videreført. Verre: den så ut som en
 * status motparten hadde gitt oss, når den var vår egen. Et arkiv som fører
 * «tillatelse gitt» der ingen tillatelse finnes, er verre enn ett som sier hva
 * det faktisk vet.
 */
export const permissionStatus = z.enum([
  "not_needed",
  "pending",
  "requested",
  "granted",
  "denied",
]);

/**
 * Vår egen beslutning om å høste inn fra kilden.
 *
 * `accepted_risk` betyr at prosjekteieren har lest vilkårene, forstått at bruken
 * ikke er uttrykkelig tillatt, og likevel bestemt seg for å gå videre. Den er en
 * beslutning, ikke en tillatelse, og krever `riskAcceptedAt` og en note som sier
 * hvem som bestemte.
 *
 * Kombinasjonen `permissionStatus: requested` med `ingestDecision: accepted_risk`
 * er den ærlige beskrivelsen av RSSSF: vi har spurt, vi har ikke fått svar, og vi
 * går videre med åpne øyne.
 */
export const ingestDecision = z.enum(["blocked", "pending", "allowed", "accepted_risk"]);

export const source = z
  .object({
    id: slug,
    name: z.string().min(1),
    url: httpUrl.optional(),
    /** Høyere tall vinner når to kilder er uenige om samme felt. */
    priority: z.number().int().min(0).max(100),
    license: z.string().optional(),

    /**
     * Rettighetsstatus som data, ikke som prosa i et notat.
     *
     * Poenget er at «kan hentes» og «kan publiseres» blir to felt en maskin kan
     * lese, slik at innhøstings-CLI-en kan nekte å skrive når publisering ikke er
     * avklart — selv om adapteren teknisk sett virker utmerket.
     */
    automatedAccess: automatedAccess.default("unknown"),
    publicRedistribution: publicRedistribution.default("unknown"),
    attributionRequired: z.boolean().default(false),
    permissionStatus: permissionStatus.default("pending"),
    ingestDecision: ingestDecision.default("pending"),
    /** Når forespørselen om tillatelse ble sendt. */
    permissionRequestedAt: isoDate.optional(),
    /** Når risikoen ble akseptert, og av hvem. Begge kreves ved accepted_risk. */
    riskAcceptedAt: isoDate.optional(),
    riskAcceptedBy: z.string().min(1).optional(),
    /** Når vilkårene sist ble lest av et menneske. */
    termsCheckedAt: isoDate.optional(),
    /** Når robots.txt sist ble kontrollert. */
    robotsCheckedAt: isoDate.optional(),
    /** Hvem som er spurt, hva svaret var, hvor korrespondansen ligger. */
    permissionNote: z.string().optional(),

    /** Kort notat om hva kilden dekker og hvilke forbehold som gjelder. */
    note: z.string().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    // En bevisst risikobeslutning uten spor er ikke etterprøvbar, og da er den
    // heller ikke en beslutning, bare en avkrysning.
    if (value.ingestDecision === "accepted_risk") {
      if (!value.riskAcceptedAt || !value.riskAcceptedBy) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["riskAcceptedAt"],
          message: "ingestDecision «accepted_risk» krever riskAcceptedAt og riskAcceptedBy",
        });
      }
      if (!value.permissionNote) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["permissionNote"],
          message: "ingestDecision «accepted_risk» krever permissionNote som forklarer avveiningen",
        });
      }
    }

    // Å påstå at vi går videre når motparten har sagt nei er ikke en avveining,
    // det er å overse et svar.
    if (value.permissionStatus === "denied" && value.ingestDecision !== "blocked") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ingestDecision"],
        message: "permissionStatus «denied» krever ingestDecision «blocked»",
      });
    }

    if (value.permissionStatus === "requested" && !value.permissionRequestedAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["permissionRequestedAt"],
        message: "permissionStatus «requested» krever permissionRequestedAt",
      });
    }
  });

/**
 * Om arkivet har lov til å publisere data fra denne kilden.
 *
 * Brukes som port i innhøstingen. Den er bevisst streng: `unknown` er ikke et ja.
 */
export function mayPublish(value: Source): boolean {
  // Beslutningen vår er porten, ikke tillatelsesstatusen. En kilde vi har sagt
  // nei til skal ikke slippe gjennom fordi vilkårene tilfeldigvis er åpne.
  if (value.ingestDecision === "blocked") return false;
  if (value.publicRedistribution === "allowed") return true;
  if (value.publicRedistribution === "denied") return false;
  return value.permissionStatus === "granted" || value.ingestDecision === "accepted_risk";
}

/** Om arkivet har lov til å hente automatisk fra kilden. */
export function mayFetch(value: Source): boolean {
  if (value.ingestDecision === "blocked") return false;
  if (value.automatedAccess === "allowed") return true;
  if (value.automatedAccess === "blocked") return false;
  return value.permissionStatus === "granted" || value.ingestDecision === "accepted_risk";
}

export type Source = z.infer<typeof source>;

/** Sesongmeta: hvilken divisjon AaFK spilte i, hvordan det gikk, og hvem som ledet laget. */
export const season = z
  .object({
    year: seasonYear,
    competitionId: slug,
    finalPosition: z.number().int().positive().nullable().default(null),
    teamsInLeague: z.number().int().positive().optional(),
    headCoach: z.string().optional(),
    promoted: z.boolean().default(false),
    relegated: z.boolean().default(false),
    note: z.string().optional(),
  })
  .strict();

export type Season = z.infer<typeof season>;

export const seasonFile = season;

/** Kalenderdato brukt av CLI-en for å avgjøre hvilket navn som gjaldt. */
export function nameAt(names: { name: string; from: string | null; to: string | null }[], fallback: string, date: string): string {
  for (const entry of names) {
    const afterStart = entry.from === null || date >= entry.from;
    const beforeEnd = entry.to === null || date <= entry.to;
    if (afterStart && beforeEnd) return entry.name;
  }
  return fallback;
}

export { isoDate };
