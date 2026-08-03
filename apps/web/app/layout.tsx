import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AaFK-arkivet",
  description:
    "Fritt og åpent arkiv over Aalesunds Fotballklubbs kamphistorikk — med API, MCP-server og søk.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nb">
      <body>
        <a className="skip-link" href="#innhold">
          Hopp til innhold
        </a>
        <header className="masthead">
          <div className="masthead-inner">
            <a className="wordmark" href="/">
              AaFK<span>-arkivet</span>
            </a>
            <nav aria-label="Hovedmeny">
              <a href="/sesonger">Sesonger</a>
              <a href="/motstandere">Motstandere</a>
              <a href="/data">Datasettet</a>
              <a href="/bidra">Bidra</a>
              <a href="/api-docs">API</a>
            </nav>
          </div>
        </header>
        <main id="innhold" className="wrap">
          {children}
        </main>
        <footer className="wrap">
          <p className="prose">
            Fritt og åpent arkiv. Data under CC BY 4.0, kode under MIT.{" "}
            <a href="https://github.com/mlervaag/aafkstats">Kildekode og data på GitHub</a>.
          </p>
          <p className="prose">
            Arkivet er under oppbygging og har hull, særlig før 1990. Finner du en feil eller
            mangel, kan du <a href="/bidra">bidra</a>.
          </p>
        </footer>
      </body>
    </html>
  );
}
