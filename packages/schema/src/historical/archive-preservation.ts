import type { PreservationException } from "../preservation-exceptions.js";
import type { PreservationChangeDetail, PreservationStatus } from "./preservation.js";

/**
 * Arkivdomener som er omfattet av det generelle bevaringsvernet.
 *
 * `data/people/` har sin egen semantiske motor i `preservation.ts` og er
 * bevisst ikke med her — den kjenner rollestruktur, coach spells og
 * konfliktblokker, og gir langt bedre meldinger enn en generisk strukturdiff.
 */
export type ArchiveDomain =
  | "source"
  | "source_result"
  | "match"
  | "observation"
  | "organization_snapshot";

export interface ArchiveDomainSpec {
  domain: ArchiveDomain;
  /** Katalog relativt til repo-roten. */
  dir: string;
  /** Filter for hvilke filer i katalogen som hører til domenet. */
  filterFile?: (file: string) => boolean;
}

/**
 * Katalogene som må være strengt additive. Rekkefølgen styrer rapportrekkefølgen.
 */
export const ARCHIVE_DOMAIN_SPECS: ArchiveDomainSpec[] = [
  { domain: "source", dir: "data/sources" },
  { domain: "source_result", dir: "data/source-results" },
  {
    domain: "match",
    dir: "data/seasons",
    filterFile: (file) => file.includes("/matches/"),
  },
  {
    domain: "observation",
    dir: "data/observations",
    filterFile: (file) => !file.replace(/^data\/observations\//, "").includes("/"),
  },
  { domain: "organization_snapshot", dir: "data/organization/snapshots" },
];

/**
 * Nøkler som brukes til å pare opp elementer i lister av objekter, i prioritert
 * rekkefølge. Arkivet bruker ulike identifikatorer per entitetstype: `id` for
 * kamper og observasjoner, `no` for enkeltresultater i en source-result-sesong,
 * `year` for sesongblokker, `sourceId` for kildereferanser.
 */
const LIST_ITEM_KEYS = ["id", "no", "year", "sourceId", "personId", "date"] as const;

/**
 * Sjekker om en verdi teller som «tom» — altså om overgangen fra den til en
 * konkret verdi er berikelse og ikke tap.
 */
function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Stabil serialisering brukt til dyp likhet og til å pare opp listeelementer
 * som ikke har en egen identifikator.
 */
function stableKey(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (Array.isArray(value)) return `[${value.map(stableKey).join(",")}]`;
  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${k}:${stableKey(value[k])}`).join(",")}}`;
  }
  return `${typeof value}:${String(value)}`;
}

/**
 * Finner identifikatoren for et listeelement, dersom det har en.
 */
function listItemIdentity(item: unknown): { key: string; value: string } | undefined {
  if (!isPlainObject(item)) return undefined;
  for (const key of LIST_ITEM_KEYS) {
    const raw = item[key];
    if (raw !== undefined && raw !== null && String(raw).trim() !== "") {
      return { key, value: String(raw).trim() };
    }
  }
  return undefined;
}

/**
 * Kildereferanser identifiseres av sourceId **og** side. To referanser til
 * samme kilde på ulike sider er to forskjellige belegg, og begge må bevares.
 */
function compositeIdentity(item: Record<string, unknown>, identity: { key: string; value: string }): string {
  if (identity.key === "sourceId" && item.page !== undefined && item.page !== null) {
    return `${identity.value}:${String(item.page).trim()}`;
  }
  return identity.value;
}

export interface StructuralDiffOptions {
  /** Maksimal dybde. Beskytter mot patologisk dype YAML-trær. */
  maxDepth?: number;
}

interface StructuralRemoval {
  path: string;
  changeType: "remove" | "mutate";
  message: string;
  baseValue?: unknown;
  headValue?: unknown;
}

/**
 * Sammenligner BASE mot HEAD og rapporterer alt som er tapt.
 *
 * Kravet er at BASE strukturelt er en delmengde av HEAD: hver nøkkel, hvert
 * listeelement og hver ikke-tom skalarverdi som fantes i BASE må fortsatt
 * finnes i HEAD med samme verdi. Alt HEAD har i tillegg er fri berikelse.
 */
