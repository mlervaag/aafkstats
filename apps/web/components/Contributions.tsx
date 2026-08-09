import type { ArchiveContribution } from "../lib/archive";

interface ContributionsProps {
  contributions: ArchiveContribution[];
}

export function Contributions({ contributions }: ContributionsProps) {
  if (contributions.length === 0) return null;

  return (
    <section className="contributions-section">
      <h2 className="section-title">Observasjoner og minner</h2>
      <div className="contributions-list">
        {contributions.map((c) => (
          <div key={c.id} className="contribution-card">
            <blockquote className="contribution-text">
              <p>{c.text}</p>
            </blockquote>
            <div className="contribution-meta">
              <span className="contribution-author">
                - {c.contributor || "Anonym bidragsyter"}
              </span>
              <span className="contribution-verification" data-status={c.verification}>
                {c.verification === "verified" && "Bekreftet kilde"}
                {c.verification === "corroborated" && "Bekreftet av andre kilder"}
                {c.verification === "unverified" && "Ubekreftet"}
              </span>
              {c.sourceUrl && (
                <a
                  href={c.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="contribution-source"
                >
                  (Se kilde)
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
