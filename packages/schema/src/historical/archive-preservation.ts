import type { PreservationException } from "../preservation-exceptions.js";
import { isUnicodeRepair, type PreservationChangeDetail, type PreservationStatus } from "./preservation.js";

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
 * `year` for sesongblokker, `sourceId` for kildereferanser, `providerId` for
 * leverandørreferanser (`providers[]` på kamper, tabeller og personer).
 *
 * Uten `providerId` her blir en leverandørreferanse paret på eksakt form, og
 * enhver oppdatering av `retrievedAt` eller `fields` — nøyaktig det en ny
 * innhøsting alltid gjør — ser ut som at hele referansen er fjernet.
 */
const LIST_ITEM_KEYS = ["claimId", "id", "no", "year", "sourceId", "personId", "providerId", "date"] as const;

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
function listItemIdentities(item: unknown): Array<{ key: string; value: string }> {
  if (!isPlainObject(item)) return [];
  const list: Array<{ key: string; value: string }> = [];
  for (const key of LIST_ITEM_KEYS) {
    const raw = item[key];
    if (raw !== undefined && raw !== null && String(raw).trim() !== "") {
      list.push({ key, value: String(raw).trim() });
    }
  }
  return list;
}

function removeItemFromHeadQueues(headById: Map<string, unknown[]>, item: unknown) {
  if (!isPlainObject(item)) return;
  for (const identity of listItemIdentities(item)) {
    const key = `${identity.key}=${compositeIdentity(item, identity)}`;
    const queue = headById.get(key);
    if (queue) {
      const idx = queue.indexOf(item);
      if (idx >= 0) queue.splice(idx, 1);
    }
  }
}

