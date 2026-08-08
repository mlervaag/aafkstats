import Link from "next/link";
import { SourceTypeBadge } from "./SourceTypeBadge";
import styles from "./SourceCard.module.css";

interface SourceCardProps {
  id: string;
  title: string;
  sourceType: string;
  year?: number | null;
  publisher?: string | null;
  coverUrl?: string | null;
}

export function SourceCard({ id, title, sourceType, year, publisher, coverUrl }: SourceCardProps) {
  return (
    <Link href={`/kilder/${id}`} className={styles.card}>
      {coverUrl ? (
        <div className={styles.coverWrapper}>
          <img 
            src={`/api/nb-image?url=${encodeURIComponent(coverUrl)}`} 
            alt={`Forside for ${title}`} 
            className={styles.coverImage} 
          />
        </div>
      ) : (
        <div className={styles.placeholderCover}>
          <span className={styles.placeholderText}>{title}</span>
        </div>
      )}
      <div className={styles.info}>
        <SourceTypeBadge type={sourceType} year={year} />
        <h3 className={styles.title}>{title}</h3>
        {publisher && <div className={styles.publisher}>Utgiver: {publisher}</div>}
      </div>
    </Link>
  );
}
