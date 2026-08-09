import { contributionIssueUrl } from "@/lib/contribution-links";

export function ContributionCallToAction({ sourceTitle }: { sourceTitle?: string }) {
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
        href={contributionIssueUrl("ny-arkivkilde", sourceTitle)}
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
