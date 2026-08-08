import type { Metadata } from "next";
import { all, open } from "@aafkstats/db";

export const metadata: Metadata = {
  title: "Historisk kildearkiv",
  description: "Bøker, medlemsblad, jubileumsskrift, årsmeldinger og andre kilder til AaFKs historie.",
};

export const dynamic = "force-dynamic";

interface HistoricalSource {
  id: string;
  parent_source_id: string | null;
  title: string;
  source_type: string;
  publisher: string | null;
  year: number | null;
  cover_url: string | null;
  access_url: string | null;
}

export default function ArkivetPage() {
  const db = open();
  const sources = all<HistoricalSource>(
    db,
    "SELECT * FROM core_sources ORDER BY coalesce(year, 0) DESC, title ASC"
  );

  const series = new Map<string, HistoricalSource[]>();
  const singles: HistoricalSource[] = [];

  for (const source of sources) {
    if (source.parent_source_id) {
      const group = series.get(source.parent_source_id) || [];
      group.push(source);
      series.set(source.parent_source_id, group);
    } else {
      singles.push(source);
    }
  }

  return (
    <>
      <header className="page-header">
        <h1>Historisk kildearkiv</h1>
        <p className="lead">
          Bøker, medlemsblad, jubileumsskrift, årsmeldinger og andre kilder til AaFKs historie.
        </p>
      </header>

      <style>{`
        .publications-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
          gap: 1rem;
          margin-top: 2rem;
        }
        @media (min-width: 640px) {
          .publications-grid {
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 2rem;
          }
        }
        .pub-card {
          display: flex;
          flex-direction: column;
          text-decoration: none;
          color: inherit;
          background: #fff;
          padding: 1rem;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          transition: transform 0.2s ease;
        }
        .pub-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        }
        .series-card {
          display: flex;
          flex-direction: row;
          align-items: center;
          background: #fff;
          padding: 1rem 1.5rem;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          margin-top: 1rem;
        }
      `}</style>

      {series.size > 0 && (
        <div style={{ marginTop: "2rem" }}>
          <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Serier og faste utgivelser</h2>
          {Array.from(series.entries()).map(([parentId, items]) => (
            <div key={parentId} className="series-card">
              <div style={{ flex: 1 }}>
                <div style={{ textTransform: "uppercase", fontSize: "0.8rem", letterSpacing: "1px", color: "#666", marginBottom: "0.25rem" }}>
                  {items[0].source_type.charAt(0).toUpperCase() + items[0].source_type.slice(1)}
                </div>
                <h3 style={{ fontSize: "1.2rem", margin: "0 0 0.25rem 0" }}>{parentId === 'aafk-medlemsblad' ? 'AaFK Medlemsblad' : parentId}</h3>
                <div style={{ fontSize: "0.9rem", color: "#666" }}>
                  {Math.min(...items.map(i => i.year || 9999))} til {Math.max(...items.map(i => i.year || 0))} · {items.length} utgaver
                </div>
              </div>
              <div style={{ fontWeight: "bold", color: "#0047b3" }}>
                Se alle →
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 style={{ fontSize: "1.5rem", marginTop: "3rem", marginBottom: "1rem" }}>Bøker og enkeltutgivelser</h2>
      <div className="publications-grid">
        {singles.map((pub) => (
          <a
            key={pub.id}
            href={pub.access_url || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="pub-card"
          >
            {pub.cover_url ? (
              <div style={{ width: "100%", aspectRatio: "2/3", overflow: "hidden", marginBottom: "1rem", borderRadius: "4px", backgroundColor: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <img src={`/api/nb-image?url=${encodeURIComponent(pub.cover_url)}`} alt={`Forside for ${pub.title}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            ) : (
              <div style={{ width: "100%", aspectRatio: "2/3", overflow: "hidden", marginBottom: "1rem", borderRadius: "4px", backgroundColor: "#eaeaea", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "#888", fontSize: "0.9rem", padding: "1rem", textAlign: "center" }}>{pub.title}</span>
              </div>
            )}
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div style={{ textTransform: "uppercase", fontSize: "0.8rem", letterSpacing: "1px", color: "#666", marginBottom: "0.25rem" }}>
                {pub.source_type.charAt(0).toUpperCase() + pub.source_type.slice(1)}
                {pub.year ? ` · ${pub.year}` : ""}
              </div>
              <h2 style={{ fontSize: "1.1rem", margin: "0 0 0.5rem 0", lineHeight: 1.3, color: "#111", fontWeight: 700 }}>{pub.title}</h2>
              {pub.publisher && <div style={{ fontSize: "0.9rem", color: "#666" }}>Utgiver: {pub.publisher}</div>}
            </div>
            {pub.access_url && (
              <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid #eee", fontSize: "0.9rem", fontWeight: "bold", color: "#0047b3" }}>
                Les hos kilden →
              </div>
            )}
          </a>
        ))}
      </div>
      
      <div style={{ marginTop: "4rem", padding: "2rem", backgroundColor: "#f8f9fa", borderRadius: "8px", textAlign: "center" }}>
        <h3 style={{ fontSize: "1.3rem", marginBottom: "0.5rem" }}>Mangler vi noe?</h3>
        <p style={{ color: "#555", marginBottom: "1.5rem" }}>Tips oss om en bok, et blad eller annet AaFK-materiale du mener burde vært i arkivet.</p>
        <button style={{ background: "#0047b3", color: "white", padding: "0.75rem 1.5rem", border: "none", borderRadius: "4px", fontSize: "1rem", cursor: "pointer", fontWeight: "bold" }}>
          Tips oss om en kilde
        </button>
      </div>
    </>
  );
}
