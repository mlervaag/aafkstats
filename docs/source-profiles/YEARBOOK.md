# Source Profile: NFF Årbok (`yearbook`)

Denne profilen gjelder Norges Fotballforbunds offisielle årlige årbøker og oversikter over norsk fotball.

> [!NOTE]
> Profiler er supplerende kildekunnskap om særtrekk. Den autoritative felles runbooken i [`docs/HISTORISK_KILDEINNHOSTING_RUNBOOK.md`](../HISTORISK_KILDEINNHOSTING_RUNBOOK.md) og manifestskjemaet er overordnet.

---

## 1. Kildetype og struktur
- **Nasjonal publikasjon:** Stor publikasjon (ofte 300–600 sider per årgang) der AaFK og Sunnmøre utgjør en liten, men autoritativ del.
- **Innhold:**
  - Offisielle landsdekkende divisjonstabeller og opp-/nedrykkskvalifisering.
  - NM-cupresultater (Norgesmesterskapet) med datoer, baner og dommere.
  - Kretsoversikter og kretsstyresammensetninger.
  - Forbundstinget: Representanter, delegater, lovendringer og komitéoppnevnelser.
  - Offisielle utmerkelser, hederstegn og landskampstatistikk.

---

## 2. Kildespesifikke særtrekk og fallgruver

### "AaFK-relevant" er mer enn kamper
- **Ikke overse organisasjon:** AaFK-representanter på forbundstinget (f.eks. Nils Jangaard), i NFFs lovkomité eller utvalg er verdifull person- og klubbhistorikk.
- Verv og delegatoppdrag føres som `roles` med kategori `board` eller `administration`.

### Tabellariske kontrollsummer
- Årbøkene har autoritative offisielle tabeller. Sjekk alltid målforskjell, poengsum og antall kamper mot eksisterende arkivtabeller (`data/standings/`).

### Retrospektive opplysninger
- Årbøker inneholder ofte historiske samletabeller (f.eks. "NM-finaler gjennom tidene" eller "Kretsmestere").
- Sjekk at påstander tidfestes til faktum-året, ikke årbokens utgivelsesår.

---

## 3. Påkrevde innhøstingspass
1. `facsimile_review`: Fullstendig visuell faksimilegjennomgang av relevante seksjoner.
2. `explicit_results`: Divisjons- og cupresultater.
3. `people_and_roles`: Spillerrepresentasjon, delegater og tillitsvalgte.
4. `organization`: Krets/forbundsadministrasjon og AaFKs representasjon.
5. `retrospectives_and_claims`: Historiske oversikter og hedershistorikk.
6. `observations`: Forbundsvedtak og nasjonale milepæler.