export function diffStructuralAdditivity(
  baseValue: unknown,
  headValue: unknown,
  path: string,
  options: StructuralDiffOptions = {},
  depth = 0,
): StructuralRemoval[] {
  const maxDepth = options.maxDepth ?? 24;
  const out: StructuralRemoval[] = [];

  if (depth > maxDepth) return out;

  // Tomt i BASE kan ikke gå tapt.
  if (isEmptyValue(baseValue)) return out;

  if (isEmptyValue(headValue)) {
    out.push({
      path,
      changeType: "remove",
      message: `«${path}» fantes i BASE, men er fjernet eller tømt i HEAD`,
      baseValue,
      headValue,
    });
    return out;
  }

  if (Array.isArray(baseValue)) {
    if (!Array.isArray(headValue)) {
      out.push({
        path,
        changeType: "mutate",
        message: `«${path}» var en liste i BASE, men er ikke lenger en liste i HEAD`,
        baseValue,
        headValue,
      });
      return out;
    }

    // Indekser HEAD-elementene på identitet og på dyp likhet.
    //
    // Samme identitet kan forekomme flere ganger i én liste: et
    // organisasjonssnapshot fører den som er kasserer i hovedstyret og
    // forretningsfører i medlemsbladet som to oppføringer med samme personId.
    // Derfor er indeksen en kø per identitet — med én verdi per nøkkel ville
    // den siste oppføringen vunnet, og den første basisoppføringen ville blitt
    // sammenlignet med feil oppføring og meldt som en destruktiv mutasjon selv
    // når filen er uendret.
    const headById = new Map<string, unknown[]>();
    const headByShape = new Map<string, number>();
    for (const item of headValue) {
      const identity = listItemIdentity(item);
      if (identity && isPlainObject(item)) {
        const key = `${identity.key}=${compositeIdentity(item, identity)}`;
        const queue = headById.get(key);
        if (queue) {
          queue.push(item);
        } else {
          headById.set(key, [item]);
        }
      }
      const shape = stableKey(item);
      headByShape.set(shape, (headByShape.get(shape) ?? 0) + 1);
    }

    for (let i = 0; i < baseValue.length; i++) {
      const baseItem = baseValue[i];
      const identity = listItemIdentity(baseItem);

      if (identity && isPlainObject(baseItem)) {
        const lookup = `${identity.key}=${compositeIdentity(baseItem, identity)}`;
        // Basisoppføringene pares mot HEAD-oppføringene i rekkefølge, slik at
        // n-te forekomst av en identitet møter n-te forekomst i HEAD.
        const headItem = headById.get(lookup)?.shift();
        if (headItem === undefined) {
          out.push({
            path: `${path}/${compositeIdentity(baseItem, identity)}`,
            changeType: "remove",
            message: `Elementet «${identity.key}=${compositeIdentity(baseItem, identity)}» under «${path}» er fjernet`,
            baseValue: baseItem,
          });
          continue;
        }
        out.push(
          ...diffStructuralAdditivity(
            baseItem,
            headItem,
            `${path}/${compositeIdentity(baseItem, identity)}`,
            options,
            depth + 1,
          ),
        );
        continue;
      }

      // Uten identitet krever vi at den eksakte verdien fortsatt finnes.
      const shape = stableKey(baseItem);
      const remaining = headByShape.get(shape) ?? 0;
      if (remaining > 0) {
        headByShape.set(shape, remaining - 1);
        continue;
      }
      out.push({
        path: `${path}[${i}]`,
        changeType: "remove",
        message: `Verdien på «${path}[${i}]» finnes ikke lenger i HEAD`,
        baseValue: baseItem,
      });
    }

    return out;
  }

  if (isPlainObject(baseValue)) {
    if (!isPlainObject(headValue)) {
      out.push({
        path,
        changeType: "mutate",
        message: `«${path}» var et objekt i BASE, men er noe annet i HEAD`,
        baseValue,
        headValue,
      });
      return out;
    }
    for (const key of Object.keys(baseValue)) {
      out.push(
        ...diffStructuralAdditivity(baseValue[key], headValue[key], `${path}/${key}`, options, depth + 1),
      );
    }
    return out;
  }

  // Skalar: enhver endring av en ikke-tom verdi er tap av informasjon.
  if (stableKey(baseValue) !== stableKey(headValue)) {
    out.push({
      path,
      changeType: "mutate",
      message: `«${path}» er endret fra «${String(baseValue)}» til «${String(headValue)}»`,
      baseValue,
      headValue,
    });
  }

  return out;
}

