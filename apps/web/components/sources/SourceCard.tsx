import Link from "next/link";
import { SourceTypeBadge } from "./SourceTypeBadge";
import { SourceCover } from "./SourceCover";
import styles from "./SourceCard.module.css";

interface SourceCardProps {
  id: string;
  title: string;
  sourceType: string;
  year?: number | null;
  publisher?: string | null;
  coverUrl?: string | null;
  titleAs?: "h3" | "h4";
}

export function SourceCard({ id, title, sourceType, year, publisher, coverUrl, titleAs = "h3" }: SourceCardProps) {
  const Title = titleAs;

  return (
    <Link href={`/kilder/${id}`} className={styles.card}>
      <div className={styles.media}>
        {coverUrl ? (
          <SourceCover title={title} coverUrl={coverUrl} />
        ) : (
          <div className={styles.documentFallback} aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="M6.75 3.75h7.5l3 3v13.5H6.75z" />
              <path d="M14.25 3.75v3h3M9.25 11h5.5M9.25 14h5.5M9.25 17h3.5" />
            </svg>
            <span>Kilde</span>
          </div>
        )}
      </div>
      <div className={styles.info}>
        <SourceTypeBadge type={sourceType} year={year} />
        <Title className={styles.title}>{title}</Title>
        {publisher && <div className={styles.publisher}>{publisher}</div>}
      </div>
      <span className={styles.arrow} aria-hidden="true">→</span>
    </Link>
  );
}
