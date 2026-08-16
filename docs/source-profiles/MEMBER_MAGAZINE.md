# Source Profile: AaFK Medlemsblad (`member_magazine`)

Denne profilen gjelder periodiske klubbpublikasjoner, medlemsblader og hefter utgitt av Aalesunds Fotballklubb.

> [!NOTE]
> Profiler er supplerende kildekunnskap om særtrekk. Den autoritative felles runbooken i [`docs/HISTORISK_KILDEINNHOSTING_RUNBOOK.md`](../HISTORISK_KILDEINNHOSTING_RUNBOOK.md) og manifestskjemaet er overordnet.

---

## 1. Kildetype og struktur
- **Periodisitet:** Én årgang kan bestå av flere hefter (`sourceId`-er) med varierende hefte- og sidenummerering.
- **Innhold:**
  - Samtidige kampreferater og lagoppstillinger.
  - Terminlister for kommende sesonger eller halvår.
  - Årsmøtereferater, styresammensetning og komitélister.
  - Medlemsomtaler, jubileumsartikler, hedersbevisninger og nekrologer.
  - Opptrykk (reprints) i spesialnumre og jubileumshefter.

---

## 2. Kildespesifikke særtrekk og fallgruver

### Terminlister vs. faktiske kamper
- Terminlister publiseres ofte før sesongstart.
- **Regel:** En terminlisteoppføring gir `disposition: fixture_only` inntil den er bekreftet spilt gjennom et kampreferat eller resultatliste.

### Reprints og jubileumsnumre
- Jubileumsnumre gjengir ofte eldre kampreferater og styreoversikter ordrett.
- **Regel:** Reprints skal merkes i Source Inventory som `reviewStatus: duplicate_or_reprint` med `duplicateOf: <original-sourceId>`. De utgjør ikke uavhengig kildebekreftelse.

### Person- og organisasjonshistorikk
- Medlemsbladet er hovedkilden for tillitsvalgte, styremedlemmer, oppmenn og komitéledere.
- Alle verv føres som roller (`roles`) på personfilen med kildereferanse og sidetall.

---

## 3. Påkrevde innhøstingspass
1. `facsimile_review`: Fullstendig visuell faksimilegjennomgang.
2. `explicit_results`: Kamper og resultater.
3. `fixture_reconciliation`: Avstemming av terminlister mot spilte oppgjør.
4. `people_and_roles`: Spillere, ledere og tillitsvalgte.
5. `organization`: Årsmøter, styrer og snapshots.
6. `retrospectives_and_claims`: Tilbakeblikk og memoarer.
7. `observations`: Milepæler, anlegg og hendelser.
