import type { Person, PersonRole, DeclaredCoachSpell, SquadNumber } from "../person.js";
import type { Conflict, ProviderRef, SourceRef } from "../primitives.js";
import type { PreservationException } from "../preservation-exceptions.js";

export type PreservationStatus =
  | "UNCHANGED"
  | "ADDITION"
  | "SAFE_ENRICHMENT"
  | "REVIEW_REQUIRED"
  | "DESTRUCTIVE_CHANGE"
  | "APPROVED_EXCEPTION";

export interface PreservationChangeDetail {
  entity: "person";
  id: string;
  path: string;
  changeType: "remove" | "mutate" | "delete_file" | "add" | "enrich";
  status: PreservationStatus;
  message: string;
  baseValue?: unknown;
  headValue?: unknown;
  exception?: PreservationException;
}

export interface PreservationAuditSummary {
  peopleChecked: number;
  existingPeopleChanged: number;
  newPeopleAdded: number;
  peopleDeleted: number;
  additions: number;
  safeEnrichments: number;
  reviewRequired: number;
  approvedExceptions: number;
  destructiveChanges: number;
  staleExceptions: PreservationException[];
}

export interface PreservationAuditResult {
  baseRef: string;
  headRef: string;
  passed: boolean;
  summary: PreservationAuditSummary;
  changes: PreservationChangeDetail[];
}

/**
 * Normaliserer en kilde-identifikator (sourceId + sidetall).
 */
export function sourceRefKey(ref: { sourceId: string; page?: string | number | null }): string {
  const page = ref.page !== undefined && ref.page !== null && String(ref.page).trim() !== "" ? String(ref.page).trim() : "";
  return page ? `${ref.sourceId}:${page}` : ref.sourceId;
}

/**
 * Sjekker om en path matcher et unntak fleksibelt (f.eks. roles/foo vs roles[foo]).
 */
function matchesPath(actualPath: string, exceptionPath: string): boolean {
  if (actualPath === exceptionPath) return true;
  const normActual = actualPath.replace(/\[/g, "/").replace(/\]/g, "").replace(/\./g, "/");
  const normException = exceptionPath.replace(/\[/g, "/").replace(/\]/g, "").replace(/\./g, "/");
  return normActual === normException;
}

/**
 * Finner et godkjent unntak som matcher endringen.
 */
function findMatchingException(
  entity: "person",
  id: string,
  path: string,
  changeType: "remove" | "mutate" | "delete_file",
  exceptions: PreservationException[],
  usedExceptions: Set<PreservationException>,
): PreservationException | undefined {
  for (const ex of exceptions) {
    if (ex.entity !== entity) continue;
    if (ex.id !== id) continue;
    if (ex.change !== changeType && !(changeType === "remove" && ex.change === "delete_file" && path === "file")) {
      continue;
    }
    if (matchesPath(path, ex.path)) {
      usedExceptions.add(ex);
      return ex;
    }
  }
  return undefined;
}

/**
 * Sammenligner to roller semantisk.
 */
