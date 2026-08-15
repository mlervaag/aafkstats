# Kildeprofil: AaFK Medlemsblad (1950–1979)

Dette dokumentet beskriver de spesifikke kildeegenskapene for **Medlemsblad for Aalesunds Fotballklubb**.

Dokumentet er en kildespesifikk profil. All generell metodikk, kildehierarki, 21-trinns arbeidsflyt, dispositions-vokabular, additivitetsregler og valideringsstandard er definert i hovedrunbooken:
👉 **[`docs/HISTORISK_KILDEINNHOSTING_RUNBOOK.md`](HISTORISK_KILDEINNHOSTING_RUNBOOK.md)**

---

## 1. Kildekarakteristikk og heftestruktur

- **Flere hefter per årgang:** En årgang består typisk av mellom 4 og 8 hefter (som oftest hefte 1–6) utgitt gjennom kalenderåret.
- **Særnummer og jubileumsutgaver:** Ved runde klubbjubileer (f.eks. 40-årsjubileet i 1954) ble det utgitt egne jubileumshefter. Disse har ofte separate `sourceId`-er i Nasjonalbibliotekets katalogisering og skal registreres som selvstendige kilder.
- **Sideinndeling:** Heftene har som regel fortløpende sidetall gjennom hele årgangen (f.eks. side 1–108 for hefte 1–6), men særnummer har ofte separat paginering (side 1–40). Kontroller alltid trykt sidetall mot skannummer.

---

## 2. Spesifikke innholdsregler for medlemsbladet

### Terminlister og sesongoppsett
Medlemsbladet publiserte regelmessig terminlister for vårsesongen (ofte i hefte 2 eller 3) og høstsesongen (ofte i hefte 4 eller 5).
- Følg terminlistereglene i hovedrunbooken: Registrer som `fixture_list`.
- Planlagt kampdato skal **ikke** automatisk bli faktisk spilledato uten bekreftelse.

### Årsmøter og funksjonsår (valgår vs. arbeidsår)
AaFKs ordinære årsmøter ble tradisjonelt avholdt i **november eller desember**.
- Valg referert i årets siste hefte (f.eks. hefte 6 i desember 1953) gjelder som hovedregel **arbeidsåret og sesongen etter** (1954).
- `role.from` skal settes til det påfølgende arbeidsåret med mindre kilden eksplisitt dokumenterer et suppleringsvalg for inneværende sesong.
- Organisasjonssnapshot for år $X$ skal ikke inneholde styret som først tiltrådte for $X+1$.

### Dameavdelingen og Yngres avdeling
Medlemsbladet dekket klubbens fulle bredde:
- **Dameavdelingen:** Spilte en avgjørende rolle for klubbøkonomien og anleggsfinansieringen (basarer, tombolaer i Torghallen, drakter og Kråmyra-støtte). Dameavdelingens formenn og styremedlemmer skal registreres med `body: "Dameavdelingen"`.
- **Yngres avdeling (junior, gutt, smågutt):** Oppmenn og trenere i aldersbestemte klasser registreres med korrekt aldersangivelse (`non_senior`).

### Medlemspersonalia, minneord og hedersbevisninger
Medlemsbladet er arkivets rikeste kilde til personhistorikk for spillere og tillitsvalgte:
- Tildeling av spillemerker for 100, 150, 200 og 250 A-kamper ble publisert med jevne mellomrom.
- Fødselsdagsomtaler (50, 60 og 70 år) gir ofte verdifulle oppsummeringer av spillerkarrierer fra pionertiden.
- Minneord gir dødsdatoer og historisk kontekst.
- Disse funnene skal registreres som `honors`, `roles` eller `sources` på personfilene.

### Historiske tilbakeblikk og reprints
Jubileumsnumre og høstnumre inneholder ofte historiske tilbakeblikk med kampreferater fra 1920- og 1930-tallet.
- Skill strengt mellom `sourcePublicationYear` og `factYear`.
- Hvis en tekst er et identisk opptrykk (reprint) fra en tidligere jubileumsbok eller et særnummer, skal dette merkes som `duplicate_publication` / `reprint` og ikke regnes som en uavhengig ny bekreftelse.

---

## 3. Anbefalt batching og arbeidsmetode

- **Batchstørrelse:** Medlemsbladårganger bør normalt batches i bolker på **3–4 år** (f.eks. 1953–1956, 1957–1960). Dette gir god oversikt over styreperioder, sportslige sykluser og baneutvikling uten at reviewet blir for stort.
- **Reviewformat:**
  - Hver enkelt årgang dokumenteres etter [`docs/data/HISTORISK_KILDE_REVIEW_TEMPLATE.md`](data/HISTORISK_KILDE_REVIEW_TEMPLATE.md).
  - Den samlede batchen oppsummeres i en batchrapport etter [`docs/data/HISTORISK_KILDE_BATCH_TEMPLATE.md`](data/HISTORISK_KILDE_BATCH_TEMPLATE.md).
- **Kryssreferanse:** For alle andre innhøstingsregler, se hovedrunbooken [`docs/HISTORISK_KILDEINNHOSTING_RUNBOOK.md`](HISTORISK_KILDEINNHOSTING_RUNBOOK.md).
