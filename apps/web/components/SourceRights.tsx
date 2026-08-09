import { all, open } from "@aafkstats/db";

/**
 * Rettighetsstatus per kilde, hentet fra arkivet selv.
 *
 * Står her fordi et arkiv som lever av etterprøvbarhet ikke bør gjemme sin egen
 * rettighetssituasjon i en YAML-fil. Den som lurer på om dataene kan gjenbrukes,
 * skal kunne se hva vi faktisk vet — inkludert der vi ikke har avklart noe.
 */

interface SourceRow {
  provider_id: string;
  name: string;
  url: string | null;
  automated_access: string;
  public_redistribution: string;
  permission_status: string;
  ingest_decision: string;
  risk_accepted_at: string | null;
  risk_accepted_by: string | null;
  attribution_required: number;
  permission_note: string | null;
}

const ACCESS: Record<string, string> = {
  allowed: "Tillatt",
  permission_required: "Krever avtale",
  blocked: "Ikke tillatt",
  unknown: "Uavklart",
};

const REDISTRIBUTION: Record<string, string> = {
  allowed: "Tillatt",
  permission_required: "Krever avtale",
  denied: "Ikke tillatt",
  unknown: "Uavklart",
};

/** Hva motparten har sagt. */
const PERMISSION: Record<string, string> = {
  not_needed: "Ikke nødvendig",
  pending: "Ikke søkt",
  requested: "Forespurt",
  granted: "Gitt",
  denied: "Avslått",
};

/**
 * Hva vi har bestemt.
 *
 * Sto tidligere som en tillatelsesstatus, og da kunne ikke en kilde være både
 * forespurt og videreført. Verre: «bevisst valg uten tillatelse» så ut som noe
 * motparten hadde sagt, når det var vårt eget.
 */
const DECISION: Record<string, string> = {
  blocked: "Ikke høstet",
  pending: "Ikke bestemt",
  allowed: "Høstet",
  accepted_risk: "Høstet på akseptert risiko",
};

/** Grønn når noe er avklart, gul når det er tatt et valg, rød når det er uavklart. */
function tone(status: string): string {
  if (status === "granted" || status === "not_needed" || status === "allowed") return "ok";
  if (status === "accepted_risk" || status === "requested") return "note";
  if (status === "denied" || status === "blocked") return "open";
  return "open";
}

export function SourceRights() {
  const db = open();
  let rows: SourceRow[];
  try {
    rows = all<SourceRow>(
      db,
      `SELECT provider_id, name, url, automated_access, public_redistribution,
              permission_status, ingest_decision, risk_accepted_at, risk_accepted_by,
              attribution_required, permission_note
       FROM providers ORDER BY name`,
    );
  } finally {
    db.close();
  }

  return (
    <>
      {/* Forklaringen sto som <caption> inne i den vannrett rullende ruta, og ble
          derfor like bred som tabellen — altså bredere enn spalten, og avkuttet
          midt i en setning for enhver som ikke rullet sidelengs. */}
      <p className="small muted rights-intro" id="rettigheter-forklaring">
        Fire spørsmål, ikke ett. Om noe kan hentes og om det kan publiseres er to ting,
        og hva motparten har svart er noe annet enn hva vi har bestemt. At en opplysning
        er et faktum uten opphavsrett sier ingenting om vilkårene til samlingen den kom fra.
      </p>
      <div className="table-scroll">
        <table className="rights-table" aria-describedby="rettigheter-forklaring">
          <thead>
            <tr>
              <th scope="col">Kilde</th>
              <th scope="col">Kan hentes</th>
              <th scope="col">Kan publiseres</th>
              <th scope="col">Tillatelse</th>
              <th scope="col">Vår beslutning</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.provider_id}>
                <th scope="row">
                  {row.url ? <a href={row.url}>{row.name}</a> : row.name}
                  {row.attribution_required === 1 && (
                    <span className="muted small"> · krever kreditering</span>
                  )}
                  {row.permission_note && (
                    <span className="rights-note muted small">{row.permission_note}</span>
                  )}
                </th>
                <td>{ACCESS[row.automated_access] ?? row.automated_access}</td>
                <td>{REDISTRIBUTION[row.public_redistribution] ?? row.public_redistribution}</td>
                <td>
                  <span className={`rights-status rights-${tone(row.permission_status)}`}>
                    {PERMISSION[row.permission_status] ?? row.permission_status}
                  </span>
                </td>
                <td>
                  <span className={`rights-status rights-${tone(row.ingest_decision)}`}>
                    {DECISION[row.ingest_decision] ?? row.ingest_decision}
                  </span>
                  {/* En risikobeslutning uten navn og dato er ikke etterprøvbar. */}
                  {row.risk_accepted_at && (
                    <span className="muted small rights-who">
                      {row.risk_accepted_by} · {row.risk_accepted_at}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