function compareRole(
  personId: string,
  baseRole: PersonRole,
  headRole: PersonRole,
  exceptions: PreservationException[],
  usedExceptions: Set<PreservationException>,
): PreservationChangeDetail[] {
  const changes: PreservationChangeDetail[] = [];
  const rolePath = `roles/${baseRole.id}`;

  // Sjekk kategori
  if (baseRole.category !== headRole.category) {
    const ex = findMatchingException("person", personId, `${rolePath}/category`, "mutate", exceptions, usedExceptions);
    changes.push({
      entity: "person",
      id: personId,
      path: `${rolePath}/category`,
      changeType: "mutate",
      status: ex ? "APPROVED_EXCEPTION" : "DESTRUCTIVE_CHANGE",
      message: `Rollen «${baseRole.id}» har endret kategori fra «${baseRole.category}» til «${headRole.category}»`,
      baseValue: baseRole.category,
      headValue: headRole.category,
      exception: ex,
    });
  }

  // Sjekk tittel
  if (baseRole.title !== headRole.title) {
    const ex = findMatchingException("person", personId, `${rolePath}/title`, "mutate", exceptions, usedExceptions);
    changes.push({
      entity: "person",
      id: personId,
      path: `${rolePath}/title`,
      changeType: "mutate",
      status: ex ? "APPROVED_EXCEPTION" : "DESTRUCTIVE_CHANGE",
      message: `Rollen «${baseRole.id}» har endret tittel fra «${baseRole.title}» til «${headRole.title}»`,
      baseValue: baseRole.title,
      headValue: headRole.title,
      exception: ex,
    });
  }

  // Sjekk from
  if (baseRole.from !== headRole.from) {
    const ex = findMatchingException("person", personId, `${rolePath}/from`, "mutate", exceptions, usedExceptions);
    changes.push({
      entity: "person",
      id: personId,
      path: `${rolePath}/from`,
      changeType: "mutate",
      status: ex ? "APPROVED_EXCEPTION" : "DESTRUCTIVE_CHANGE",
      message: `Rollen «${baseRole.id}» har endret startår/-dato fra «${baseRole.from}» til «${headRole.from}»`,
      baseValue: baseRole.from,
      headValue: headRole.from,
      exception: ex,
    });
  }

  // Sjekk to (null -> "1960" er SAFE_ENRICHMENT)
  if (baseRole.to !== headRole.to) {
    if (baseRole.to === null && headRole.to !== null) {
      changes.push({
        entity: "person",
        id: personId,
        path: `${rolePath}/to`,
        changeType: "enrich",
        status: "SAFE_ENRICHMENT",
        message: `Rollen «${baseRole.id}» har fått dokumentert sluttår «${headRole.to}»`,
        baseValue: baseRole.to,
        headValue: headRole.to,
      });
    } else if (baseRole.to !== null && headRole.to === null) {
      const ex = findMatchingException("person", personId, `${rolePath}/to`, "remove", exceptions, usedExceptions);
      changes.push({
        entity: "person",
        id: personId,
        path: `${rolePath}/to`,
        changeType: "remove",
        status: ex ? "APPROVED_EXCEPTION" : "DESTRUCTIVE_CHANGE",
        message: `Rollen «${baseRole.id}» har mistet sluttår «${baseRole.to}»`,
        baseValue: baseRole.to,
        headValue: headRole.to,
        exception: ex,
      });
    } else {
      const ex = findMatchingException("person", personId, `${rolePath}/to`, "mutate", exceptions, usedExceptions);
      changes.push({
        entity: "person",
        id: personId,
        path: `${rolePath}/to`,
        changeType: "mutate",
        status: ex ? "APPROVED_EXCEPTION" : "REVIEW_REQUIRED",
        message: `Rollen «${baseRole.id}» har endret sluttår fra «${baseRole.to}» til «${headRole.to}»`,
        baseValue: baseRole.to,
        headValue: headRole.to,
        exception: ex,
      });
    }
  }

  // Sjekk organizationId / body / note
  const scalarFields: Array<"organizationId" | "body" | "note"> = ["organizationId", "body", "note"];
  for (const field of scalarFields) {
    const baseVal = baseRole[field];
    const headVal = headRole[field];
    if (baseVal && !headVal) {
      const ex = findMatchingException("person", personId, `${rolePath}/${field}`, "remove", exceptions, usedExceptions);
      changes.push({
        entity: "person",
        id: personId,
        path: `${rolePath}/${field}`,
        changeType: "remove",
        status: ex ? "APPROVED_EXCEPTION" : "DESTRUCTIVE_CHANGE",
        message: `Rollen «${baseRole.id}» har mistet feltet «${field}» («${baseVal}»)`,
        baseValue: baseVal,
        headValue: headVal,
        exception: ex,
      });
    } else if (!baseVal && headVal) {
      changes.push({
        entity: "person",
        id: personId,
        path: `${rolePath}/${field}`,
        changeType: "enrich",
        status: "SAFE_ENRICHMENT",
        message: `Rollen «${baseRole.id}» har fått feltet «${field}» («${headVal}»)`,
        baseValue: baseVal,
        headValue: headVal,
      });
    } else if (baseVal && headVal && baseVal !== headVal) {
      const ex = findMatchingException("person", personId, `${rolePath}/${field}`, "mutate", exceptions, usedExceptions);
      changes.push({
        entity: "person",
        id: personId,
        path: `${rolePath}/${field}`,
        changeType: "mutate",
        status: ex ? "APPROVED_EXCEPTION" : "REVIEW_REQUIRED",
        message: `Rollen «${baseRole.id}» har endret feltet «${field}» fra «${baseVal}» til «${headVal}»`,
        baseValue: baseVal,
        headValue: headVal,
        exception: ex,
      });
    }
  }

  // Sjekk sources på rollen
  const baseSources = new Map<string, SourceRef>();
  for (const src of baseRole.sources) baseSources.set(sourceRefKey(src), src);
  const headSources = new Map<string, SourceRef>();
  for (const src of headRole.sources) headSources.set(sourceRefKey(src), src);

  for (const [key, baseSrc] of baseSources) {
    const headSrc = headSources.get(key);
    const srcPath = `${rolePath}/sources[${key}]`;
    if (!headSrc) {
      const ex = findMatchingException("person", personId, srcPath, "remove", exceptions, usedExceptions);
      changes.push({
        entity: "person",
        id: personId,
        path: srcPath,
        changeType: "remove",
        status: ex ? "APPROVED_EXCEPTION" : "DESTRUCTIVE_CHANGE",
        message: `Kildereferanse «${key}» på rollen «${baseRole.id}» har forsvunnet`,
        baseValue: baseSrc,
        headValue: undefined,
        exception: ex,
      });
    } else {
      // Sjekk fields på kildereferansen
      const baseFields = new Set(baseSrc.fields);
      const headFields = new Set(headSrc.fields);
      const missingFields = [...baseFields].filter((f) => !headFields.has(f));
      if (missingFields.length > 0) {
        const ex = findMatchingException("person", personId, `${srcPath}/fields`, "remove", exceptions, usedExceptions);
        changes.push({
          entity: "person",
          id: personId,
          path: `${srcPath}/fields`,
          changeType: "remove",
          status: ex ? "APPROVED_EXCEPTION" : "DESTRUCTIVE_CHANGE",
          message: `Kildedekning for felt (${missingFields.join(", ")}) på «${key}» på rollen «${baseRole.id}» har krympet`,
          baseValue: baseSrc.fields,
          headValue: headSrc.fields,
          exception: ex,
        });
      }
    }
  }

  for (const [key, headSrc] of headSources) {
    if (!baseSources.has(key)) {
      changes.push({
        entity: "person",
        id: personId,
        path: `${rolePath}/sources[${key}]`,
        changeType: "enrich",
        status: "SAFE_ENRICHMENT",
        message: `Rollen «${baseRole.id}» har fått ny kildereferanse «${key}»`,
        baseValue: undefined,
        headValue: headSrc,
      });
    }
  }

  return changes;
}

