import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://aafkstats.vercel.app"),
  title: { default: "AaFK-arkivet", template: "%s · AaFK-arkivet" },
  description: "Et uoffisielt, søkbart arkiv med 450 AaFK-kamper fra 2011 til 2025.",
  openGraph: {
    title: "AaFK-arkivet",
    description: "450 kamper · 15 sesonger · 2011–2025",
    type: "website",
    locale: "nb_NO",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "AaFK-arkivet – uoffisielt historisk arkiv" }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f7f2e9" };

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
              <a href="/data">Datasettet</a>
              <a href="/om">Om</a>
              <a className="nav-cta" href="/bidra">Bidra</a>
            </nav>
          </div>
        </header>
        <main id="innhold" className="wrap">{children}</main>
        <footer>
          <div className="wrap footer-grid">
            <div><a className="wordmark" href="/">AaFK<span>-arkivet</span></a><p>Et uoffisielt, åpent prosjekt uten tilknytning til Aalesunds Fotballklubb eller datakildene.</p></div>
            <div><strong>Arkivet</strong><a href="/sesonger">Sesonger</a><a href="/motstandere">Motstandere</a><a href="/data">Datasettet</a></div>
            <div><strong>Prosjektet</strong><a href="/om">Om og kilder</a><a href="/bidra">Bidra</a><a href="https://github.com/mlervaag/aafkstats">GitHub</a></div>
          </div>
          <div className="wrap footer-legal">Kode under MIT. Egne tekster under CC BY 4.0. Tredjepartskilder har egne vilkår.</div>
        </footer>
      </body>
    </html>
  );
}
