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
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className="contribution-content">
        <div className="contribution-header">
          <h2>Bidra til arkivet</h2>
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

            <div className="form-group">
              <label>Hva gjelder det?</label>
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
            </div>

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
              <label htmlFor="source-field">Kilde eller lenke (valgfritt)</label>
              <input
                id="source-field"
                type="text"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="Avisartikkel, programblad e.l."
                disabled={status === "loading"}
              />
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

            {status === "error" && (
              <div className="notice notice-error">{errorMsg}</div>
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