/**
 * Sammenligner to personer semantisk.
 */
export function comparePerson(
  basePerson: Person,
  headPerson: Person,
  exceptions: PreservationException[],
  usedExceptions: Set<PreservationException>,
): PreservationChangeDetail[] {
  const changes: PreservationChangeDetail[] = [];
  const personId = basePerson.id;

  // 1. Roles
  const baseRoles = new Map<string, PersonRole>();
  for (const r of basePerson.roles) baseRoles.set(r.id, r);
  const headRoles = new Map<string, PersonRole>();
  for (const r of headPerson.roles) headRoles.set(r.id, r);

  for (const [roleId, baseRole] of baseRoles) {
    const headRole = headRoles.get(roleId);
    if (!headRole) {
      const ex = findMatchingException("person", personId, `roles/${roleId}`, "remove", exceptions, usedExceptions);
      changes.push({
        entity: "person",
        id: personId,
        path: `roles/${roleId}`,
        changeType: "remove",
        status: ex ? "APPROVED_EXCEPTION" : "DESTRUCTIVE_CHANGE",
        message: `Rollen «${roleId}» («${baseRole.title}», ${baseRole.from}) har forsvunnet`,
        baseValue: baseRole,
        headValue: undefined,
        exception: ex,
      });
    } else {
      changes.push(...compareRole(personId, baseRole, headRole, exceptions, usedExceptions));
    }
  }

  for (const [roleId, headRole] of headRoles) {
    if (!baseRoles.has(roleId)) {
      changes.push({
        entity: "person",
        id: personId,
        path: `roles/${roleId}`,
        changeType: "add",
        status: "ADDITION",
        message: `Ny rolle «${roleId}» («${headRole.title}», ${headRole.from}) lagt til`,
        baseValue: undefined,
        headValue: headRole,
      });
    }
  }

  // 2. Top-level sources
  const baseSources = new Map<string, SourceRef>();
  for (const src of basePerson.sources) baseSources.set(sourceRefKey(src), src);
  const headSources = new Map<string, SourceRef>();
  for (const src of headPerson.sources) headSources.set(sourceRefKey(src), src);

  for (const [key, baseSrc] of baseSources) {
    const headSrc = headSources.get(key);
    const srcPath = `sources[${key}]`;
    if (!headSrc) {
      const ex = findMatchingException("person", personId, srcPath, "remove", exceptions, usedExceptions);
      changes.push({
        entity: "person",
        id: personId,
        path: srcPath,
        changeType: "remove",
        status: ex ? "APPROVED_EXCEPTION" : "DESTRUCTIVE_CHANGE",
        message: `Kildereferanse «${key}» på person har forsvunnet`,
        baseValue: baseSrc,
        headValue: undefined,
        exception: ex,
      });
    } else {
      const baseFields = new Set(baseSrc.fields);
      const headFields = new Set(headSrc.fields);
      const missingFields = [...baseFields].filter((f) => !headFields.has(f));
      if (missingFields.length > 0) {
        const ex = findMatchingException("person", personId, `${srcPath}/fields`, "remove", exceptions, usedExceptions);
        changes.push({
          entity: "person",
          id: personId,
          path: `${srcPath}/fields`,
          changeType: "remove",
          status: ex ? "APPROVED_EXCEPTION" : "DESTRUCTIVE_CHANGE",
          message: `Kildedekning for felt (${missingFields.join(", ")}) på kildereferanse «${key}» har krympet`,
          baseValue: baseSrc.fields,
          headValue: headSrc.fields,
          exception: ex,
        });
      }
    }
  }

  for (const [key, headSrc] of headSources) {
    if (!baseSources.has(key)) {
      changes.push({
        entity: "person",
        id: personId,
        path: `sources[${key}]`,
        changeType: "add",
        status: "SAFE_ENRICHMENT",
        message: `Ny kildereferanse «${key}» lagt til på person`,
        baseValue: undefined,
        headValue: headSrc,
      });
    }
  }

  // 3. Conflicts
  const baseConflicts = new Map<string, Conflict>();
  for (const c of basePerson.conflicts) baseConflicts.set(c.field, c);
  const headConflicts = new Map<string, Conflict>();
  for (const c of headPerson.conflicts) headConflicts.set(c.field, c);

  for (const [field, baseConf] of baseConflicts) {
    const headConf = headConflicts.get(field);
    const confPath = `conflicts/${field}`;
    if (!headConf) {
      const ex = findMatchingException("person", personId, confPath, "remove", exceptions, usedExceptions);
      changes.push({
        entity: "person",
        id: personId,
        path: confPath,
        changeType: "remove",
        status: ex ? "APPROVED_EXCEPTION" : "DESTRUCTIVE_CHANGE",
        message: `Konflikt for «${field}» har forsvunnet`,
        baseValue: baseConf,
        headValue: undefined,
        exception: ex,
      });
    } else {
      // Sjekk at ingen values har forsvunnet (BASE.values ⊆ HEAD.values)
      const headValueKeys = new Set(headConf.values.map((v) => `${v.providerId}|${v.value}`));
      const missingValues = baseConf.values.filter((v) => !headValueKeys.has(`${v.providerId}|${v.value}`));
      if (missingValues.length > 0) {
        const ex = findMatchingException("person", personId, `${confPath}/values`, "remove", exceptions, usedExceptions);
        changes.push({
          entity: "person",
          id: personId,
          path: `${confPath}/values`,
          changeType: "remove",
          status: ex ? "APPROVED_EXCEPTION" : "DESTRUCTIVE_CHANGE",
          message: `Konfliktverdi(er) for «${field}» har forsvunnet (${missingValues.map((v) => `${v.providerId}: ${v.value}`).join(", ")})`,
          baseValue: baseConf.values,
          headValue: headConf.values,
          exception: ex,
        });
      }

      // Sjekk overgang fra unresolved til resolved
      if (!baseConf.resolved && headConf.resolved) {
        changes.push({
          entity: "person",
          id: personId,
          path: `${confPath}/resolved`,
          changeType: "enrich",
          status: "SAFE_ENRICHMENT",
          message: `Konflikt for «${field}» er løst (valgt: «${headConf.chosen}», kilde: ${headConf.chosenProviderId})`,
          baseValue: baseConf,
          headValue: headConf,
        });
      } else if (baseConf.resolved && !headConf.resolved) {
        const ex = findMatchingException("person", personId, `${confPath}/resolved`, "mutate", exceptions, usedExceptions);
        changes.push({
          entity: "person",
          id: personId,
          path: `${confPath}/resolved`,
          changeType: "mutate",
          status: ex ? "APPROVED_EXCEPTION" : "DESTRUCTIVE_CHANGE",
          message: `Løst konflikt for «${field}» har utilsiktet gått tilbake til uløst tilstand`,
          baseValue: baseConf,
          headValue: headConf,
          exception: ex,
        });
      } else if (baseConf.resolved && headConf.resolved && baseConf.chosen !== headConf.chosen) {
        const ex = findMatchingException("person", personId, `${confPath}/chosen`, "mutate", exceptions, usedExceptions);
        changes.push({
          entity: "person",
          id: personId,
          path: `${confPath}/chosen`,
          changeType: "mutate",
          status: ex ? "APPROVED_EXCEPTION" : "REVIEW_REQUIRED",
          message: `Valgt verdi for løst konflikt «${field}» er endret fra «${baseConf.chosen}» til «${headConf.chosen}»`,
          baseValue: baseConf.chosen,
          headValue: headConf.chosen,
          exception: ex,
        });
      }
    }
  }

  for (const [field, headConf] of headConflicts) {
    if (!baseConflicts.has(field)) {
      changes.push({
        entity: "person",
        id: personId,
        path: `conflicts/${field}`,
        changeType: "add",
        status: "ADDITION",
        message: `Ny konflikt registrert for «${field}» (${headConf.values.length} verdier)`,
        baseValue: undefined,
        headValue: headConf,
      });
    }
  }

  // 4. Names
  const baseNames = new Set(basePerson.names.map((n) => n.trim().toLowerCase()));
  const headNames = new Set(headPerson.names.map((n) => n.trim().toLowerCase()));

  for (const rawName of basePerson.names) {
    const norm = rawName.trim().toLowerCase();
    if (!headNames.has(norm)) {
      const ex = findMatchingException("person", personId, `names/${rawName}`, "remove", exceptions, usedExceptions);
      changes.push({
        entity: "person",
        id: personId,
        path: `names/${rawName}`,
        changeType: "remove",
        status: ex ? "APPROVED_EXCEPTION" : "DESTRUCTIVE_CHANGE",
        message: `Navnevariant «${rawName}» har forsvunnet`,
        baseValue: rawName,
        headValue: undefined,
        exception: ex,
      });
    }
  }

  for (const rawName of headPerson.names) {
    const norm = rawName.trim().toLowerCase();
    if (!baseNames.has(norm)) {
      changes.push({
        entity: "person",
        id: personId,
        path: `names/${rawName}`,
        changeType: "enrich",
        status: "SAFE_ENRICHMENT",
        message: `Ny navnevariant «${rawName}» lagt til`,
        baseValue: undefined,
        headValue: rawName,
      });
    }
  }

  // 5. Coach spells
  const spellKey = (s: DeclaredCoachSpell) => `${s.fromSeason}`;
  const baseSpells = new Map(basePerson.coachSpells.map((s) => [spellKey(s), s]));
  const headSpells = new Map(headPerson.coachSpells.map((s) => [spellKey(s), s]));

  for (const [key, baseSpell] of baseSpells) {
    const headSpell = headSpells.get(key);
    const spellPath = `coachSpells/${key}`;
    if (!headSpell) {
      const ex = findMatchingException("person", personId, spellPath, "remove", exceptions, usedExceptions);
      changes.push({
        entity: "person",
        id: personId,
        path: spellPath,
        changeType: "remove",
        status: ex ? "APPROVED_EXCEPTION" : "DESTRUCTIVE_CHANGE",
        message: `Trenerperiode fra ${baseSpell.fromSeason} har forsvunnet`,
        baseValue: baseSpell,
        headValue: undefined,
        exception: ex,
      });
    } else {
      if (baseSpell.toSeason === null && headSpell.toSeason !== null) {
        changes.push({
          entity: "person",
          id: personId,
          path: `${spellPath}/toSeason`,
          changeType: "enrich",
          status: "SAFE_ENRICHMENT",
          message: `Trenerperiode fra ${baseSpell.fromSeason} har fått dokumentert sluttsesong ${headSpell.toSeason}`,
          baseValue: baseSpell.toSeason,
          headValue: headSpell.toSeason,
        });
      }
    }
  }

  for (const [key, headSpell] of headSpells) {
    if (!baseSpells.has(key)) {
      changes.push({
        entity: "person",
        id: personId,
        path: `coachSpells/${key}`,
        changeType: "add",
        status: "ADDITION",
        message: `Ny trenerperiode lagt til (${headSpell.fromSeason}–${headSpell.toSeason ?? ""})`,
        baseValue: undefined,
        headValue: headSpell,
      });
    }
  }

  // 6. Squad numbers
  const squadKey = (s: SquadNumber) => `${s.season}`;
  const baseSquad = new Map(basePerson.squadNumbers.map((s) => [squadKey(s), s]));
  const headSquad = new Map(headPerson.squadNumbers.map((s) => [squadKey(s), s]));

  for (const [key, baseNum] of baseSquad) {
    const headNum = headSquad.get(key);
    const squadPath = `squadNumbers/${key}`;
    if (!headNum) {
      const ex = findMatchingException("person", personId, squadPath, "remove", exceptions, usedExceptions);
      changes.push({
        entity: "person",
        id: personId,
        path: squadPath,
        changeType: "remove",
        status: ex ? "APPROVED_EXCEPTION" : "DESTRUCTIVE_CHANGE",
        message: `Draktnummer for sesong ${baseNum.season} (#${baseNum.number}) har forsvunnet`,
        baseValue: baseNum,
        headValue: undefined,
        exception: ex,
      });
    } else if (baseNum.number !== headNum.number) {
      const ex = findMatchingException("person", personId, squadPath, "mutate", exceptions, usedExceptions);
      changes.push({
        entity: "person",
        id: personId,
        path: squadPath,
        changeType: "mutate",
        status: ex ? "APPROVED_EXCEPTION" : "DESTRUCTIVE_CHANGE",
        message: `Draktnummer for sesong ${baseNum.season} endret fra #${baseNum.number} til #${headNum.number}`,
        baseValue: baseNum.number,
        headValue: headNum.number,
        exception: ex,
      });
    }
  }

  for (const [key, headNum] of headSquad) {
    if (!baseSquad.has(key)) {
      changes.push({
        entity: "person",
        id: personId,
        path: `squadNumbers/${key}`,
        changeType: "add",
        status: "SAFE_ENRICHMENT",
        message: `Nytt draktnummer lagt til for sesong ${headNum.season} (#${headNum.number})`,
        baseValue: undefined,
        headValue: headNum,
      });
    }
  }

  // 7. Providers
  const provKey = (p: ProviderRef) => p.providerId;
  const baseProviders = new Map(basePerson.providers.map((p) => [provKey(p), p]));
  const headProviders = new Map(headPerson.providers.map((p) => [provKey(p), p]));

  for (const [key, baseProv] of baseProviders) {
    const headProv = headProviders.get(key);
    const provPath = `providers/${key}`;
    if (!headProv) {
      const ex = findMatchingException("person", personId, provPath, "remove", exceptions, usedExceptions);
      changes.push({
        entity: "person",
        id: personId,
        path: provPath,
        changeType: "remove",
        status: ex ? "APPROVED_EXCEPTION" : "DESTRUCTIVE_CHANGE",
        message: `ProviderRef «${key}» har forsvunnet fra person`,
        baseValue: baseProv,
        headValue: undefined,
        exception: ex,
      });
    }
  }

  for (const [key, headProv] of headProviders) {
    if (!baseProviders.has(key)) {
      changes.push({
        entity: "person",
        id: personId,
        path: `providers/${key}`,
        changeType: "add",
        status: "SAFE_ENRICHMENT",
        message: `Ny ProviderRef «${key}» lagt til på person`,
        baseValue: undefined,
        headValue: headProv,
      });
    }
  }

  // 8. Scalar fields (wikidata, position, nationality, note)
  const scalarFields: Array<"wikidata" | "position" | "nationality" | "note"> = [
    "wikidata",
    "position",
    "nationality",
    "note",
  ];

  for (const field of scalarFields) {
    const baseVal = basePerson[field];
    const headVal = headPerson[field];

    if (baseVal && !headVal) {
      const ex = findMatchingException("person", personId, field, "remove", exceptions, usedExceptions);
      changes.push({
        entity: "person",
        id: personId,
        path: field,
        changeType: "remove",
        status: ex ? "APPROVED_EXCEPTION" : "DESTRUCTIVE_CHANGE",
        message: `Feltet «${field}» («${baseVal}») har forsvunnet fra personen`,
        baseValue: baseVal,
        headValue: undefined,
        exception: ex,
      });
    } else if (!baseVal && headVal) {
      changes.push({
        entity: "person",
        id: personId,
        path: field,
        changeType: "enrich",
        status: "SAFE_ENRICHMENT",
        message: `Feltet «${field}» («${headVal}») er lagt til på personen`,
        baseValue: undefined,
        headValue: headVal,
      });
    } else if (baseVal && headVal && baseVal !== headVal) {
      const ex = findMatchingException("person", personId, field, "mutate", exceptions, usedExceptions);
      changes.push({
        entity: "person",
        id: personId,
        path: field,
        changeType: "mutate",
        status: ex ? "APPROVED_EXCEPTION" : "DESTRUCTIVE_CHANGE",
        message: `Feltet «${field}» er endret fra «${baseVal}» til «${headVal}»`,
        baseValue: baseVal,
        headValue: headVal,
        exception: ex,
      });
    }
  }

  return changes;
}

