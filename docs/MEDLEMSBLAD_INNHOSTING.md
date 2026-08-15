# Kildeprofil: AaFK Medlemsblad (1950–1979)

Dette dokumentet beskriver de spesifikke kildeegenskapene for **Medlemsblad for Aalesunds Fotballklubb**.

Dokumentet er en kildespesifikk profil. All generell metodikk, kildehierarki, 21-trinns arbeidsflyt, dispositions-vokabular, additivitetsregler og valideringsstandard er definert i hovedrunbooken:
👉 **[`docs/HISTORISK_KILDEINNHOSTING_RUNBOOK.md`](HISTORISK_KILDEINNHOSTING_RUNBOOK.md)**

---

## 1. Kildekarakteristikk og heftestruktur

- **Varierende katalogiseringsgranularitet:** Antall hefter og katalogiseringsgranularitet varierer mellom årgangene. Enkelte årganger er representert som én samlet kilde (`sourceId`), mens andre er registrert som mange separate `sourceId`-er per enkelt hefte eller særnummer.
- **Obligatorisk Source Inventory:** Samtlige kilder og hefter for det aktuelle året **SKAL** inventariseres i `data/sources/*.yaml` før review starter, slik at ingen hefter eller særnumre utelates.
- **Særnummer og jubileumsutgaver:** Ved runde klubbjubileer (f.eks. 40-årsjubileet i 1954) ble det utgitt egne jubileumshefter med separat paginering (side 1–40). Disse skal registreres og reviewes som selvstendige kilder.
- **Sideinndeling:** Kontroller alltid trykt sidetall mot skannummer i Nasjonalbibliotekets visning.

---

## 2. Spesifikke innholdsregler for medlemsbladet

### Terminlister og sesongoppsett
Medlemsbladet publiserte regelmessig terminlister for vårsesongen og høstsesongen.
- Følg terminlistereglene og de 9 sjekkpunktene i hovedrunbooken: Registrer som `fixture_list`.
- Planlagt kampdato skal **ikke** automatisk bli faktisk spilledato uten uavhengig bekreftelse på spilt kamp.

### Årsmøter og funksjonsår (valgår vs. arbeidsår)
AaFKs ordinære årsmøter ble tradisjonelt avholdt i **november eller desember**.
- Valg referert i årets siste hefte (f.eks. i desember 1953) gjelder som hovedregel **arbeidsåret og sesongen etter** (1954).
- `role.from` skal settes til det påfølgende arbeidsåret med mindre kilden eksplisitt dokumenterer et suppleringsvalg for inneværende sesong.
- Organisasjonssnapshot for år $X$ (`data/organization/snapshots/<X>-aafk.yaml`) skal ikke inneholde styret som først tiltrådte for $X+1$.

### Dameavdelingen og Yngres avdeling
Medlemsbladet dekket klubbens fulle bredde:
- **Dameavdelingen:** Spilte en avgjørende rolle for klubbøkonomien og anleggsfinansieringen (basarer, tombolaer i Torghallen, drakter og Kråmyra-støtte). Dameavdelingens formenn og styremedlemmer skal registreres med `body: "Dameavdelingen"`.
- **Yngres avdeling (junior, gutt, smågutt):** Oppmenn og trenere i aldersbestemte klasser registreres med gyldig rollekategori og presis `body` (f.eks. `category: coach`, `title: Trener`, `body: Juniorlaget`). *(Merk: `non_senior` er en review-/disposisjonskontekst, ikke en gyldig personRoleCategory).*

### Medlemspersonalia, minneord og hedersbevisninger
Medlemsbladet er arkivets rikeste kilde til personhistorikk for spillere og tillitsvalgte:
- Tildeling av spillemerker for 100, 150, 200 og 250 A-kamper ble publisert med jevne mellomrom.
- Fødselsdagsomtaler gir ofte verdifulle oppsummeringer av spillerkarrierer fra pionertiden.
- Minneord gir dødsdatoer og historisk kontekst.
- Hedersbevisninger (gullmerker, hedersgaver, æresmedlemskap) struktureres som personroller med `category: honorary`.
- Omtaler føres i personens `sources`-liste.

### Historiske tilbakeblikk og reprints
Jubileumsnumre og høstnumre inneholder ofte historiske tilbakeblikk med kampreferater fra 1920- og 1930-tallet.
- Kildepåstander normaliseres i `data/source-results/<sourceId>.yaml` under korrekt historisk `seasons[].year`.
- Hvis en tekst er et identisk opptrykk (reprint) fra en tidligere jubileumsbok eller et særnummer, skal dette merkes som `duplicate_publication` / `reprint` og ikke regnes som en uavhengig ny bekreftelse.

---

## 3. Anbefalt batching og arbeidsmetode

- **Batchstørrelse:** Medlemsbladårganger **BØR** normalt batches i bolker på **3–4 år** (f.eks. 1953–1956, 1957–1960). Batchstørrelsen skal imidlertid tilpasses:
  - Antall sourceId-er og hefter i perioden
  - Totalt sidevolum
  - Kildekompleksitet og antall nye personer/roller
- **Reviewformat:**
  - Hver enkelt årgang dokumenteres etter [`docs/data/HISTORISK_KILDE_REVIEW_TEMPLATE.md`](data/HISTORISK_KILDE_REVIEW_TEMPLATE.md).
  - Den samlede batchen oppsummeres i en batchrapport etter [`docs/data/HISTORISK_KILDE_BATCH_TEMPLATE.md`](data/HISTORISK_KILDE_BATCH_TEMPLATE.md).
- **Kryssreferanse:** For alle andre innhøstingsregler, se hovedrunbooken [`docs/HISTORISK_KILDEINNHOSTING_RUNBOOK.md`](HISTORISK_KILDEINNHOSTING_RUNBOOK.md).
