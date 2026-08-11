import { slugify } from "@aafkstats/schema";
import type { PlayingPosition } from "@aafkstats/schema";
import { fetchJson } from "../http.js";
import { AAFK_FOTMOB_ID } from "./fotmob.js";

const BASE = "https://www.fotmob.com/api/data";

export interface FotmobPlayerCandidate {
  id: string;
  name: string;
  teamName?: string;
  isCoach: boolean;
}

export interface FotmobAafkCareer {
  from?: string;
  to?: string;
  appearances?: number;
  goals?: number;
}

export interface FotmobPlayerProfile {
  id: string;
  name: string;
  url: string;
  position?: PlayingPosition;
  rawPosition?: string;
  nationality?: string;
  rawNationality?: string;
  countryCode?: string;
  aafkCareer: FotmobAafkCareer[];
}

interface RawSearchSection {
  suggestions?: {
    type?: string;
    id?: string | number;
    name?: string;
    isCoach?: boolean;
    teamName?: string;
  }[];
}

interface RawProfile {
  id?: string | number;
  name?: string;
  positionDescription?: {
    primaryPosition?: { label?: string; key?: string } | null;
  };
  playerInformation?: {
    translationKey?: string;
    countryCode?: string;
    value?: { fallback?: unknown };
  }[];
  careerHistory?: {
    careerItems?: {
      senior?: {
        teamEntries?: {
          teamId?: string | number;
          startDate?: string | null;
          endDate?: string | null;
          appearances?: string | number | null;
          goals?: string | number | null;
        }[];
      };
    };
  };
}

/**
 * Oppdager kandidater for ett arkivnavn. Resultatet skrives aldri direkte:
 * FotMob gjentar treff i flere seksjoner, og et eksakt navn er fortsatt ikke
 * det samme som en bekreftet personidentitet.
 */
export async function discoverFotmobPlayers(
  name: string,
  options: { refresh?: boolean } = {},
): Promise<FotmobPlayerCandidate[]> {
  const url = `${BASE}/search/suggest?term=${encodeURIComponent(name)}`;
  const sections = await fetchJson<RawSearchSection[]>(url, options);
  return parseFotmobPlayerCandidates(sections);
}

export function parseFotmobPlayerCandidates(sections: RawSearchSection[]): FotmobPlayerCandidate[] {
  const candidates = new Map<string, FotmobPlayerCandidate>();
  for (const suggestion of sections.flatMap((section) => section.suggestions ?? [])) {
    const id = String(suggestion.id ?? "");
    const candidateName = suggestion.name?.trim();
    if (suggestion.type !== "player" || id === "" || !candidateName) continue;
    candidates.set(id, {
      id,
      name: candidateName,
      isCoach: suggestion.isCoach ?? false,
      ...(suggestion.teamName ? { teamName: suggestion.teamName } : {}),
    });
  }
  return [...candidates.values()];
}

/** Henter én valgt spiller-ID og bare fakta personmodellen faktisk bruker. */
export async function fetchFotmobPlayerProfile(
  id: string,
  options: { refresh?: boolean } = {},
): Promise<FotmobPlayerProfile> {
  if (!/^\d+$/.test(id)) throw new Error("FotMob-spiller-ID må være et positivt heltall");
  const raw = await fetchJson<RawProfile>(`${BASE}/playerData?id=${id}`, options);
  return parseFotmobPlayerProfile(raw, id);
}

export function parseFotmobPlayerProfile(raw: RawProfile, id: string): FotmobPlayerProfile {
  const returnedId = String(raw.id ?? "");
  const name = raw.name?.trim();
  if (returnedId !== id || !name) throw new Error(`FotMob returnerte ikke spiller ${id}`);

  const primary = raw.positionDescription?.primaryPosition;
  const rawPosition = primary?.label?.trim();
  const position = mapFotmobPosition(primary?.key, rawPosition);
  const country = raw.playerInformation?.find((item) => item.translationKey === "country_sentencecase");
  const rawNationality = typeof country?.value?.fallback === "string" ? country.value.fallback.trim() : undefined;
  const countryCode = country?.countryCode?.toUpperCase();
  const nationality = countryCode ? NORWEGIAN_COUNTRIES[countryCode] : undefined;
  const aafkCareer = (raw.careerHistory?.careerItems?.senior?.teamEntries ?? [])
    .filter((entry) => String(entry.teamId ?? "") === AAFK_FOTMOB_ID)
    .map((entry) => ({
      ...(entry.startDate ? { from: entry.startDate.slice(0, 10) } : {}),
      ...(entry.endDate ? { to: entry.endDate.slice(0, 10) } : {}),
      ...numberField("appearances", entry.appearances),
      ...numberField("goals", entry.goals),
    }));

  return {
    id,
    name,
    url: `https://www.fotmob.com/players/${id}/${slugify(name)}`,
    ...(position ? { position } : {}),
    ...(rawPosition ? { rawPosition } : {}),
    ...(nationality ? { nationality } : {}),
    ...(rawNationality ? { rawNationality } : {}),
    ...(countryCode ? { countryCode } : {}),
    aafkCareer,
  };
}

export function mapFotmobPosition(key?: string, label?: string): PlayingPosition | undefined {
  const value = `${key ?? ""} ${label ?? ""}`.toLowerCase();
  if (/goalkeeper|keeper/.test(value)) return "keeper";
  // «Defensive midfielder» må treffe midtbane før ordet «defensive» vurderes.
  if (/midfielder|midfield/.test(value)) return "midtbane";
  if (/defender|centreback|centerback|fullback|wingback|\bback\b/.test(value)) return "forsvar";
  if (/forward|striker|winger|attacker/.test(value)) return "angrep";
  return undefined;
}

function numberField<K extends "appearances" | "goals">(
  key: K,
  value: string | number | null | undefined,
): Partial<Record<K, number>> {
  if (value === null || value === undefined || value === "") return {};
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? { [key]: parsed } as Record<K, number> : {};
}

/** Alpha-3-kodene FotMob bruker, skrevet slik personregisteret allerede skriver landene. */
const NORWEGIAN_COUNTRIES: Record<string, string> = {
  BIH: "Bosnia-Hercegovina", BRA: "Brasil", BDI: "Burundi", CHL: "Chile",
  CRI: "Costa Rica", DNK: "Danmark", CIV: "Elfenbenskysten", ENG: "England",
  FIN: "Finland", GHA: "Ghana", GRL: "Grønland", ISL: "Island", CPV: "Kapp Verde",
  HRV: "Kroatia", NLD: "Nederland", NGA: "Nigeria", MKD: "Nord-Makedonia",
  NOR: "Norge", PRT: "Portugal", SEN: "Senegal", SRB: "Serbia", SWE: "Sverige",
  USA: "USA",
};
