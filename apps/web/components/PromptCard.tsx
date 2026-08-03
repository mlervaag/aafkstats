"use client";

import { useState } from "react";

/**
 * En ferdig prompt med kopiknapp.
 *
 * Klientkomponent utelukkende for kopieringen. Selve teksten rendres på serveren
 * og står i markup-en, så den kan leses, merkes og kopieres for hånd også uten
 * JavaScript — knappen er en snarvei, ikke forutsetningen.
 */
export function PromptCard({
  title,
  purpose,
  prompt,
}: {
  title: string;
  purpose: string;
  prompt: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Utklippstavlen krever sikker kontekst og kan avslås. Teksten står synlig
      // uansett, så vi lar det være uten feilmelding.
    }
  }

  return (
    <section className="archive-card prompt-card">
      <div className="prompt-head">
        <div>
          <span className="card-kicker">{purpose}</span>
          <h3>{title}</h3>
        </div>
        <button type="button" className="button-link secondary prompt-copy" onClick={copy}>
          {copied ? "Kopiert" : "Kopier"}
        </button>
      </div>
      <pre className="prompt-text">{prompt}</pre>
    </section>
  );
}
