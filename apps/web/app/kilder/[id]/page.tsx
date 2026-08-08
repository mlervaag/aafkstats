import { notFound } from "next/navigation";
import { one, all, open } from "@aafkstats/db";
import { SourceTypeBadge } from "@/components/sources/SourceTypeBadge";
import { SourceCard } from "@/components/sources/SourceCard";

export const dynamic = "force-dynamic";

interface SourceDetail {
  id: string;
  parent_source_id: string | null;
  title: string;
  source_type: string;
  issue: string | null;
  volume: string | null;
  publisher: string | null;
  year: number | null;
  cover_url: string | null;
  access_url: string | null;
}

export default async function SourceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = open();
  
  let source: SourceDetail | undefined;
  let children: SourceDetail[] = [];
  
  try {
    source = one<SourceDetail>(db, "SELECT * FROM core_sources WHERE id = ?", id);
    if (!source) {
      return notFound();
    }
    
    if (source.source_type === 'series') {
      children = all<SourceDetail>(
        db, 
        "SELECT * FROM core_sources WHERE parent_source_id = ? ORDER BY coalesce(year, 0) DESC, issue DESC", 
        id
      );
    }
  } finally {
    db.close();
  }

  return (
    <article>
      <header className="page-header" style={{ marginBottom: "2rem" }}>
        <SourceTypeBadge type={source.source_type} year={source.year} />
        <h1 style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>{source.title}</h1>
        {source.issue && <div style={{ fontSize: "1.2rem", color: "#666" }}>Utgave: {source.issue}{source.volume ? `, Årgang: ${source.volume}` : ""}</div>}
      </header>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "2rem", alignItems: "flex-start" }}>
        {source.cover_url && (
          <div style={{ flex: "0 0 300px", borderRadius: "8px", overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
            <img 
              src={`/api/nb-image?url=${encodeURIComponent(source.cover_url)}`} 
              alt={`Forside for ${source.title}`} 
              style={{ width: "100%", height: "auto", display: "block" }} 
            />
          </div>
        )}
        
        <div style={{ flex: "1 1 400px" }}>
          <div style={{ background: "#f8f9fa", padding: "1.5rem", borderRadius: "8px" }}>
            <h2 style={{ fontSize: "1.2rem", marginBottom: "1rem", borderBottom: "1px solid #ddd", paddingBottom: "0.5rem" }}>Fakta om kilden</h2>
            <dl style={{ display: "grid", gridTemplateColumns: "max-content 1fr", gap: "0.5rem 1rem", margin: 0 }}>
              <dt style={{ fontWeight: "bold", color: "#555" }}>Kildetype</dt>
              <dd style={{ margin: 0 }}>{source.source_type}</dd>
              
              {source.publisher && (
                <>
                  <dt style={{ fontWeight: "bold", color: "#555" }}>Utgiver</dt>
                  <dd style={{ margin: 0 }}>{source.publisher}</dd>
                </>
              )}
              
              {source.year && (
                <>
                  <dt style={{ fontWeight: "bold", color: "#555" }}>År</dt>
                  <dd style={{ margin: 0 }}>{source.year}</dd>
                </>
              )}
            </dl>
          </div>

          {source.access_url && (
            <div style={{ marginTop: "2rem" }}>
              <h2 style={{ fontSize: "1.2rem", marginBottom: "1rem" }}>Tilgjengelig hos</h2>
              <a 
                href={source.access_url} 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ display: "inline-block", background: "#0047b3", color: "white", padding: "0.75rem 1.5rem", borderRadius: "4px", textDecoration: "none", fontWeight: "bold" }}
              >
                Les publikasjonen →
              </a>
            </div>
          )}
        </div>
      </div>

      {children.length > 0 && (
        <section style={{ marginTop: "4rem" }}>
          <h2 style={{ fontSize: "1.8rem", marginBottom: "1.5rem", borderBottom: "2px solid #eee", paddingBottom: "0.5rem" }}>
            Utgivelser ({children.length})
          </h2>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: "2rem"
          }}>
            {children.map((child) => (
              <SourceCard
                key={child.id}
                id={child.id}
                title={child.title}
                sourceType={child.source_type}
                year={child.year}
                publisher={child.publisher}
                coverUrl={child.cover_url}
              />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