/**
 * Finner et godkjent unntak som dekker en endring i et arkivdomene.
 */
function findArchiveException(
  domain: ArchiveDomain,
  id: string,
  path: string,
  changeType: "remove" | "mutate" | "delete_file",
  exceptions: PreservationException[],
  usedExceptions: Set<PreservationException>,
): PreservationException | undefined {
  for (const ex of exceptions) {
    if (ex.entity !== domain) continue;
    if (ex.id !== id) continue;
    if (ex.change !== changeType) continue;
    const normActual = path.replace(/\[/g, "/").replace(/\]/g, "").replace(/\./g, "/");
    const normException = ex.path.replace(/\[/g, "/").replace(/\]/g, "").replace(/\./g, "/");
    if (normActual === normException) {
      usedExceptions.add(ex);
      return ex;
    }
  }
  return undefined;
}

export interface ArchivePreservationInput {
  domain: ArchiveDomain;
  /** Rådata fra BASE, nøklet på entitets-ID. */
  base: Map<string, unknown>;
  /** Rådata fra HEAD, nøklet på entitets-ID. */
  head: Map<string, unknown>;
}

export interface ArchivePreservationResult {
  changes: PreservationChangeDetail[];
  usedExceptions: Set<PreservationException>;
  entitiesChecked: number;
  filesDeleted: number;
  destructiveChanges: number;
  approvedExceptions: number;
}

/**
 * Kjører bevaringskontroll over alle arkivdomener utenom `data/people/`.
 *
 * Kontrollen er bevisst generisk: den kjenner ikke feltene i den enkelte
 * entiteten, men håndhever at BASE er en strukturell delmengde av HEAD. Det
 * gjør at nye felter i datamodellen automatisk får bevaringsvern uten at denne
 * filen må oppdateres.
 */
export function runArchivePreservationAudit(
  inputs: ArchivePreservationInput[],
  exceptions: PreservationException[] = [],
): ArchivePreservationResult {
  const changes: PreservationChangeDetail[] = [];
  const usedExceptions = new Set<PreservationException>();
  let entitiesChecked = 0;
  let filesDeleted = 0;

  for (const input of inputs) {
    for (const [id, baseRaw] of input.base) {
      entitiesChecked += 1;
      const headRaw = input.head.get(id);

      if (headRaw === undefined) {
        filesDeleted += 1;
        const ex = findArchiveException(input.domain, id, "file", "delete_file", exceptions, usedExceptions);
        changes.push({
          entity: input.domain,
          id,
          path: "file",
          changeType: "delete_file",
          status: ex ? "APPROVED_EXCEPTION" : "DESTRUCTIVE_CHANGE",
          message: `${input.domain} «${id}» er slettet fra arkivet`,
          baseValue: baseRaw,
          exception: ex,
        });
        continue;
      }

      const removals = diffStructuralAdditivity(baseRaw, headRaw, "");
      for (const removal of removals) {
        const normalizedPath = removal.path.replace(/^\//, "") || "root";
        const ex = findArchiveException(
          input.domain,
          id,
          normalizedPath,
          removal.changeType,
          exceptions,
          usedExceptions,
        );
        changes.push({
          entity: input.domain,
          id,
          path: normalizedPath,
          changeType: removal.changeType,
          status: ex ? "APPROVED_EXCEPTION" : "DESTRUCTIVE_CHANGE",
          message: `${input.domain} «${id}»: ${removal.message}`,
          baseValue: removal.baseValue,
          headValue: removal.headValue,
          exception: ex,
        });
      }
    }
  }

  let destructiveChanges = 0;
  let approvedExceptions = 0;
  for (const change of changes) {
    const status: PreservationStatus = change.status;
    if (status === "DESTRUCTIVE_CHANGE") destructiveChanges += 1;
    else if (status === "APPROVED_EXCEPTION") approvedExceptions += 1;
  }

  return {
    changes,
    usedExceptions,
    entitiesChecked,
    filesDeleted,
    destructiveChanges,
    approvedExceptions,
  };
}
