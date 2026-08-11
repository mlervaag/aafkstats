"use client";

import { useRef, useState } from "react";
import { ContributionDialog, ContributionScope } from "./ContributionDialog";

interface Props {
  scope: ContributionScope;
  targetId: string;
  title: string;
  label?: string;
}

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
        {label || "Bidra om kampen"}
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
