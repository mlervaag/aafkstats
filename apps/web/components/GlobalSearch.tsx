"use client";

import { useEffect, useRef, useState } from "react";
import { DirectResults, openFirstDirectResult, useDirectSearch } from "@/components/DirectSearch";

export function GlobalSearch() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const { data, state, show } = useDirectSearch(query);

  function open() {
    if (dialogRef.current?.open) return;
    dialogRef.current?.showModal();
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  /**
   * «/» og Ctrl/⌘+K åpner søket fra hvor som helst på siden, slik de gjør på de
   * fleste nettsteder med søk. «/» ignoreres mens noen skriver i et felt — ellers
   * ville en skråstrek i spørsmålsboksen eller bidragsskjemaet stjålet fokus.
   */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing) return;
      const shortcut = (event.key === "k" || event.key === "K") && (event.metaKey || event.ctrlKey);
      const slash = event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey && !isEditable(event.target);
      if (!shortcut && !slash) return;
      event.preventDefault();
      open();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function close() {
    dialogRef.current?.close();
    setQuery("");
  }

  function openFirstResult() {
    openFirstDirectResult(data);
  }

  return (
    <div className="global-search">
      <button className="header-control" type="button" onClick={open} aria-keyshortcuts="/ Control+K Meta+K">
        Søk
      </button>
      <dialog
        ref={dialogRef}
        className="search-dialog"
        aria-labelledby="global-search-title"
        onClose={() => setQuery("")}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <div className="search-dialog-inner">
          <div className="search-dialog-head">
            <div>
              <p className="eyebrow">Direktesøk uten AI</p>
              <h2 id="global-search-title">Søk i hele arkivet</h2>
            </div>
            <button className="search-dialog-close" type="button" onClick={close} aria-label="Lukk søket">×</button>
          </div>
          <p className="small muted">
            Finn personer, historiske kilder og kamper. Treff vises mens du skriver.
          </p>
          <form onSubmit={(event) => {
            event.preventDefault();
            openFirstResult();
          }}>
            <label className="sr-only" htmlFor="global-search-input">Søk i arkivet</label>
            <input
              ref={inputRef}
              id="global-search-input"
              className="ask-input"
              type="search"
              value={query}
              maxLength={100}
              placeholder="Navn, kilde, motstander eller år …"
              aria-controls="global-search-results"
              autoComplete="off"
              enterKeyHint="go"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  openFirstResult();
                }
              }}
            />
          </form>
          {show ? (
            <DirectResults
              id="global-search-results"
              data={data}
              state={state}
              maxMatches={10}
              emptyText="Ingen direkte treff. Prøv et navn, en motstander, en kildetittel eller et år."
            />
          ) : (
            <p className="search-dialog-hint small muted">Skriv minst to tegn.</p>
          )}
        </div>
      </dialog>
    </div>
  );
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}
