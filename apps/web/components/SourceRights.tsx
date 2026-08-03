import { all, open } from "@aafkstats/db";

/**
 * Rettighetsstatus per kilde, hentet fra arkivet selv.
 *
 * Står her fordi et arkiv som lever av etterprøvbarhet ikke bør gjemme sin egen
 * rettighetssituasjon i en YAML-fil. Den som lurer på om dataene kan gjenbrukes,
 * skal kunne se hva vi faktisk vet — inkludert der vi ikke har avklart noe.
 */

interface SourceRow {
  source_id: string;
  name: string;
  url: string | null;
  automated_access: string;
  public_redistribution: string;
  permission_status: string;
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

const PERMISSION: Record<string, string> = {
  not_needed: "Ikke nødvendig",
  pending: "Ikke søkt",
  requested: "Forespurt",
  granted: "Gitt",
  accepted_risk: "Bevisst valg uten tillatelse",
  denied: "Avslått",
};

/** Grønn når noe er avklart, gul når det er tatt et valg, rød når det er uavklart. */
function tone(status: string): string {
  if (status === "granted" || status === "not_needed") return "ok";
  if (status === "accepted_risk" || status === "requested") return "note";
  return "open";
}

export function SourceRights() {
  const db = open();
  let rows: SourceRow[];
  try {
    rows = all<SourceRow>(
      db,
      `SELECT source_id, name, url, automated_access, public_redistribution,
              permission_status, attribution_required, permission_note
       FROM sources ORDER BY name`,
    );
  } finally {
    db.close();
  }

  return (
    <div className="table-scroll">
      <table className="rights-table">
        <caption className="small muted">
          Henting og publisering er to forskjellige spørsmål. At en opplysning er et
          faktum uten opphavsrett sier ingenting om vilkårene til samlingen den kom fra.
        </caption>
        <thead>
          <tr>
            <th scope="col">Kilde</th>
            <th scope="col">Kan hentes</th>
            <th scope="col">Kan publiseres</th>
            <th scope="col">Tillatelse</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.source_id}>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
