import type { Metadata, Viewport } from "next";
import { Analytics } from "@/components/Analytics";
import { JugendMark, JugendRule } from "@/components/Jugend";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://aafkstats.vercel.app"),
  title: { default: "AaFK-arkivet", template: "%s · AaFK-arkivet" },
  description: "Et uoffisielt, søkbart arkiv over Aalesunds Fotballklubbs kamphistorikk.",
  openGraph: {
    title: "AaFK-arkivet",
    description: "Kamphistorikken til AaFK — søkbar, kildeført og åpen.",
    type: "website",
    locale: "nb_NO",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f2e9" },
    { media: "(prefers-color-scheme: dark)", color: "#14120f" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nb">
      <body>
        <a className="skip-link" href="#innhold">Hopp til innhold</a>
        <div className="prototype-bar">Uoffisielt supporterprosjekt · under oppbygging</div>
        <header className="masthead">
          <div className="masthead-inner">
            <a className="wordmark" href="/">AaFK<span>-arkivet</span></a>
            <nav aria-label="Hovedmeny">
              <a href="/sesonger">Sesonger</a>
              <a href="/motstandere">Motstandere</a>
              <a href="/kilder">Kilder</a>
              <a href="/data">Datasettet</a>
              <a href="/om">Om</a>
              <a className="nav-cta" href="/bidra">Bidra</a>
            </nav>
          </div>
        </header>
        <main id="innhold" className="wrap">{children}</main>
        {/* Skillet mot bunnteksten. Ornamentet står her i stedet for en strek,
            og er det eneste stedet på siden jugendstilen får plass i full form. */}
        <JugendRule />
        <footer>
          <div className="wrap footer-grid">
            <div><a className="wordmark footer-wordmark" href="/"><JugendMark />AaFK<span>-arkivet</span></a><p>Et uoffisielt, åpent prosjekt uten tilknytning til Aalesunds Fotballklubb eller datakildene.</p></div>
            <div><strong>Arkivet</strong><a href="/sesonger">Sesonger</a><a href="/motstandere">Motstandere</a><a href="/kilder">Kilder</a><a href="/data">Datasettet</a></div>
            <div><strong>Prosjektet</strong><a href="/om">Om og kilder</a><a href="/bidra">Bidra</a><a href="https://github.com/mlervaag/aafkstats">GitHub</a></div>
          </div>
          <div className="wrap footer-legal">Kode under MIT. Egne tekster under CC BY 4.0. Tredjepartskilder har egne vilkår.</div>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
