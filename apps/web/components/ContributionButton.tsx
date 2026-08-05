"use client";

import { useState } from "react";
import { ContributionDialog, ContributionScope } from "./ContributionDialog";

interface Props {
  scope: ContributionScope;
  targetId: string;
  title: string;
  label?: string;
}

export function ContributionButton({ scope, targetId, title, label }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button 
        type="button" 
        className="contribution-trigger"
        onClick={() => setIsOpen(true)}
      >
        {label || "Bidra om kampen"}
      </button>

      {isOpen && (
        <ContributionDialog
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          scope={scope}
          targetId={targetId}
          title={title}
        />
      )}
    </>
  );
}
