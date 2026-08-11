import { exampleQueries, views } from "@aafkstats/query/dataset";
import { CompetitionTable, CoverageNote, PromptCoverage } from "@/components/CoverageNote";

export const metadata = { title: "Datasettet" };

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
      {/* Samme innledning som resten av nettstedet. Sto som en naken h1 med to
          avsnitt under, og var den ene siden uten stikkord og ingress. */}
      <header className="page-intro">
        <p className="eyebrow">Åpne data</p>
        <h1>Datasettet</h1>
        <p className="lede">
          Alt i arkivet ligger som YAML-filer på GitHub. Ved hver utrulling bygges filene om
          til en skrivebeskyttet SQLite-fil, og det er den nettstedet og spørrefunksjonen
          leser fra. Tabellene i fila er beskrevet lenger nede på siden.
        </p>
      </header>
      <p className="prose">
        Beskrivelsen under er nøyaktig den samme teksten som spørrefunksjonen får i
        systemprompten sin. Det finnes ingen egen, skjult versjon: det du leser her, er alt
        modellen vet om datasettet.
      </p>
      <CoverageNote />

      <h2 style={{ marginTop: "2rem" }}>Dekning, slik spørrefunksjonen får den</h2>
      <p className="prose">
        Disse setningene ligger i systemprompten, og de regnes ut fra databasen hver gang
        nettstedet bygges. De kan derfor ikke bli utdaterte uten at dataene faktisk endrer seg.
      </p>
      <PromptCoverage />

      <h2 style={{ marginTop: "2rem" }}>Kamper per konkurranse</h2>
      <CompetitionTable />
      <p className="prose small muted">
        Serien har skiftet navn flere ganger, og hver kamp ligger under navnet som gjaldt
        da den ble spilt. Les <a href="/om">kilder og forbehold</a> før du gjenbruker data.
      </p>

      <nav aria-label="Tabeller" style={{ margin: "2rem 0" }}>
        <ul style={{ paddingLeft: "1.1rem" }}>
          {views.map((v) => (
            <li key={v.name}>
              <a href={`#${v.name.replace(".", "-")}`}>
                <code>{v.name}</code>
              </a>{" "}
              <span className="muted">· {v.summary.split(".")[0]}.</span>
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
          Disse spørringene kjøres som en del av testene, så de virker alltid mot datasettet
          slik det ser ut nå.
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
            Spørrefunksjonen kan skrive sine egne SELECT-spørringer mot tabellene over. Det
            er dét som gjør at den kan svare på spørsmål ingen har laget et ferdig oppslag
            for. Grensene er:
          </p>
          <ul>
            <li>
              Arkivfilen åpnes skrivebeskyttet. Et forsøk på å endre noe blir avvist av
              SQLite selv, ikke av koden vår.
            </li>
            <li>
              Spørringen kjører i en egen prosess som stoppes ved tidsavbrudd, og den ser
              bare tabellene som er dokumentert på denne siden, ikke rådataene bak dem.
            </li>
            <li>Én setning per spørring, og bare SELECT.</li>
            <li>Maks 200 rader og 3 sekunders kjøretid.</li>
            <li>
              Hver spørring som kjøres, vises under svaret, så du kan etterprøve hva svaret
              bygger på.
            </li>
          </ul>
          <p>
            Referatene i arkivet er skrevet av bidragsytere. Spørrefunksjonen behandler alltid
            slik tekst som data, aldri som instruksjoner til seg selv.
          </p>
        </div>
      </section>
    </>
  );
}
