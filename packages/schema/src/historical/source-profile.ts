import { z } from "zod";
import type { HarvestFindingType } from "./harvest-finding.js";
import type { Source } from "../source.js";

export const harvestProfileEnum = z.enum([
  "member_magazine",
  "yearbook",
  "annual_report",
  "anniversary_book",
  "match_program",
  "generic_publication",
]);

export type HarvestProfileId = z.infer<typeof harvestProfileEnum>;

export interface HarvestRequiredPass {
  id: string;
  name: string;
  description: string;
}

export interface HarvestSourceProfile {
  id: HarvestProfileId;
  name: string;
  description: string;
  recommendedFindingTypes: HarvestFindingType[];
  specialWarnings: string[];
  requiredPasses: HarvestRequiredPass[];
}

export const CORE_HISTORICAL_PASSES: HarvestRequiredPass[] = [
  {
    id: "facsimile_review",
    name: "Fullstendig faksimilereview",
    description: "Visuell gjennomgang av samtlige tilgjengelige sider mot faksimile/skann.",
  },
  {
    id: "explicit_results",
    name: "Kamper og resultater",
    description: "Vurdering og avstemming av kampresultater, motstandere, datoer og mål.",
  },
  {
    id: "people_and_roles",
    name: "Personer og roller",
    description: "Gjennomgang av spillere, trenere, tillitsvalgte, dommere og æresmedlemmer.",
  },
  {
    id: "organization",
    name: "Organisasjon og styre",
    description: "Årsmøter, styresammensetning, utvalg og organisatoriske endringer.",
  },
  {
    id: "retrospectives_and_claims",
    name: "Retrospektive påstander og jubileer",
    description: "Historiske tilbakeblikk og memoarer (faktum-år skilles fra utgivelsesår).",
  },
  {
    id: "observations",
    name: "Historiske observasjoner",
    description: "Milepæler, anlegg, baner, arrangementer og administrative vedtak.",
  },
];

