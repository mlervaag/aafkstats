import { contributionIssueUrl } from "@/lib/contribution-links";

/**
 * Veien inn til kildearkivet, fra oversikten og fra den enkelte kilden.
 *
 * `sourceId` finnes bare på detaljsiden, og er det som gjør at skjemaet kan
 * åpne seg med kilden allerede utfylt. Uten den er dette en generell oppfordring
 * fra oversikten, og da er det ingenting å fylle ut.
 */
export function ContributionCallToAction({ sourceTitle, sourceId }: { sourceTitle?: string; sourceId?: string }) {
  return (
    <section className="source-tip">
      <h2>{sourceTitle ? "Vet du mer om denne kilden?" : "Mangler vi en kilde?"}</h2>
      <p>
        {sourceTitle
          ? "Meld fra hvis opplysningene er feil, eller hvis du vet hvor kilden kan leses."
          : "Tips oss om en bok, et medlemsblad, et jubileumsskrift eller annet AaFK-materiale."}
      </p>
      <a
        className="button-link"
        href={contributionIssueUrl("ny-arkivkilde", sourceTitle, sourceTitle
          ? { kilde: sourceId ? `${sourceTitle} — /kilder/${sourceId}` : sourceTitle }
          : undefined)}
      >
        {sourceTitle ? "Rett eller suppler kilden" : "Tips om en kilde"}
      </a>
      {!sourceTitle && (
        <p className="small muted">
          Gjelder det én kamp, bruk «Bidra om kampen» på kampsiden. Da følger kampen med.
        </p>
      )}
    </section>
  );
}
