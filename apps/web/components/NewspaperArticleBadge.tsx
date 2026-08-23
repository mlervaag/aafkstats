import styles from "./NewspaperArticleBadge.module.css";

interface NewspaperArticleBadgeProps {
  count?: number;
  compact?: boolean;
  href?: string;
  /** Avisa, når alle faksimilene på kampen kommer fra den samme. */
  publisher?: string | null;
}

/**
 * Avisnavnet sto skrevet inn i merkelappen. Arkivet har faksimiler fra
 * Søndmørsposten også, og skal få flere aviser, så navnet må komme fra kampen.
 * Uten et entydig navn sier merkelappen bare hva det er.
 */
function label(count: number, compact: boolean, publisher: string | null | undefined): string {
  if (compact) return count > 1 ? `${count} avisartikler` : "Avisartikkel";
  if (!publisher) return count > 1 ? `Avisartikler · ${count}` : "Avisartikkel om kampen";
  return count > 1 ? `${publisher} · ${count} artikler` : `Artikkel i ${publisher}`;
}

export function NewspaperArticleBadge({ count = 1, compact = false, href, publisher }: NewspaperArticleBadgeProps) {
  const content = (
    <>
      <span className={styles.mark} aria-hidden="true" />
      {label(count, compact, publisher)}
    </>
  );
  const className = `${styles.badge}${compact ? ` ${styles.compact}` : ""}`;

  return href
    ? <a className={className} href={href}>{content}</a>
    : <span className={className}>{content}</span>;
}
