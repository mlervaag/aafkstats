"use client";

import { useEffect, useRef, useState } from "react";
import { contributionIssueUrl, pageReference } from "@/lib/contribution-links";

export type ContributionScope = "match" | "season" | "person";

export interface ContributionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  scope: ContributionScope;
  targetId: string;
  title: string;
}

export function ContributionDialog({ isOpen, onClose, scope, targetId, title }: ContributionDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [text, setText] = useState("");
  const [source, setSource] = useState("");
  const [contributor, setContributor] = useState("");
  
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) dialog.showModal();
      document.body.style.overflow = "hidden";
    } else {
      if (dialog.open) dialog.close();
      document.body.style.overflow = "";
    }

    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/contributions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          targetId,
          pageUrl: window.location.pathname,
          text,
          source,
          contributor,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Noe gikk galt under innsending. Prøv igjen.");
      }

      setStatus("success");
    } catch (err: unknown) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  /**
   * Adressen til siden dialogen står på.
   *
   * Bygges av scope og targetId framfor å leses fra `window`, slik at lenkene er
   * de samme i markup-en som etter hydrering — og slik at de finnes i det hele
   * tatt hvis dialogen en dag rendres på serveren.
   */
  const path = scope === "match" ? `/kamp/${targetId}`
    : scope === "season" ? `/sesong/${targetId}`
    : `/personer/${targetId}`;
  const here = pageReference(title, path);

  /**
   * Veiene videre for den som vil rette fakta i stedet for å dele et minne.
   *
   * Hver av dem åpner malen med det vi allerede vet fylt inn: hvilken side det
   * gjelder, og adressen dit. Bidragsyteren står på kampsiden i det hun trykker,
   * og skal ikke måtte skrive av hvilken kamp hun akkurat så på.
   *
   * Lista er ikke den samme for alle tre. En kamp som finnes, mangler ikke — den
   * skal ikke tilby «meld en kamp som mangler». En person som har en side,
   * mangler heller ikke, men kan ha feil verv eller mangle en kilde til det.
   */
  const otherRoutes = scope === "season"
    ? [
        { label: "Meld en kamp som mangler", href: contributionIssueUrl("manglende-kamp", title, { annet: `Gjelder ${title}.` }) },
        { label: "Meld en feil", href: contributionIssueUrl("datafeil", title, { sted: here }) },
        { label: "Legg til kampdetaljer", href: contributionIssueUrl("ny-kilde", title, { kamp: here }) },
      ]
    : scope === "match" ? [
        { label: "Meld en feil", href: contributionIssueUrl("datafeil", title, { sted: here }) },
        { label: "Legg til kampdetaljer", href: contributionIssueUrl("ny-kilde", title, { kamp: here }) },
      ]
    : [
        { label: "Meld en feil", href: contributionIssueUrl("datafeil", title, { sted: here }) },
        { label: "Tips om en kilde", href: contributionIssueUrl("ny-arkivkilde", title, { hva: `Gjelder ${title}, ${path}` }) },
      ];

  const isPerson = scope === "person";

  return (
    <dialog 
      ref={dialogRef} 
      className="contribution-dialog"
      aria-labelledby="contribution-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className="contribution-content">
        <div className="contribution-header">
          <h2 id="contribution-title">{isPerson ? "Bidra om en person" : "Del et minne"}</h2>
          <button type="button" className="close-button" onClick={onClose} aria-label="Lukk">×</button>
        </div>

        {status === "success" ? (
          <div className="contribution-success">
            <h3>Takk for bidraget!</h3>
            <p>
              Innspillet ditt er sendt inn og ligger nå til redaksjonell gjennomgang.
              Arkivet drives av frivillige, så det kan ta litt tid før det blir synlig.
            </p>
            <button type="button" className="action-button" onClick={onClose}>Lukk</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="contribution-form">
            <div className="contribution-form-body">
            <p className="small muted">
              Gjelder: <strong>{title}</strong>
            </p>

            <p className="contribution-explainer">
              {isPerson
                ? "Del et minne eller en observasjon om personens tilknytning til AaFK. Du trenger ikke kilde eller GitHub-konto."
                : "Skriv det du husker. Du trenger ikke kilde eller GitHub-konto."}
            </p>

            <nav className="contribution-route-links" aria-label="Andre typer bidrag">
              <strong>Vil du rette eller legge til fakta?</strong>
              <div>
                {otherRoutes.map((route) => (
                  <a key={route.label} href={route.href}>{route.label}</a>
                ))}
              </div>
              <span className="small muted">Disse åpner et kort GitHub-skjema og krever konto.</span>
            </nav>

            <div className="form-group">
              <label htmlFor="text-field">
                Hva vil du fortelle? <span className="req">*</span>
              </label>
              <textarea
                id="text-field"
                required
                rows={4}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={isPerson
                  ? "For eksempel: «Han var lagleder for juniorlaget dette året …»"
                  : "For eksempel: «Dette var kampen der …»"}
                maxLength={2000}
                disabled={status === "loading"}
              />
            </div>

            <div className="form-group">
              <label htmlFor="source-field">Lenke til kilde (valgfritt)</label>
              <input
                id="source-field"
                type="url"
                inputMode="url"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="https://..."
                aria-describedby="source-help"
                disabled={status === "loading"}
                maxLength={300}
              />
              <p id="source-help" className="small muted form-help">
                Bare nettadresser. Har du en kilde uten lenke, for eksempel et programblad
                eller et avisutklipp, kan du beskrive den i feltet over.
              </p>
            </div>

            {isPerson ? (
              <p className="small muted form-help">
                Ikke send private kontaktopplysninger eller sensitive personopplysninger.
                Hold innspillet til personens rolle, arbeid eller historie i AaFK.
              </p>
            ) : null}

            <div className="form-group">
              <label htmlFor="name-field">Navn eller alias (valgfritt)</label>
              <input
                id="name-field"
                type="text"
                value={contributor}
                onChange={(e) => setContributor(e.target.value)}
                disabled={status === "loading"}
                maxLength={100}
              />
            </div>

            {/* `role="alert"` fordi meldingen dukker opp etter at brukeren har
                trykket send. Uten den er avslaget usynlig for en skjermleser, og
                skjemaet ser ut til å ikke ha gjort noenting. */}
            {status === "error" && (
              <div className="notice notice-error" role="alert">{errorMsg}</div>
            )}

            </div>

            <div className="form-actions">
              <button type="submit" className="action-button" disabled={status === "loading" || !text.trim()}>
                {status === "loading" ? "Sender..." : "Send inn"}
              </button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