function findHeadQueueForBaseItem(
  headById: Map<string, unknown[]>,
  baseItem: Record<string, unknown>,
): { key: string; queue: unknown[] } | undefined {
  for (const identity of listItemIdentities(baseItem)) {
    const key = `${identity.key}=${compositeIdentity(baseItem, identity)}`;
    const queue = headById.get(key);
    if (queue && queue.length > 0) {
      return { key, queue };
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
  if (identity.key === "personId" && (item.observedTitle !== undefined || item.body !== undefined)) {
    const parts = [identity.value];
    if (item.body !== undefined && item.body !== null) parts.push(String(item.body).trim());
    if (item.observedTitle !== undefined && item.observedTitle !== null) parts.push(String(item.observedTitle).trim());
    return parts.join(":");
  }
  return identity.value;
}

export interface StructuralDiffOptions {
  /** Maksimal dybde. Beskytter mot patologisk dype YAML-trær. */
  maxDepth?: number;
  /** Domenet posten hører til. Styrer hvilke feltspesifikke unntak som gjelder. */
  domain?: ArchiveDomain;
}

/**
 * `retrievedAt` på en leverandør- eller kildereferanse sier når vi sist så
 * etter, ikke hva vi fant. Den skal oppdateres hver gang kilden hentes på
 * nytt — det er hele poenget med feltet — og er derfor aldri i seg selv tap
 * av historisk informasjon, uansett hvilket arkivdomene den står i.
 */
function isProviderRetrievedAtRefresh(path: string): boolean {
  return path === "retrievedAt" || path.endsWith("/retrievedAt");
}

/**
 * Statusovergangene en kamp kan gjøre uten at noe går tapt: fra `scheduled`
 * til et hvilket som helst utfall kilden har konkludert med. Motsatt vei —
 * eller mellom to konkluderte statuser — er nettopp den typen stille
 * overskriving bevaringsvernet finnes for å fange, og skal fortsatt stanses.
 */
const MATCH_STATUS_OUTCOMES = new Set(["played", "abandoned", "awarded", "cancelled", "postponed"]);

function isMatchStatusOutcome(domain: ArchiveDomain | undefined, path: string, baseValue: unknown, headValue: unknown): boolean {
  if (domain !== "match" || path !== "/status") return false;
  return baseValue === "scheduled" && typeof headValue === "string" && MATCH_STATUS_OUTCOMES.has(headValue);
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
      if (isPlainObject(item)) {
        for (const identity of listItemIdentities(item)) {
          const key = `${identity.key}=${compositeIdentity(item, identity)}`;
          const queue = headById.get(key);
          if (queue) {
            queue.push(item);
          } else {
            headById.set(key, [item]);
          }
        }
      }
      const shape = stableKey(item);
      headByShape.set(shape, (headByShape.get(shape) ?? 0) + 1);
    }

    // Innenfor samme identitet pares først de elementene som er helt like i
    // BASE og HEAD. Uten dette ville en ren ombytting av to oppføringer med
    // samme identitet — hvor ingenting er tapt — blitt paret i rekkefølge og
    // meldt som to mutasjoner. Køen brukes bare på det som står igjen når de
    // uendrede er tatt ut.
    const pairedByShape = new Set<number>();
    for (const [index, baseItem] of baseValue.entries()) {
      if (!isPlainObject(baseItem)) continue;
      const hitInfo = findHeadQueueForBaseItem(headById, baseItem);
      if (!hitInfo) continue;
      const shape = stableKey(baseItem);
      const hit = hitInfo.queue.findIndex((candidate) => stableKey(candidate) === shape);
      if (hit >= 0) {
        const matchedItem = hitInfo.queue[hit];
        removeItemFromHeadQueues(headById, matchedItem);
        pairedByShape.add(index);
      }
    }

    for (let i = 0; i < baseValue.length; i++) {
      const baseItem = baseValue[i];

      // Elementet står uendret i HEAD. Ingenting kan være tapt.
      if (pairedByShape.has(i)) continue;

      if (isPlainObject(baseItem)) {
        const hitInfo = findHeadQueueForBaseItem(headById, baseItem);
        if (hitInfo) {
          const headItem = hitInfo.queue[0];
          removeItemFromHeadQueues(headById, headItem);
          out.push(
            ...diffStructuralAdditivity(
              baseItem,
              headItem,
              `${path}/${hitInfo.key}`,
              options,
              depth + 1,
            ),
          );
          continue;
        }

        const primaryIdentities = listItemIdentities(baseItem);
        if (primaryIdentities.length > 0) {
          const primary = primaryIdentities[0]!;
          out.push({
            path: `${path}/${compositeIdentity(baseItem, primary)}`,
            changeType: "remove",
            message: `Elementet «${primary.key}=${compositeIdentity(baseItem, primary)}» under «${path}» er fjernet`,
            baseValue: baseItem,
          });
          continue;
        }
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
    if (typeof baseValue === "string" && typeof headValue === "string" && isUnicodeRepair(baseValue, headValue)) {
      // Ren tegnkodingsretting av \uFFFD til gyldig UTF-8
      return out;
    }
    if (isProviderRetrievedAtRefresh(path)) {
      // En ny hentedato alene er ikke en endring \u2014 det er hele poenget med feltet.
      return out;
    }
    if (isMatchStatusOutcome(options.domain, path, baseValue, headValue)) {
      // En kamp som g\u00E5r fra planlagt til spilt (eller avlyst/utsatt/tapt p\u00E5
      // walkover) er kilden som konkluderer, ikke arkivet som mister noe.
      return out;
    }
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

export interface CoordinateMigrationItem {
  oldCoordinate: {
    sourceId: string;
    season: number;
    no: number;
    hypothesisId?: string;
  };
  newCoordinate: {
    sourceId: string;
    season: number;
    no: number;
    hypothesisId?: string;
  };
  claim?: {
    opponent?: string;
    score?: [number, number] | string;
    page?: number | string;
    note?: string;
    opponentClubId?: string;
    extraTime?: boolean;
    resultGroupId?: string;
  };
  hadMatchId?: string;
  action?: string;
  matchAction?: string;
}

export interface CoordinateMigrationManifest {
  contract: string;
  summary?: {
    totalMovedRows?: number;
    totalRenumberedRows?: number;
  };
  movedItems?: CoordinateMigrationItem[];
  renumberedItems?: CoordinateMigrationItem[];
}

export interface VerifiedMigration {
  manifest: CoordinateMigrationManifest;
  sourceId: string;
  normalizedBaseRaw: any;
  movedItems: CoordinateMigrationItem[];
  renumberedItems: CoordinateMigrationItem[];
  matchUnlinks: Map<string, CoordinateMigrationItem>;
}

export function verifySourceResultMigration(
  manifest: CoordinateMigrationManifest,
  baseRaw: unknown,
  headRaw: unknown,
): { valid: boolean; error?: string; verified?: VerifiedMigration } {
  if (!isPlainObject(baseRaw) || !isPlainObject(headRaw)) {
    return { valid: false, error: "BASE or HEAD source_result is not an object" };
  }

  const sourceId = ((headRaw as any).sourceId || (baseRaw as any).sourceId) as string;
  if (!sourceId) return { valid: false, error: "Missing sourceId" };

  const moved = manifest.movedItems || [];
  const renumbered = manifest.renumberedItems || [];
  const allItems = [...moved, ...renumbered];
  if (allItems.length === 0) return { valid: false, error: "No items in migration manifest" };

  // Check 1: Bijection - unique old coordinates
  const oldKeys = new Set<string>();
  for (const item of allItems) {
    const key = `${item.oldCoordinate.season}:${item.oldCoordinate.no}`;
    if (oldKeys.has(key)) {
      return { valid: false, error: `Duplicate oldCoordinate ${key} in migration manifest` };
    }
    oldKeys.add(key);
  }

  // Check 2: Bijection - unique new coordinates
  const newKeys = new Set<string>();
  for (const item of allItems) {
    const key = `${item.newCoordinate.season}:${item.newCoordinate.no}`;
    if (newKeys.has(key)) {
      return { valid: false, error: `Duplicate newCoordinate ${key} in migration manifest` };
    }
    newKeys.add(key);
  }

  // Check 3: Index all base claims
  const baseSeasons = ((baseRaw as any).seasons || []) as any[];
  const baseClaims = new Map<string, any>();
  for (const s of baseSeasons) {
    for (const r of s.results || []) {
      baseClaims.set(`${s.year}:${r.no}`, { season: s.year, ...r });
    }
  }

  // Check 4: Index all head claims
  const headSeasons = ((headRaw as any).seasons || []) as any[];
  const headClaims = new Map<string, any>();
  for (const s of headSeasons) {
    for (const r of s.results || []) {
      headClaims.set(`${s.year}:${r.no}`, { season: s.year, ...r });
    }
  }

  // Check 5: Total claim count invariant
  if (baseClaims.size !== headClaims.size) {
    return {
      valid: false,
      error: `Total claims count changed from ${baseClaims.size} in BASE to ${headClaims.size} in HEAD`,
    };
  }

  // Check 6: Validate each migrated claim against BASE and HEAD
  const matchUnlinks = new Map<string, CoordinateMigrationItem>();

  for (const item of allItems) {
    const oldKey = `${item.oldCoordinate.season}:${item.oldCoordinate.no}`;
    const newKey = `${item.newCoordinate.season}:${item.newCoordinate.no}`;

    const baseClaim = baseClaims.get(oldKey);
    if (!baseClaim) {
      return { valid: false, error: `Old claim ${oldKey} not found in BASE` };
    }

    const headClaim = headClaims.get(newKey);
    if (!headClaim) {
      return { valid: false, error: `New claim ${newKey} not found in HEAD` };
    }

    // Identity check if claimId is present in both
    if (baseClaim.claimId && headClaim.claimId && baseClaim.claimId !== headClaim.claimId) {
      return {
        valid: false,
        error: `claimId mismatch at ${oldKey} -> ${newKey}: BASE='${baseClaim.claimId}', HEAD='${headClaim.claimId}'`,
      };
    }

    // Historical facts comparison
    if (baseClaim.opponent !== headClaim.opponent) {
      return {
        valid: false,
        error: `Opponent mismatch at ${oldKey} -> ${newKey}: BASE='${baseClaim.opponent}', HEAD='${headClaim.opponent}'`,
      };
    }
    if (stableKey(baseClaim.score) !== stableKey(headClaim.score)) {
      return {
        valid: false,
        error: `Score mismatch at ${oldKey} -> ${newKey}: BASE=${stableKey(baseClaim.score)}, HEAD=${stableKey(headClaim.score)}`,
      };
    }
    if (String(baseClaim.page ?? "") !== String(headClaim.page ?? "")) {
      return {
        valid: false,
        error: `Page mismatch at ${oldKey} -> ${newKey}: BASE='${baseClaim.page}', HEAD='${headClaim.page}'`,
      };
    }
    if ((baseClaim.note || "") !== (headClaim.note || "")) {
      return {
        valid: false,
        error: `Note mismatch at ${oldKey} -> ${newKey}: BASE='${baseClaim.note}', HEAD='${headClaim.note}'`,
      };
    }
    if (baseClaim.opponentClubId && baseClaim.opponentClubId !== headClaim.opponentClubId) {
      return {
        valid: false,
        error: `opponentClubId mismatch at ${oldKey} -> ${newKey}`,
      };
    }
    if (baseClaim.extraTime !== undefined && baseClaim.extraTime !== headClaim.extraTime) {
      return {
        valid: false,
        error: `extraTime mismatch at ${oldKey} -> ${newKey}`,
      };
    }

    if (item.hadMatchId && item.matchAction === "KEEP_MATCH_REMOVE_SOURCE_LINK") {
      matchUnlinks.set(item.hadMatchId, item);
    }
  }

  // Construct normalized baseRaw where claims are at new coordinates
  const newBaseSeasonsMap = new Map<number, any[]>();

  for (const [key, claim] of baseClaims) {
    const migration = allItems.find(
      (m) => `${m.oldCoordinate.season}:${m.oldCoordinate.no}` === key,
    );
    const targetSeason = migration ? migration.newCoordinate.season : claim.season;
    const targetNo = migration ? migration.newCoordinate.no : claim.no;

    const normalizedClaim = { ...claim, no: targetNo };
    delete normalizedClaim.season;
    if (migration?.matchAction === "KEEP_MATCH_REMOVE_SOURCE_LINK") {
      delete normalizedClaim.matchId;
    }
    if (migration && migration.oldCoordinate.season !== migration.newCoordinate.season) {
      delete normalizedClaim.resultGroupId;
    }

    if (!newBaseSeasonsMap.has(targetSeason)) {
      newBaseSeasonsMap.set(targetSeason, []);
    }
    newBaseSeasonsMap.get(targetSeason)!.push(normalizedClaim);
  }

  const normalizedBaseSeasons = Array.from(newBaseSeasonsMap.entries())
    .sort(([y1], [y2]) => y1 - y2)
    .map(([year, results]) => ({
      year,
      results: results.sort((a, b) => a.no - b.no),
    }));

  const normalizedBaseRaw = {
    ...(baseRaw as any),
    seasons: normalizedBaseSeasons,
  };

  return {
    valid: true,
    verified: {
      manifest,
      sourceId,
      normalizedBaseRaw,
      movedItems: moved,
      renumberedItems: renumbered,
      matchUnlinks,
    },
  };
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
  approvedCoordinateMigrations: number;
}

/**
 * Kjører bevaringskontroll over alle arkivdomener utenom `data/people/`.
 */
export function runArchivePreservationAudit(
  inputs: ArchivePreservationInput[],
  exceptions: PreservationException[] = [],
  migrations: CoordinateMigrationManifest[] = [],
): ArchivePreservationResult {
  const changes: PreservationChangeDetail[] = [];
  const usedExceptions = new Set<PreservationException>();
  let entitiesChecked = 0;
  let filesDeleted = 0;
  let approvedCoordinateMigrations = 0;

  // Validate all migration manifests against source_result domain
  const verifiedMigrationsBySource = new Map<string, VerifiedMigration>();
  const matchUnlinks = new Map<string, { item: CoordinateMigrationItem; sourceId: string }>();

  const sourceResultInput = inputs.find((i) => i.domain === "source_result");
  if (sourceResultInput) {
    for (const manifest of migrations) {
      const sourceId =
        manifest.movedItems?.[0]?.oldCoordinate?.sourceId ||
        manifest.renumberedItems?.[0]?.oldCoordinate?.sourceId;
      if (!sourceId) continue;

      const baseRaw = sourceResultInput.base.get(sourceId);
      const headRaw = sourceResultInput.head.get(sourceId);
      if (baseRaw && headRaw) {
        const verifyRes = verifySourceResultMigration(manifest, baseRaw, headRaw);
        if (verifyRes.valid && verifyRes.verified) {
          verifiedMigrationsBySource.set(sourceId, verifyRes.verified);
          for (const [mId, item] of verifyRes.verified.matchUnlinks) {
            matchUnlinks.set(mId, { item, sourceId });
          }
        }
      }
    }
  }

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

      // Check if this entity is a source_result covered by verified migration
      if (input.domain === "source_result" && verifiedMigrationsBySource.has(id)) {
        const verified = verifiedMigrationsBySource.get(id)!;
        const removals = diffStructuralAdditivity(verified.normalizedBaseRaw, headRaw, "", {
          domain: input.domain,
        });

        // Add approved migration details
        for (const item of [...verified.movedItems, ...verified.renumberedItems]) {
          approvedCoordinateMigrations += 1;
          changes.push({
            entity: "source_result",
            id,
            path: `seasons/${item.newCoordinate.season}/results/${item.newCoordinate.no}`,
            changeType: "mutate",
            status: "APPROVED_COORDINATE_MIGRATION",
            message: `Kildepåstand ${item.oldCoordinate.season} #${item.oldCoordinate.no} («${item.claim?.opponent || ""} ${Array.isArray(item.claim?.score) ? item.claim?.score.join("-") : item.claim?.score || ""}») er flyttet til ${item.newCoordinate.season} #${item.newCoordinate.no} via godkjent koordinatmigrering`,
            baseValue: { season: item.oldCoordinate.season, no: item.oldCoordinate.no },
            headValue: { season: item.newCoordinate.season, no: item.newCoordinate.no },
          });
        }

        // Report any other removals
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
        continue;
      }

      const removals = diffStructuralAdditivity(baseRaw, headRaw, "", { domain: input.domain });
      for (const removal of removals) {
        const normalizedPath = removal.path.replace(/^\//, "") || "root";

        // Special handling for match source unlinking caused by verified coordinate migration
        if (
          input.domain === "match" &&
          (normalizedPath === "sources" || normalizedPath.startsWith("sources/")) &&
          matchUnlinks.has(id)
        ) {
          const unlinkInfo = matchUnlinks.get(id)!;
          const headMatch = headRaw as any;
          const hasIndependentEvidence =
            (Array.isArray(headMatch.providers) && headMatch.providers.length > 0) ||
            (Array.isArray(headMatch.externalReports) && headMatch.externalReports.length > 0);

          if (hasIndependentEvidence) {
            approvedCoordinateMigrations += 1;
            changes.push({
              entity: "match",
              id,
              path: normalizedPath,
              changeType: removal.changeType,
              status: "APPROVED_COORDINATE_MIGRATION",
              message: `match «${id}»: Kildereferanse til «${unlinkInfo.sourceId}» fjernet etter godkjent årsforskyvning. Kampens uavhengige bevisgrunnlag er bevart.`,
              baseValue: removal.baseValue,
              headValue: removal.headValue,
            });
            continue;
          }
        }

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
    approvedCoordinateMigrations,
  };
}
