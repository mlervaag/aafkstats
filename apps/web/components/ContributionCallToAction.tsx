"use client";
import { useState } from "react";
import { ContributionDialog } from "./ContributionDialog";

export function ContributionCallToAction() {
  const [showContribution, setShowContribution] = useState(false);

  return (
    <div style={{ marginTop: "4rem", padding: "2rem", backgroundColor: "#f8f9fa", borderRadius: "8px", textAlign: "center" }}>
      <h3 style={{ fontSize: "1.3rem", marginBottom: "0.5rem" }}>Mangler vi noe?</h3>
      <p style={{ color: "#555", marginBottom: "1.5rem" }}>Tips oss om en bok, et blad eller annet AaFK-materiale du mener burde vært i arkivet.</p>
      <button 
        onClick={() => setShowContribution(true)}
        style={{ background: "#0047b3", color: "white", padding: "0.75rem 1.5rem", border: "none", borderRadius: "4px", fontSize: "1rem", cursor: "pointer", fontWeight: "bold" }}
      >
        Tips oss om en kilde
      </button>

      {showContribution && (
        <ContributionDialog 
          isOpen={showContribution}
          title="Foreslå en kilde"
          scope="season"
          targetId={new Date().getFullYear().toString()}
          onClose={() => setShowContribution(false)}
        />
      )}
    </div>
  );
}
