import Link from "next/link";
import { SourceTypeBadge } from "./SourceTypeBadge";

interface SourceSeriesCardProps {
  id: string;
  title: string;
  sourceType: string;
  minYear: number;
  maxYear: number;
  count: number;
}

export function SourceSeriesCard({ id, title, sourceType, minYear, maxYear, count }: SourceSeriesCardProps) {
  return (
    <Link href={`/kilder/${id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        background: "#fff",
        padding: "1rem 1.5rem",
        borderRadius: "8px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        marginTop: "1rem",
        transition: "transform 0.2s ease, box-shadow 0.2s ease"
      }} className="series-card-inner">
        <div style={{ flex: 1 }}>
          <SourceTypeBadge type={sourceType} />
          <h3 style={{ fontSize: "1.2rem", margin: "0 0 0.25rem 0" }}>{title}</h3>
          <div style={{ fontSize: "0.9rem", color: "#666" }}>
            {minYear} til {maxYear} · {count} utgaver
          </div>
        </div>
        <div style={{ fontWeight: "bold", color: "#0047b3" }}>
          Se alle →
        </div>
      </div>
      <style>{`
        .series-card-inner:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        }
      `}</style>
    </Link>
  );
}