export const SOURCE_PROFILES: Record<HarvestProfileId, HarvestSourceProfile> = {
  member_magazine: {
    id: "member_magazine",
    name: "AaFK Medlemsblad",
    description: "Klubbens interne medlemsblad og periodiske hefter.",
    recommendedFindingTypes: [
      "match_result",
      "fixture",
      "season_fact",
      "person",
      "person_role",
      "organization",
      "meeting",
      "historical_observation",
      "retrospective_claim",
      "source_conflict",
    ],
    specialWarnings: [
      "Én årgang kan bestå av flere hefter/sourceIds med ulik periodisitet.",
      "Terminlister forekommer ofte; sjekk om datoer representerer oppsatt eller faktisk spilt kamp.",
      "Samtidige kampreferater gir ofte rikere detaljer om lagoppstillinger og tilskuere.",
      "Pass på reprints mellom jubileumsnummer og ordinære hefter.",
    ],
    requiredPasses: [
      ...CORE_HISTORICAL_PASSES,
      {
        id: "fixture_reconciliation",
        name: "Terminliste-avstemming",
        description: "Kontrollere oppsatte terminlister mot faktiske kilderesultater.",
      },
    ],
  },

  yearbook: {
    id: "yearbook",
    name: "NFF Årbok",
    description: "Norges Fotballforbunds årlige offisielle årbøker og oversikter.",
    recommendedFindingTypes: [
      "match_result",
      "table",
      "person",
      "person_role",
      "organization",
      "meeting",
      "honor",
      "milestone",
      "historical_observation",
    ],
    specialWarnings: [
      "Stor nasjonal publikasjon med mye innhold som ikke gjelder AaFK.",
      "AaFK-relevant betyr ikke bare kamper: forbundsting, delegater, komiteer og kretsverv skal også vurderes.",
      "Tabeller og kontrollsummer må verifiseres.",
      "Vær oppmerksom på retrospektive lister over landskamper, kretsmesterskap og cuphistorikk.",
    ],
    requiredPasses: CORE_HISTORICAL_PASSES,
  },

  annual_report: {
    id: "annual_report",
    name: "Årsberetning / Årsrapport",
    description: "Årsrapporter fra klubben, Sunnmøre Fotballkrets eller særkretser.",
    recommendedFindingTypes: [
      "table",
      "match_result",
      "season_fact",
      "person",
      "person_role",
      "organization",
      "meeting",
      "honor",
      "non_senior",
      "historical_observation",
    ],
    specialWarnings: [
      "Inneholder ofte resultater og tabeller for junior, B-lag og aldersbestemt som må merkes som non_senior.",
      "Kretsadministrasjon, dommeroppnevnelser og utmerkelser skal registreres strukturert.",
      "Skille mellom AaFK A-lag og andre lokale klubber i kretsen.",
    ],
    requiredPasses: [
      ...CORE_HISTORICAL_PASSES,
      {
        id: "senior_level_separation",
        name: "Nivå- og aldersskille",
        description: "Skille A-lagsdata fra junior-/B-lagsdata (disposisjon: non_senior).",
      },
    ],
  },

  anniversary_book: {
    id: "anniversary_book",
    name: "Jubileumsbok / Historiebok",
    description: "Jubileumsbøker, festskrift og historiske samleverk over flere tiår.",
    recommendedFindingTypes: [
      "retrospective_claim",
      "person",
      "person_role",
      "honor",
      "milestone",
      "historical_observation",
      "match_result",
      "source_conflict",
      "venue",
    ],
    specialWarnings: [
      "KRITISK: Kildeutgivelsesår er IKKE historisk faktum-år (source publication year ≠ historical fact year).",
      "Spenn over mange tiår i samme bok; pass på datering av påstander og verv.",
      "Memoarer og gjenfortalte historier skal vurderes kildekritisk (confidence: probable/uncertain).",
      "Sjekk mot eksisterende arkivdata før retting av etablerte kamper/resultater.",
    ],
    requiredPasses: [
      ...CORE_HISTORICAL_PASSES,
      {
        id: "chronology_audit",
        name: "Kronologiavstemming",
        description: "Verifisere at alle påstander er tidfestet til historisk faktum-år, ikke bokens utgivelsesår.",
      },
    ],
  },

  match_program: {
    id: "match_program",
    name: "Kampprogram",
    description: "Offisielle kampprogrammer, turneringshefter og kamppublikasjoner.",
    recommendedFindingTypes: [
      "fixture",
      "person",
      "person_role",
      "historical_observation",
      "milestone",
      "venue",
    ],
    specialWarnings: [
      "Kampprogrammer trykkes FØR kampen spilles; oppgitte oppstillinger er forventede/foreslåtte, ikke fasit.",
      "Datoer og klokkeslett kan ha blitt endret etter trykking.",
      "Gode kilder til tabellposisjoner, draktnumre og historiske omtaler på trykketidspunktet.",
    ],
    requiredPasses: CORE_HISTORICAL_PASSES,
  },

  generic_publication: {
    id: "generic_publication",
    name: "Generisk historisk publikasjon",
    description: "Standard profil for alle andre eller ukjente historiske publikasjoner.",
    recommendedFindingTypes: [
      "match_result",
      "fixture",
      "season_fact",
      "person",
      "person_role",
      "organization",
      "historical_observation",
      "retrospective_claim",
      "other",
    ],
    specialWarnings: [
      "Generisk kilde: Gjennomfør alle standardpass og dokumenter eventuelle særtrekk i batch-notatene.",
    ],
    requiredPasses: CORE_HISTORICAL_PASSES,
  },
};

/**
 * Utleder den best egnede kildeprofilen basert på metadata fra kilden eller katalogen.
 */
export function inferSourceProfile(
  src?: Partial<Source> | { sourceType?: string; title?: string; parentSourceId?: string; id?: string },
): HarvestProfileId {
  if (!src) return "generic_publication";

  if (src.sourceType === "member_magazine" || src.parentSourceId === "aafk-medlemsblad") {
    return "member_magazine";
  }

  if (src.sourceType === "annual_report" || src.parentSourceId === "sfk-annual-reports") {
    return "annual_report";
  }

  if (src.sourceType === "anniversary_book" || (src.title && /jubileum|festskrift|\d+\s*år/i.test(src.title))) {
    return "anniversary_book";
  }

  if (src.sourceType === "match_program") {
    return "match_program";
  }

  if (
    src.id?.startsWith("nff-") ||
    src.parentSourceId === "nff-yearbooks" ||
    src.parentSourceId === "nff-arbok" ||
    (src.title && /årbok|aarbok|yearbook/i.test(src.title))
  ) {
    return "yearbook";
  }

  return "generic_publication";
}
