const LEASE_MS = 12 * 60 * 1000;

interface Lease {
  owner: string;
  expiresAt: number;
}

declare global {
  var __aafkVerificationLeases: Map<string, Lease> | undefined;
}

const leases = globalThis.__aafkVerificationLeases ?? new Map<string, Lease>();
globalThis.__aafkVerificationLeases = leases;

function prune(now = Date.now()) {
  for (const [caseId, lease] of leases) {
    if (lease.expiresAt <= now) leases.delete(caseId);
  }
}

export function claimVerificationCase(caseId: string, owner: string): { acquired: boolean; expiresAt: number } {
  const now = Date.now();
  prune(now);
  const existing = leases.get(caseId);
  if (existing && existing.owner !== owner) return { acquired: false, expiresAt: existing.expiresAt };
  const expiresAt = now + LEASE_MS;
  leases.set(caseId, { owner, expiresAt });
  return { acquired: true, expiresAt };
}

export function releaseVerificationCase(caseId: string, owner: string): boolean {
  prune();
  if (leases.get(caseId)?.owner !== owner) return false;
  return leases.delete(caseId);
}

export function checkedOutCaseIds(owner?: string): string[] {
  prune();
  return [...leases].filter(([, lease]) => lease.owner !== owner).map(([caseId]) => caseId);
}
