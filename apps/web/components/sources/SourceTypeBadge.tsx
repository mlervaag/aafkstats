export const SOURCE_TYPE_LABELS: Record<string, string> = {
  book: "Bok",
  anniversary_book: "Jubileumsskrift",
  member_magazine: "Medlemsblad",
  annual_report: "Årsberetning",
  match_program: "Kampprogram",
  supporter_publication: "Supporterpublikasjon",
  local_history_book: "Lokalhistorisk bok",
  newspaper_supplement: "Avisbilag",
  series: "Serie",
  other: "Annet"
};

export function SourceTypeBadge({ type, year }: { type: string, year?: number | null }) {
  const label = SOURCE_TYPE_LABELS[type] || type;
  return (
    <div style={{ textTransform: "uppercase", fontSize: "0.8rem", letterSpacing: "1px", color: "#666", marginBottom: "0.25rem" }}>
      {label}{year ? ` · ${year}` : ""}
    </div>
  );
}
