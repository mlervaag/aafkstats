import styles from "./SourceCover.module.css";

interface SourceCoverProps {
  title: string;
  coverUrl?: string | null;
}

export function SourceCover({ title, coverUrl }: SourceCoverProps) {
  if (coverUrl) {
    return (
      <div className={styles.cover}>
        <img 
          src={`/api/nb-image?url=${encodeURIComponent(coverUrl)}`} 
          alt={`Forside for ${title}`}
          className={styles.image}
        />
      </div>
    );
  }

  return (
    <div className={styles.cover}>
      <div className={styles.placeholder}>
        <div className={styles.placeholderTitle}>{title}</div>
        <div className={styles.placeholderBrand}>AaFK Kildebakgrunn</div>
      </div>
    </div>
  );
}
