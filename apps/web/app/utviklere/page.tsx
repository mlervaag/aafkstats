import type { Metadata } from "next";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata(
  "For utviklere",
  "Koble AI-verktøy til AaFK-arkivet med MCP, eller bygg med det åpne REST API-et.",
  "/utviklere",
  "website",
);

const mcpConfig = `{
  "mcpServers": {
    "aafkarkivet": {
      "url": "https://aafkarkivet.no/mcp"
    }
  }
}`;

export default function DevelopersPage() {
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Åpne grensesnitt</p>
        <h1>Bygg med AaFK-arkivet</h1>
        <p className="lede">
          Koble AaFK-arkivet til AI-verktøyet ditt med MCP. Bygger du et nettsted,
          skript eller en app, kan du bruke det åpne REST API-et. Begge leser de samme
          publiserte dataene og åpne researchsakene.
        </p>
      </header>

      <section className="notice prose">
        <h2>Gratis, uten konto eller API-nøkkel</h2>
        <p>
          Grensesnittene er en del av supporterarkivet og skal være enkle å ta i bruk.
          Vis hensyn med automatiserte kall: arkivet drives uten en egen API-database
          eller betalt køtjeneste, og kan begrense trafikk som belaster fellesskapet.
        </p>
      </section>

      <section className="content-section" aria-labelledby="rest-title">
        <div className="section-heading">
          <div><p className="eyebrow">For programvare</p><h2 id="rest-title">REST API</h2></div>
          <a href="/api/v1/openapi.json">Åpne OpenAPI →</a>
        </div>
        <div className="prose">
          <p>
            Baseadressen er <code>https://aafkarkivet.no/api/v1</code>. Alle ruter er
            skrivebeskyttede GET-ruter med JSON-svar, CORS og offentlig mellomlagring.
          </p>
          <p><strong>Finn de største dokumenterte seirene:</strong></p>
          <div className="queries"><pre>{`curl "https://aafkarkivet.no/api/v1/results?ranking=largest_win&limit=10"`}</pre></div>
          <p><strong>Finn åpne saker fellesskapet kan undersøke:</strong></p>
          <div className="queries"><pre>{`curl "https://aafkarkivet.no/api/v1/research/cases?limit=10"`}</pre></div>
          <p>
            Se også <a href="/api/v1/meta">metadata og datasettrevisjon</a> eller den
            komplette <a href="https://github.com/mlervaag/aafkstats/blob/main/docs/API.md">API-kontrakten på GitHub</a>.
          </p>
        </div>
      </section>

      <section className="scope-note" aria-labelledby="evidence-title">
        <div><p className="eyebrow">Viktig skille</p><h2 id="evidence-title">Hva vet arkivet?</h2></div>
        <div className="prose">
          <p><strong><code>canonical_match</code></strong> er en kamp arkivet har identifisert og lagt inn i den kanoniske kamphistorikken.</p>
          <p><strong><code>source_claim</code></strong> er et resultat en historisk kilde oppgir, men som ennå ikke er sikkert koblet til én bestemt kamp.</p>
          <p>
            Begge kan være relevante treff, men de skal aldri summeres til én statistisk
            total. Kontroller også <code>confidence</code>, <code>hasConflicts</code> og
            <code>missingFields</code> før du presenterer et svar som sikkert.
          </p>
        </div>
      </section>

      <section className="content-section" aria-labelledby="mcp-title">
        <div className="section-heading">
          <div><p className="eyebrow">For AI-verktøy</p><h2 id="mcp-title">MCP</h2></div>
          <a href="https://github.com/mlervaag/aafkstats/blob/main/docs/MCP.md">Full dokumentasjon →</a>
        </div>
        <div className="prose">
          <p>
            Serveradressen er <code>https://aafkarkivet.no/mcp</code>. Innstillingsfilen
            varierer mellom klienter, men en vanlig konfigurasjon ser slik ut:
          </p>
          <div className="queries"><pre>{mcpConfig}</pre></div>
          <p>
            MCP gir strukturerte verktøy for kamper, resultater, personer, kilder og åpne
            researchsaker. Konflikter og dekningshull finnes i researchoversikten. Det
            finnes ingen generell SQL-tilgang og ingen direkte skrivetilgang til
            arkivdataene.
          </p>
        </div>
      </section>

      <section className="content-section notice prose" id="research">
        <h2>AI kan hjelpe med research, men er ikke en kilde</h2>
        <p>
          Et AI-verktøy kan finne en åpen sak, hjelpe deg å lete og sende et dokumentert
          funn til vurdering. Selve kilden må være en konkret bok, avisside, nettside eller
          annen etterprøvbar dokumentasjon — aldri bare et AI-svar.
        </p>
        <p>
          En innsending får status <code>pending_review</code>. Den går til samme innboks
          som bidrag fra nettsiden. Et menneske kontrollerer kilden, lager eventuelt en
          draft-PR og avgjør om endringen skal merges. AI kan ikke endre data, opprette en
          publiserings-PR eller merge på egen hånd.
        </p>
        <p><a href="/mangler">Velg en åpen researchsak →</a></p>
      </section>

      <section className="content-section prose">
        <h2>Rettigheter og drift</h2>
        <p>
          Koden er MIT-lisensiert, mens egne tekster og redaksjonelt innhold er CC BY 4.0.
          Tredjepartskilder beholder sine egne vilkår. Les <a href="/data">datasettsiden</a>,
          <a href="https://github.com/mlervaag/aafkstats/blob/main/DATA_LICENSE.md"> lisensvilkårene</a> og
          <a href="https://github.com/mlervaag/aafkstats/blob/main/SECURITY.md"> sikkerhetsgrensene</a> før større gjenbruk.
        </p>
      </section>
    </>
  );
}
