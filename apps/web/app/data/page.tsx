import { exampleQueries, views } from "@aafkstats/query/dataset";

export const metadata = { title: "Datasettet — AaFK-arkivet" };

/**
 * Dokumentasjon av det publiserte datasettet.
 *
 * Denne siden og chattens systemprompt bygges av nøyaktig samme kilde
 * (packages/query/src/dataset.ts). Det er et bevisst valg: du kan lese her hva
 * spørrefunksjonen faktisk vet om datasettet — det finnes ingen skjult beskrivelse
 * modellen har og du ikke har.
 */
export default function DataPage() {
  return (
    <>
      <h1>Datasettet</h1>
      <p className="prose">
        Alt i arkivet ligger som YAML-filer på GitHub. Ved hver utrulling bygges de om til
        et Postgres-skjema, <code>public_api</code>, som er det nettstedet, API-et,
        MCP-serveren og spørrefunksjonen leser fra.
      </p>
      <p className="prose">
        Beskrivelsen under er den samme teksten spørrefunksjonen får i systemprompten sin.
        Det finnes ingen egen, skjult versjon — det du leser her er det modellen vet.
      </p>

      <nav aria-label="Tabeller" style={{ margin: "2rem 0" }}>
        <ul style={{ paddingLeft: "1.1rem" }}>
          {views.map((v) => (
            <li key={v.name}>
              <a href={`#${v.name.replace(".", "-")}`}>
                <code>{v.name}</code>
              </a>{" "}
              — <span className="muted">{v.summary.split(".")[0]}.</span>
            </li>
          ))}
        </ul>
      </nav>

      {views.map((view) => (
        <section key={view.name} id={view.name.replace(".", "-")} style={{ marginTop: "3rem" }}>
          <h2>
            <code>{view.name}</code>
          </h2>
          <p className="prose">{view.summary}</p>

          {view.caveats && view.caveats.length > 0 && (
            <div className="notice prose" style={{ margin: "1rem 0 1.5rem" }}>
              <strong>Viktig å vite:</strong>
              <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.1rem" }}>
                {view.caveats.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Kolonne</th>
                  <th scope="col">Type</th>
                  <th scope="col">Betydning</th>
                </tr>
              </thead>
              <tbody>
                {view.columns.map((col) => (
                  <tr key={col.name}>
                    <td>
                      <code>{col.name}</code>
                    </td>
                    <td className="muted">{col.type}</td>
                    <td style={{ whiteSpace: "normal" }}>{col.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <section style={{ marginTop: "3rem" }}>
        <h2>Eksempelspørringer</h2>
        <p className="prose">
          Disse kjøres som en del av testene, så de virker alltid mot datasettet slik det
          er nå.
        </p>
        {exampleQueries.map((ex) => (
          <div key={ex.question} style={{ marginTop: "1.5rem" }}>
            <p className="prose">
              <strong>{ex.question}</strong>
            </p>
            <div className="queries">
              <pre>{ex.sql}</pre>
            </div>
          </div>
        ))}
      </section>

      <section style={{ marginTop: "3rem" }}>
        <h2>Slik er spørrefunksjonen begrenset</h2>
        <div className="prose">
          <p>
            Spørrefunksjonen kan kjøre egne SELECT-spørringer mot <code>public_api</code>.
            Det er dét som gjør at den kan svare på spørsmål ingen har laget et ferdig
            oppslag for. Grensene er:
          </p>
          <ul>
            <li>
              Den kjører som en egen databaserolle med leserett <em>kun</em> på{" "}
              <code>public_api</code>. Rollen har ingen tilgang til de underliggende
              tabellene og kan ikke skrive noe sted. Dette håndheves av Postgres, ikke av
              koden vår.
            </li>
            <li>Én setning per spørring, og bare SELECT.</li>
            <li>Maks 200 rader og 3 sekunders kjøretid.</li>
            <li>
              Hver spørring som kjøres vises under svaret, så du kan etterprøve hva svaret
              bygger på.
            </li>
          </ul>
          <p>
            Referattekst i arkivet er skrevet av bidragsytere. Spørrefunksjonen behandler
            slikt innhold som data, aldri som instruksjoner til seg selv.
          </p>
        </div>
      </section>
    </>
  );
}
