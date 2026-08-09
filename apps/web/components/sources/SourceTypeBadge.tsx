import styles from "./SourceTypeBadge.module.css";

export const SOURCE_TYPES: Record<string, { singular: string; plural: string }> = {
  book: { singular: "Bok", plural: "Bøker" },
  anniversary_book: { singular: "Jubileumsskrift", plural: "Jubileumsskrift" },
  member_magazine: { singular: "Medlemsblad", plural: "Medlemsblad" },
  annual_report: { singular: "Årsberetning", plural: "Årsberetninger" },
  match_program: { singular: "Kampprogram", plural: "Kampprogram" },
  supporter_publication: { singular: "Supporterpublikasjon", plural: "Supporterpublikasjoner" },
  local_history_book: { singular: "Lokalhistorisk bok", plural: "Lokalhistoriske bøker" },
  newspaper_supplement: { singular: "Avisbilag", plural: "Avisbilag" },
  series: { singular: "Serie", plural: "Serier" },
  other: { singular: "Annet", plural: "Annet" }
};

export const SOURCE_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(SOURCE_TYPES).map(([key, value]) => [key, value.singular])
);

export function SourceTypeBadge({ type, year }: { type: string, year?: number | null }) {
  const label = SOURCE_TYPE_LABELS[type] || type;
  return (
    <div className={styles.badge}>
      {label}{year ? ` · ${year}` : ""}
    </div>
  );
}
