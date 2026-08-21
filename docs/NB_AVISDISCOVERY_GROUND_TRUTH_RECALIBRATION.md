# Rekalibrering mot faksimile-ground-truth

Denne rapporten beskriver rekalibreringen av NB-avisdiscovery etter den visuelle
faksimilekontrollen i PR #186. Endringen høster ikke kamper og skriver ikke
kanoniske data.

Tre begreper må holdes fra hverandre:

- **Pipeline-status** er discovery-algoritmens klassifisering.
- **Faksimile-ground-truth** er det en menneskelig kontroll av avissiden faktisk
  dokumenterer.
- **Kanonisering** er en separat redaksjonell handling. Denne endringen utfører
  ingen kanonisering.

## Ground truth og feilklasser

PR #186 ga seks kontrollerte Batch 01-saker. Aksla 1948 #2 og Langevåg 1948 #13
var falske `confirmed`: navn og score ble hentet fra forskjellige kampnotiser.
Herd 1949 #2 viste en annen feil: datoen for en kommende eller utsatt kamp ble
overført til et retrospektivt 4–2-resultat fra første møte. Ranheim var en ekte
kamp, men ukedagsutledningen valgte søndag 16. juni i stedet for lørdag 15. juni.

Rettelsen består av tre konservative grep:

1. Score krever en lokal binding mellom AaFK, motstanderen og sifrene. Eksplisitte
   oppsettlinjer prioriteres; flere uavklarte oppgjør gir ukjent score.
2. Temporal evidence utledes fra den lokale lagparpåstanden. Et resultat kan
   bare kompletteres av et annet lagpar-vindu på samme side, og aldri når
   resultatet er retrospektivt.
3. Ved flere ukedager brukes den første tekstlige ukedagsreferansen. Dermed gir
   «lørdag» i mandagsutgaven 17. juni 1946 datoen 15. juni, uten hardkoding.

Testene bruker korte, syntetiske og strukturelt representative fragmenter.
Avis-OCR og fulltekst er ikke lagt inn i repoet.

## Seks-saks acceptance

Reevalueringen bruker eksplisitte `sourceId` + år + nummer og er ikke avhengig av
at raden fortsatt er `unlinked`.

| Sak | Tidligere status | Tidligere dato | Ny status | Ny dato | Faksimile-ground-truth | Resultat |
|---|---|---|---|---|---|---|
| Ranheim 1946 #15 | `confirmed` | 1946-06-16 | `ambiguous` | 1946-06-15 (low) | Kamp 15. juni, 2–2 | PASS |
| Aksla 1948 #2 | `confirmed` | 1948-09-12 | `ambiguous` | — | Ingen dokumentert AaFK–Aksla 4–0 | PASS |
| Langevåg 1948 #13 | `confirmed` | 1948-05-15 | `ambiguous` | 1948-06-27 (representativt, ikke bekreftet) | Ingen dokumentert AaFK–Langevåg 2–5 | PASS |
| Nordlandet 1948 #15 | `confirmed` | 1948-05-06 | `confirmed` | 1948-05-06 | Nordlandet 1, AaFK 6 | PASS |
| Herd 1949 #2 | `confirmed` | 1949-06-12 | `ambiguous` | — | 4–2 nevnes retrospektivt uten sikker dato | PASS |
| Øvre Telemark 1949 #5 | `confirmed` | 1949-07-10 | `confirmed` | 1949-07-10 | AaFK 0, Øvre Telemark 1 | PASS |

Resultatet er **0 kjente falske `confirmed` i dette seks-saks
ground-truth-settet**. Dette er ikke en presisjonspåstand for hele populasjonen.

## Målt effekt på historiske batcher

De opprinnelige stabile hypothesis-ID-ene ble kjørt på nytt. Tallene under er
pipeline-målinger, ikke ny faksimileverifikasjon og ikke kanonisering.

| Batch | Confirmed før → etter | Conflict før → etter | Probable før → etter | Ambiguous før → etter | Not found før → etter |
|---|---:|---:|---:|---:|---:|
| Batch 01 V4 | 6 → 2 | 3 → 0 | 3 → 6 | 83 → 87 | 5 → 5 |
| Batch 02 V3 | 8 → 8 | 2 → 1 | 3 → 8 | 242 → 238 | 5 → 5 |
| Batch 03 | 4 → 4 | 3 → 4 | 13 → 16 | 158 → 154 | 2 → 2 |

