import styles from "./NewspaperArticleBadge.module.css";

interface NewspaperArticleBadgeProps {
  count?: number;
  compact?: boolean;
  href?: string;
}

function label(count: number, compact: boolean): string {
  if (compact) return count > 1 ? `${count} avisartikler` : "Avisartikkel";
  return count > 1 ? `Sunnmørsposten · ${count} artikler` : "Artikkel i Sunnmørsposten";
}

export function NewspaperArticleBadge({ count = 1, compact = false, href }: NewspaperArticleBadgeProps) {
  const content = (
    <>
      <span className={styles.mark} aria-hidden="true" />
      {label(count, compact)}
    </>
  );
  const className = `${styles.badge}${compact ? ` ${styles.compact}` : ""}`;

  return href
    ? <a className={className} href={href}>{content}</a>
    : <span className={className}>{content}</span>;
}
