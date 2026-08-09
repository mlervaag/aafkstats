import { notFound } from "next/navigation";
import { SourceTypeBadge, SOURCE_TYPE_LABELS } from "@/components/sources/SourceTypeBadge";
import { SourceCard } from "@/components/sources/SourceCard";
import { getSourceById, getSourceChildren, getParentSource, getSourceUsages } from "@/lib/sources";
import Link from "next/link";
import { Metadata } from "next";
import { MatchRow } from "@/components/MatchRow";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const source = getSourceById(id);
  if (!source) return { title: "Kilde ikke funnet" };
  
  return {
    title: `${source.title} - AaFK-arkivet`,
    description: `Fakta og historiske kamper dokumentert av ${source.title}.`,
  };
}

export default async function SourceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const source = getSourceById(id);
  if (!source) {
    return notFound();
  }
  
  const children = source.source_type === 'series' ? getSourceChildren(id) : [];
  const parent = source.parent_source_id ? getParentSource(source.parent_source_id) : null;
  const usages = getSourceUsages(id);

  return (
    <article>
      {parent && (
        <div style={{ marginBottom: "1rem", fontSize: "0.9rem" }}>
          <Link href={`/kilder/${parent.id}`} style={{ color: "#0047b3", textDecoration: "none" }}>
            &larr; Tilbake til {parent.title}
          </Link>
        </div>
      )}

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
          <div style={{ background: "#f8f9fa", padding: "1.5rem", borderRadius: "8px", border: "1px solid #eaeaea", color: "#444" }}>
            <h2 style={{ fontSize: "1.2rem", marginBottom: "1rem", borderBottom: "1px solid #ddd", paddingBottom: "0.5rem" }}>Fakta om kilden</h2>
            <dl style={{ display: "grid", gridTemplateColumns: "max-content 1fr", gap: "0.5rem 1rem", margin: 0 }}>
              <dt style={{ fontWeight: "bold", color: "#666" }}>Kildetype</dt>
              <dd style={{ margin: 0 }}>{SOURCE_TYPE_LABELS[source.source_type] || source.source_type}</dd>
              
              {source.publisher && (
                <>
                  <dt style={{ fontWeight: "bold", color: "#666" }}>Utgiver</dt>
                  <dd style={{ margin: 0 }}>{source.publisher}</dd>
                </>
              )}
              
              {source.year && (
                <>
                  <dt style={{ fontWeight: "bold", color: "#666" }}>År</dt>
                  <dd style={{ margin: 0 }}>{source.year}</dd>
                </>
              )}

              {source.providers && source.providers.length > 0 && (
                <>
                  <dt style={{ fontWeight: "bold", color: "#666" }}>Digitalisert hos</dt>
                  <dd style={{ margin: 0 }}>
                    {source.providers.map((p, i) => (
                      <span key={p.providerId}>
                        {p.url ? (
                          <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color: "#0047b3" }}>
                            {p.providerId === "nasjonalbiblioteket" ? "Nasjonalbiblioteket" : p.providerId}
                          </a>
                        ) : (
                          p.providerId === "nasjonalbiblioteket" ? "Nasjonalbiblioteket" : p.providerId
                        )}
                        {i < source.providers.length - 1 ? ", " : ""}
                      </span>
                    ))}
                  </dd>
                </>
              )}
            </dl>
          </div>

          {source.access_url && (
            <div style={{ marginTop: "2rem" }}>
              <a 
                href={source.access_url} 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ display: "inline-block", background: "#0047b3", color: "white", padding: "0.75rem 1.5rem", borderRadius: "4px", textDecoration: "none", fontWeight: "bold" }}
              >
                {source.providers?.some(p => p.providerId === 'nasjonalbiblioteket') 
                  ? "Les hos Nasjonalbiblioteket →" 
                  : "Åpne originalkilden →"}
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
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: "1.5rem"
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

      {usages.length > 0 && (
        <section style={{ marginTop: "4rem" }}>
          <h2 style={{ fontSize: "1.8rem", marginBottom: "1.5rem", borderBottom: "2px solid #eee", paddingBottom: "0.5rem" }}>
            Dokumenterte kamper ({usages.length})
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {usages.map(m => (
              <MatchRow
                key={m.id}
                id={m.id}
                date={m.date}
                opponent={m.opponent}
                competition={m.competition}
                isHome={m.is_home === 1}
                aafkScore={m.aafk_score}
                opponentScore={m.opponent_score}
                note={m.note || (m.page ? `Side ${m.page}` : null)}
              />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
