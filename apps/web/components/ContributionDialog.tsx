"use client";

import { useEffect, useRef, useState } from "react";

export type ContributionScope = "match" | "season";

export interface ContributionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  scope: ContributionScope;
  targetId: string;
  title: string;
}

export function ContributionDialog({ isOpen, onClose, scope, targetId, title }: ContributionDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  
  const [kind, setKind] = useState("observation");
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
      // Reset state when closing successfully
      if (status === "success") {
        setTimeout(() => {
          setStatus("idle");
          setText("");
          setSource("");
          setContributor("");
          setKind("observation");
        }, 300);
      }
    }

    return () => { document.body.style.overflow = ""; };
  }, [isOpen, status]);

  /**
   * Ruten godtar bare http(s) i kildefeltet, eller ingenting.
   *
   * Uten kontrollen her får den som skriver «Sunnmørsposten 12.5.1998» et rundt
   * avslag fra tjeneren uten å få vite hvilket felt som er problemet. Feltet er
   * dessuten valgfritt, så avslaget kommer for noe brukeren ikke måtte fylle ut.
   */
  const sourceLooksWrong = source.trim() !== "" && !/^https?:\/\/\S+$/i.test(source.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    if (sourceLooksWrong) {
      setStatus("error");
      setErrorMsg(
        "Kildefeltet tar bare en lenke som starter med http:// eller https://. " +
          "Har du en kilde uten lenke — et programblad eller et avisutklipp — kan du " +
          "beskrive den i tekstfeltet over i stedet.",
      );
      return;
    }

    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/contributions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          targetId,
          kind,
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

  const isSeason = scope === "season";

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
          <h2 id="contribution-title">Bidra til arkivet</h2>
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
            <p className="small muted">
              Gjelder: <strong>{title}</strong>
            </p>

            {/* Fieldset og legend, ikke en løs label: en label uten `htmlFor` er
                ikke knyttet til noe, og en skjermleser leste derfor tre
                radioknapper uten å si hva de var et svar på. */}
            <fieldset className="form-group">
              <legend>Hva gjelder det?</legend>
              <div className="radio-group">
                <label className="radio-label">
                  <input type="radio" name="kind" value="observation" checked={kind === "observation"} onChange={(e) => setKind(e.target.value)} />
                  Del et minne eller observasjon
                </label>
                <label className="radio-label">
                  <input type="radio" name="kind" value="error" checked={kind === "error"} onChange={(e) => setKind(e.target.value)} />
                  {isSeason ? "Rett sesonginformasjon" : "Meld en feil i kampfakta"}
                </label>
                <label className="radio-label">
                  <input type="radio" name="kind" value="source" checked={kind === "source"} onChange={(e) => setKind(e.target.value)} />
                  {isSeason ? "Legg til manglende kamp eller kilde" : "Legg til fakta eller kilde"}
                </label>
              </div>
            </fieldset>

            <div className="form-group">
              <label htmlFor="text-field">
                {kind === "observation" ? "Hva husker eller vet du?" : "Hva vil du melde inn?"} <span className="req">*</span>
              </label>
              <textarea
                id="text-field"
                required
                rows={4}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={kind === "observation" ? "F.eks: «Dette var kampen der...»" : ""}
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
              />
              <p id="source-help" className="small muted form-help">
                Bare nettadresser. Har du en kilde uten lenke — et programblad, et
                avisutklipp — beskriv den i feltet over.
              </p>
            </div>

            <div className="form-group">
              <label htmlFor="name-field">Navn eller alias (valgfritt)</label>
              <input
                id="name-field"
                type="text"
                value={contributor}
                onChange={(e) => setContributor(e.target.value)}
                disabled={status === "loading"}
              />
            </div>

            {/* `role="alert"` fordi meldingen dukker opp etter at brukeren har
                trykket send. Uten den er avslaget usynlig for en skjermleser, og
                skjemaet ser ut til å ikke ha gjort noenting. */}
            {status === "error" && (
              <div className="notice notice-error" role="alert">{errorMsg}</div>
            )}

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
