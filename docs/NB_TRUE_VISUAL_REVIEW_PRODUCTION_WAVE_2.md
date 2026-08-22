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
| **1945–1954 (Krets- og lokalavis)** | 62 | **62** | 25 singletons, 12 sibling-grupper (37 claims) = 37 enheter |
| **1955–1964 (Medlemsblad-ekspansjon)** | 105 | **105** | 17 singletons, 32 sibling-grupper (88 claims) = 49 enheter |
| **1965–1974 (Moderne regional dekning)** | 16 | **16** | 3 singletons, 1 sibling-gruppe (13 claims) = 4 enheter |
| **1975–1984 (Ferdigstilt i PR #199)** | 0 | **0** | 0 |
| **Totalt** | **183** | **183** | **45 singletons, 45 sibling-grupper (90 review-enheter, 183 claims)** |

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
4. **Skille mellom Pilot og Wave 2:**
   Pilot-saker beholder `reviewStatus: visually_reviewed_pilot` (60 saker), mens Wave 2-saker får `reviewStatus: visually_reviewed_wave_2` (62 saker for 1945–1954).
5. **Universell kollisjonsport og flerkamp-sider:**
   - **Observerte hendelser:** Samme observerte kamp (`season + opponentClubId + matchDate`) kan aldri eies av to konkurrerende krav.
   - **Fysiske avissider:** Samme fysiske avisside (`itemId + viewerPage`) tillates dersom den dokumenterer distinkte kamper med separate hendelsesnøkler (f.eks. Sunnmørsposten 1945-09-24 s. 2), men kollisjoner på samme hendelse blokkeres strengt.
6. **Uavhengig Second-Pass Audit:**
   Auditregnskapet beregnes direkte fra `secondPassAudit.cases` og oppfyller matematiske invarianter:
   $$\text{agreed} + \text{disagreed} = \text{sampleSize}$$
   $$\text{agreementRate} = \frac{\text{agreed}}{\text{sampleSize}}$$
7. **Eksakte Regnskapsinvarianter:**
   $$\text{Pilot (60)} + \text{Wave 2 1945–1954 (62)} + \text{Gjenværende i kø (514)} = \text{Total (636)}$$

---

## 4. Gjennomføring: Wave 2 (1945–1954)

Den første produksjonsetappen av Wave 2 omfatter samtlige 62 hypoteser i perioden 1945–1954. Alle 62 er visuelt inspisert mot faktiske avissider i Nasjonalbibliotekets nettbibliotek (Sunnmørsposten m.fl.).

### Resultatfordeling for 1945–1954 (62 hypoteser)

| Disposisjon / Kategori | Antall | Beskrivelse |
| :--- | :--- | :--- |
| **Kanonisk klar (`ready`)** | **36** | Entydig bekreftet A-lagskamp med dokumentert dato, motstander, resultat og turnering. |
| **Utilstrekkelig belegg (`insufficient` / `sibling_group_only`)** | **22** | Sibling-krav eller forhåndsomtaler uten entydig A-lagsreferat for spesifikt resultat. |
| **Score-konflikt (`score_conflict`)** | **1** | Veblungsnes 1946 (kilde oppga 3–2, avisen dokumenterer at Veblungsnes vant 3–2 / 2–3 for AaFK). |
| **Ikke-senior (`non_senior`)** | **1** | KFK 1946 2–1 (dokumentert som forkamp for juniorlag). |
| **Uavklart motstander (`opponent_uncertain`)** | **2** | Valdemarsvik 1947 (utenlandsk lag) og Snøgg 1948 (ikke i kanonisk klubbregister). |
| **Totalt** | **62** | **100 % av utvalget for 1945–1954 ferdig behandlet.** |

### Competition Mapping-Audit
Alle 62 saker er kontrollert mot `data/competitions/` og faksimiletekst:
- **`sondmore-kreds-klasse-a` (3 saker):** 1945 Spjelkavik (6–1), Hødd (1–2), Volda (3–1). Faksimilene dokumenterer eksplisitt "Kretskamp i A-klassen".
- **`nm` (2 saker):** 1945 Træff (3–1, NM 1. runde), 1947 Clausenengen (1–3, NM 1. runde).
- **`forstedivisjon` (13 saker):** 1. divisjon / kvalifisering Norgesserien (1946: Rollon, Aksla, Clausenengen; 1947: Clausenengen [2], Molde, KFK; 1948: Rollon [2], Molde [2], KFK [2]).
- **`treningskamp` (18 saker):** Privatkamper, jubileumskamper og pokalkamper.

### Second-Pass Audit
Uavhengig second-pass audit er strukturert i tre nivåer:
- **Pilot (1945–1984):** 30 saker (29 agreed, 1 disagreed med fullført dato-adjudication)
- **Wave 2 (1945–1954):** 62 saker (62 agreed, 0 disagreed)
- **Kumulativt:** 92 saker (91 agreed, 1 disagreed, agreementRate: 0.9891)

---

## 5. Status og Neste Steg

* **Beslutningsport:** `decisionGate: VISUAL_REVIEW_IN_PROGRESS`
* **Delstatus:** `wave2Progress["1945-1954"]: complete`, `1955-1964: pending`, `1965-1974: pending`
* **Manifestoversikt:**
  - Totalt antall hypoteser: 636
  - Pilot gjennomgått (`visually_reviewed_pilot`): 60
  - Wave 2 gjennomgått (`visually_reviewed_wave_2`): 62
  - Gjenstående ubehandlet i kø (`unreviewed_awaiting_visual_batch`): 514
  - Totalt godkjent for fremtidig kanonisering (`ready`): 61 (25 pilot + 36 wave 2)
* **Kanonisering:** PR #200-kanoniseringsbaseline forblir intakt (25 pilot ready inn, 24 kanonisert, 0 nye writes på clean rerun). Ingen mutasjoner i arkivdata skjer i denne review-PR-en.
