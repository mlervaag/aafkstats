"use client";

import { useRef, useState } from "react";
import { ContributionDialog, ContributionScope } from "./ContributionDialog";

interface Props {
  scope: ContributionScope;
  targetId: string;
  title: string;
  label?: string;
}

/** Etiketten når kallstedet ikke oppgir en. Sto som «Bidra om kampen» for alle tre. */
const DEFAULT_LABEL: Record<ContributionScope, string> = {
  match: "Bidra om kampen",
  season: "Bidra om sesongen",
  person: "Bidra om personen",
};

export function ContributionButton({ scope, targetId, title, label }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const closeDialog = () => {
    setIsOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  return (
    <>
      <button 
        ref={triggerRef}
        type="button" 
        className="contribution-trigger"
        onClick={() => setIsOpen(true)}
      >
        {label ?? DEFAULT_LABEL[scope]}
      </button>

      {isOpen && (
        <ContributionDialog
          isOpen={isOpen}
          onClose={closeDialog}
          scope={scope}
          targetId={targetId}
          title={title}
        />
      )}
    </>
  );
}
