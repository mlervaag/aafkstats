import Link from "next/link";
import { SourceTypeBadge } from "./SourceTypeBadge";
import styles from "./SourceSeriesCard.module.css";

interface SourceSeriesCardProps {
  id: string;
  title: string;
  sourceType: string;
  minYear: number;
  maxYear: number;
  count: number;
}

export function SourceSeriesCard({ id, title, sourceType, minYear, maxYear, count }: SourceSeriesCardProps) {
  // Handle case where some sources don't have a year
  let metaText = `${count} utgaver`;
  if (minYear < 9999 && maxYear > 0) {
    if (minYear === maxYear) {
      metaText = `${minYear} · ${count} utgaver`;
    } else {
      metaText = `${minYear} til ${maxYear} · ${count} utgaver`;
    }
  }

  return (
    <Link href={`/kilder/${id}`} className={styles.card}>
      <div className={styles.inner}>
        <div className={styles.content}>
          <SourceTypeBadge type={sourceType} />
          <h3 className={styles.title}>{title}</h3>
          <div className={styles.meta}>
            {metaText}
          </div>
        </div>
        <div className={styles.linkText}>
          Se alle &rarr;
        </div>
      </div>
    </Link>
  );
}