/**
 * Sammenligner alle personer mellom BASE og HEAD.
 */
export function runPreservationAudit(
  basePeople: Map<string, Person>,
  headPeople: Map<string, Person>,
  exceptions: PreservationException[] = [],
  baseRef = "BASE",
  headRef = "HEAD",
): PreservationAuditResult {
  const changes: PreservationChangeDetail[] = [];
  const usedExceptions = new Set<PreservationException>();
  let existingPeopleChanged = 0;
  let newPeopleAdded = 0;
  let peopleDeleted = 0;

  // Sjekk eksisterende personer i BASE
  for (const [id, basePerson] of basePeople) {
    const headPerson = headPeople.get(id);
    if (!headPerson) {
      peopleDeleted += 1;
      const ex = findMatchingException("person", id, "file", "delete_file", exceptions, usedExceptions);
      changes.push({
        entity: "person",
        id,
        path: "file",
        changeType: "delete_file",
        status: ex ? "APPROVED_EXCEPTION" : "DESTRUCTIVE_CHANGE",
        message: `Personfilen for «${id}» («${basePerson.name}») er slettet`,
        baseValue: basePerson,
        headValue: undefined,
        exception: ex,
      });
      continue;
    }

    const personChanges = comparePerson(basePerson, headPerson, exceptions, usedExceptions);
    if (personChanges.length > 0) {
      existingPeopleChanged += 1;
      changes.push(...personChanges);
    }
  }

  // Sjekk nye personer i HEAD
  for (const [id, headPerson] of headPeople) {
    if (!basePeople.has(id)) {
      newPeopleAdded += 1;
      changes.push({
        entity: "person",
        id,
        path: "file",
        changeType: "add",
        status: "ADDITION",
        message: `Ny person «${id}» («${headPerson.name}») opprettet`,
        baseValue: undefined,
        headValue: headPerson,
      });
    }
  }

  // Tell statistikk
  let additions = 0;
  let safeEnrichments = 0;
  let reviewRequired = 0;
  let approvedExceptions = 0;
  let destructiveChanges = 0;

  for (const c of changes) {
    switch (c.status) {
      case "ADDITION":
        additions += 1;
        break;
      case "SAFE_ENRICHMENT":
        safeEnrichments += 1;
        break;
      case "REVIEW_REQUIRED":
        reviewRequired += 1;
        break;
      case "APPROVED_EXCEPTION":
        approvedExceptions += 1;
        break;
      case "DESTRUCTIVE_CHANGE":
        destructiveChanges += 1;
        break;
      case "UNCHANGED":
        break;
    }
  }

  // Finn ubrukte/stale exceptions
  const staleExceptions = exceptions.filter((ex) => !usedExceptions.has(ex));

  const summary: PreservationAuditSummary = {
    peopleChecked: basePeople.size,
    existingPeopleChanged,
    newPeopleAdded,
    peopleDeleted,
    additions,
    safeEnrichments,
    reviewRequired,
    approvedExceptions,
    destructiveChanges,
    staleExceptions,
  };

  const passed = destructiveChanges === 0;

  return {
    baseRef,
    headRef,
    passed,
    summary,
    changes,
  };
}
