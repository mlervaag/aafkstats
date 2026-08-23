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

/**
 * «Annet» er ikke en opplysning.
 *
 * 274 av 455 kilder har typen `other` — avissider, nettsaker og enkeltdokumenter
 * som ikke er bøker eller blad. Merkelappen «ANNET» sto da på flertallet av
 * kortene i arkivet uten å skille noen av dem fra hverandre. Årstallet gjør det,
 * og står allerede i den samme merkelappen. Har kilden heller ikke årstall, er
 * typenavnet det eneste vi har igjen å si.
 */
export function SourceTypeBadge({ type, year }: { type: string, year?: number | null }) {
  const label = SOURCE_TYPE_LABELS[type] || type;
  const showLabel = type !== "other" || !year;
  return (
    <div className={styles.badge}>
      {showLabel ? label : ""}{showLabel && year ? " · " : ""}{year ?? ""}
    </div>
  );
}
