import type { Metadata } from "next";
import { all, open } from "@aafkstats/db";

export const metadata: Metadata = {
  title: "Publikasjoner og historisk arkiv",
  description: "Historiske bøker, medlemsblader og andre publikasjoner om Aalesunds Fotballklubb.",
};

export const dynamic = "force-dynamic";

interface Publication {
  id: string;
  title: string;
  type: string;
  publisher: string | null;
  year: number | null;
  cover_url: string | null;
  access_url: string | null;
  url: string;
}

export default function ArkivetPage() {
  const db = open();
  const publications = all<Publication>(
    db,
    "SELECT * FROM publications ORDER BY coalesce(year, 0) DESC, title ASC"
  );

  return (
    <>
      <header className="page-header">
        <h1>Publikasjoner og historisk arkiv</h1>
        <p className="lead">
          Historiske bøker, medlemsblader og andre publikasjoner. Innholdet er digitalisert av Nasjonalbiblioteket og AaFK Historiske arkiv.
        </p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "2rem", marginTop: "2rem" }}>
        {publications.map((pub) => (
          <a
            key={pub.id}
            href={pub.access_url || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="card"
            style={{ display: "flex", flexDirection: "column", textDecoration: "none", color: "inherit", background: "#fff", padding: "1rem", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", transition: "transform 0.2s ease" }}
          >
            {pub.cover_url ? (
              <div style={{ width: "100%", aspectRatio: "2/3", overflow: "hidden", marginBottom: "1rem", borderRadius: "4px", backgroundColor: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <img src={pub.cover_url} alt={`Forside for ${pub.title}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} referrerPolicy="no-referrer" />
              </div>
            ) : (
              <div style={{ width: "100%", aspectRatio: "2/3", overflow: "hidden", marginBottom: "1rem", borderRadius: "4px", backgroundColor: "#eaeaea", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "#888", fontSize: "0.9rem", padding: "1rem", textAlign: "center" }}>{pub.title}</span>
              </div>
            )}
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: "0.8rem", color: "#666", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                {pub.type === "book" ? "Bok" : pub.type === "magazine" ? "Medlemsblad" : pub.type === "article" ? "Artikkel" : "Publikasjon"} 
                {pub.year ? ` · ${pub.year}` : ""}
              </div>
              <h2 style={{ fontSize: "1.1rem", margin: "0 0 0.5rem 0", lineHeight: 1.3 }}>{pub.title}</h2>
              {pub.publisher && <div style={{ fontSize: "0.9rem", color: "#666" }}>Utgiver: {pub.publisher}</div>}
            </div>
            <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid #eee", fontSize: "0.9rem", fontWeight: "bold", color: "#0047b3" }}>
              Les hos kilden →
            </div>
          </a>
        ))}
      </div>
    </>
  );
}
