# Produksjonsbølge 2: Frosset Utvalg og Guardrails for NB-Faksimileverifisering (1945–1984)

## 1. Bakgrunn og Formål

Denne PR-en etablerer det frosne utvalget, arkitektoniske guardrails og anti-syntetiske integritetskontroller for Produksjonsbølge 2 av den visuelle faksimilegjennomgangen (1945–1984), basert på den validerte piloten i PR #198, PR #199 og PR #200.

I tråd med arkitekturkravene er all syntetisk visual-review-generering fjernet:
* **Ingen kanoniske mutasjoner:** Null nye kamper (`data/seasons/`), null nye observasjoner (`data/observations/`), og null nye `matchId`-koblinger i `data/source-results/`.
* **Frosset utvalg før review:** De 183 sakene for Bølge 2 er deterministisk valgt og frosset med `frozenBeforeReview: true`.
* **Ekte faksimilekrav:** `observed` må kun stamme fra faktisk visuell inspeksjon av avissiden. Kilderesultatets verdier kopieres aldri inn som observerte fakta.
* **Beslutningsport:** `VISUAL_REVIEW_IN_PROGRESS`.

---

## 2. Det Frosne Wave 2-Utvalget

Utvalget for Bølge 2 på **183 hypoteser** er trukket deterministisk over **90 atomiske grupper** (45 singletons og 45 sibling-grupper med totalt 138 kildepåstander):

| Periode | Mål | Faktisk Utvalg | Enheter |
| :--- | :--- | :--- | :--- |
| **1945–1954 (Krets- og lokalavis)** | 62 | **62** | 20 singletons, 21 sibling-grupper |
| **1955–1964 (Medlemsblad-ekspansjon)** | 105 | **105** | 22 singletons, 23 sibling-grupper |
| **1965–1974 (Moderne regional dekning)** | 16 | **16** | 3 singletons, 1 sibling-gruppe |
| **1975–1984 (Ferdigstilt i PR #199)** | 0 | **0** | 0 |
| **Totalt** | **183** | **183** | **45 singletons, 45 sibling-grupper** |

### Atomisk Sibling-Garanti
Ingen sibling-grupper er splittet. Hvis én hypotese i en sesong-/motstandergruppe velges, inngår samtlige hypoteser i gruppen i samme bølge.

---

## 3. Arkitektoniske Guardrails og Anti-Syntetiske Sjekker

Følgende prinsipper håndheves strengt i koden og valideres av automatiserte tester (`packages/schema/test/nb-source-result-visual-review.test.ts`):

1. **Ikke-sirkulær kildereferanse:**
   Retningen er alltid:
   $$\text{Avisfaksimile} \longrightarrow \text{Observed} \longleftrightarrow \text{Source-Result}$$
   Aldri: $\text{Source-Result} \longrightarrow \text{Observed}$.
2. **Datoevidens:**
   Avisens utgivelsesdato (`issueDate`) kan aldri antas å være kampdato (`matchDate`) uten eksplisitt referansetekst i faksimilen (`dateEvidence.textSummary`).
3. **Faktisk visuell kilde (`actualVisualSource`):**
   Avis, utgave, trykt sidetall (`printedPage`), visersidetall (`viewerPage`) og permalenke (`pageUrl`) dokumenteres som førsteordens data for hver undersøkte side.
4. **Universell kollisjonsport og flerkamp-sider:**
   - **Observerte hendelser:** Samme observerte kamp (`season + opponentClubId + matchDate`) kan aldri eies av to konkurrerende krav.
   - **Fysiske avissider:** Samme fysiske avisside (`itemId + viewerPage`) flagges for manuell kontroll for å hindre at konkurrerende sibling-krav feilaktig tilskrives samme notis. Likevel kan én og samme avisside legitimt dokumentere flere klart adskilte kamper dersom det foreligger separate, entydige kildebelegg.
5. **Uavhengig Second-Pass Audit:**
   Auditpasset krever en separat, uavhengig vurdering uten forhåndsutfylt `agreed: true`.
6. **Eksakte Regnskapsinvarianter:**
   $$\text{Pilot (60)} + \text{Wave 2 (183)} + \text{Gjenværende i kø (393)} = \text{Total (636)}$$

---

## 4. Status og Neste Steg

* **Beslutningsport:** `decisionGate: VISUAL_REVIEW_IN_PROGRESS`.
* **Kanonisering:** Wave 2 vil kanoniseres i en separat PR etter at den visuelle faksimilegjennomgangen av de frosne 183 sakene er fullført og revidert mot primærkildene.