### Batch 01-statusendringer

- Herd 1945 #3: `conflict` → `ambiguous`; OCR-utdraget bandt ikke den avvikende
  scoren sikkert til AaFK–Herd.
- Ranheim 1946 #15: `confirmed` → `ambiguous`; datoen korrigeres til 15. juni,
  men score og dato er ikke sterkt nok lokalt bundet for full bekreftelse.
- Clausenengen 1946 #24 og Freidig 1947 #3: `ambiguous` → `probable`; lokalt
  kamp-/tidsbevis består, mens score forblir ukjent.
- Skarbøvik 1947 #8 og Ørsta 1948 #4: `conflict` → `ambiguous`; avvikende score
  kan ikke bindes sikkert i de tilgjengelige fragmentene. Entydige syntetiske
  conflict-caser består fortsatt.
- Aksla 1948 #2 og Langevåg 1948 #13: `confirmed` → `ambiguous`; score på tvers
  av kampnotiser avvises.
- Snøgg 1948 #7: `ambiguous` → `probable`; lokalt temporal-/motstanderbevis
  består uten sikker score.
- Herd 1949 #2: `confirmed` → `ambiguous`; retrospektiv score arver ikke datoen
  til den kommende kampen.

### Batch 02-statusendringer

- Fremad 1951 #7, Træff 1952 #21, Ørsta 1952 #23, Rollon 1953 #20 og
  Fredrikshavn 1956 #27: `ambiguous` → `probable`; lokal kamp-/temporal evidens
  består, men gir ikke sikker score.
- Lyn 1952 #9: `confirmed` → `ambiguous`, Braatt 1952 #18: `probable` →
  `ambiguous`, og Braatt 1958 #15: `confirmed` → `probable`; resultat og dato
  var ikke tilstrekkelig bundet i samme lokale hendelse.
- Skarbøvik 1953 #5: `conflict` → `ambiguous`; den avvikende scoren var ikke
  entydig bundet til lagparet.
- KFK 1953 #21 og Herd 1955 #35: `ambiguous` → `confirmed`; eksplisitte lokale
  oppsett/resultatlinjer binder lagpar, score og dato. Disse statusene er ikke
  fullt visuelt faksimileverifisert i denne endringen.

### Batch 03-statusendringer

- Sandane 1949 #16: `conflict` → `ambiguous`; scoren var ikke sikkert lokalt
  bundet.
- Langevåg 1949 #17 og Spjelkavik 1963 #1: `ambiguous` → `confirmed`; eksplisitt
  lokal lagpar-score og temporal evidens blir nå lest sammen. Statusene er ikke
  fullt visuelt faksimileverifisert her.
- Herd 1959 #13, Østsiden 1961 #10, Brattvåg 1962 #1, Guard 1962 #23, Vigra
  1964 #10 og Eid 1964 #14: `ambiguous` → `probable`; lokalt kamp-/tidsbevis
  består uten full resultatsikkerhet.
- Braatt 1960 #27, Brage 1961 #12 og Årstad 1964 #13: `probable` → `ambiguous`;
  tidligere rolleaggregering kunne ikke opprettholdes konservativt.
- Herd 1961 #17 og Sunnmøringen 1963 #14: `confirmed` → `ambiguous`; dato og
  resultat var ikke bundet til samme lokale hendelse.
- Rollon 1962 #3 og Aksla 1964 #7: `ambiguous` → `conflict`; eksplisitte lokale
  kampoppsett har avvikende score og bundet dato. De er discovery-kandidater for
  senere faksimilekontroll, ikke redaksjonelt avgjorte konflikter.

Store endringer er dermed synlige og forklarte. Terskler er ikke senket for å
beholde tidligere antall `confirmed`.

## Policy og verifikasjon

Default sibling-policy er uendret: siblings går til manuell vurdering, og
`--resolve-siblings` er fortsatt eksplisitt opt-in. Kronologi alene gir ikke høy
confidence. Vanlig CI bruker bare fixtures og gjør ingen live NB-kall.

Den eksplisitte live-smoken passerte 4 av 4 kontroller. Full valideringsstatus
føres i PR-beskrivelsen. Neste faglige steg er full visuell faksimilekontroll av
de resterende tidligere `confirmed` i Batch 02 og Batch 03, før en ny stor
discovery-bølge.
