# Visuell kontroll og innhøsting av <PUBLIKASJONSTITTEL OG ÅRGANG/NUMMER>

Denne loggen dokumenterer full visuell kontroll, kildekritisk vurdering og normalisering av **<PUBLIKASJONSTITTEL>** (<VOLUM/HEFTE>, <SIDEANTALL> sider). De trykte originalskannene (faksimilene) er kontrollert visuelt side for side som primærkilde i henhold til repoets autoritative standard i [`docs/HISTORISK_KILDEINNHOSTING_RUNBOOK.md`](../HISTORISK_KILDEINNHOSTING_RUNBOOK.md).

---

## 1. Kilder og metadata

| Felt | Verdi |
|---|---|
| Publikasjon | `<Publikasjonsnavn>` |
| Årgang / Utgivelsesår | `<År>` |
| Hefte / Volum | `<f.eks. Vol. X Nr. 1–6>` |
| Kilde-ID (`sourceId`) | `<sourceId>` |
| URN | `<URN:NBN:...>` |
| URL / Lenke | `<Lenke til NB eller kilde>` |
| Sider i omfang | `<Antall sider>` (skannummer `<X–Y>`, trykte sidetall `<A–B>`) |
| Kildekategori | `<medlemsblad / årbok / jubileumsbok / årsrapport>` |
| Reprint / duplikat | `<Nei / Ja, opptrykk av sourceId>` |

---

## 2. Source inventory (omfang for årgangen)

| sourceId | År | Volum | Hefte | Sider | Extraction | Type | Disposition |
|---|---:|---|---|---:|---|---|---|
| `<sourceId-1>` | `<år>` | `<vol>` | `<nr>` | `<X>` | `<complete/no-ALTO>` | `<ordinary/special/reprint>` | `<reviewed/duplicate/out_of_scope/unavailable>` |
| `<sourceId-2>` | `<år>` | `<vol>` | `<nr>` | `<Y>` | `<complete/no-ALTO>` | `<ordinary/special/reprint>` | `<reviewed/duplicate/out_of_scope/unavailable>` |

---

## 3. Completion-matrise <ÅR>

| Kategori | Status / Antall | Notat & Tolkning |
|---|---:|---|
| Sources i scope / reviewed | `<X/Y>` | `<Alle kilder i årsscopet inventarisert og disponert>` |
| Sider visuelt kontrollert | `<X/X>` | `<100 % visuelt kontrollert mot faksimile>` |
| A-lagskamper oppgitt i sesongfasit | `<Antall>` | `<f.eks. 28 kamper (14-6-8, mål 56-42) s. XX>` |
| Eksplisitte samtidige A-lagsresultater | `<Antall>` | `<Antall konkrete samtidige resultater funnet>` |
| Retrospektive kildepåstander (historiske år) | `<Antall>` | `<Historiske kamper fra tidligere år omtalt>` |
| Source-result entries | `<Antall>` | `<Totalt antall resultater ført i data/source-results/<sourceId>.yaml>` |
| Fixture-kilder vurdert | `<Antall>` | `<Terminlister vårsesong s. XX, høstsesong s. YY>` |
| Nye canonical matches | `<Antall>` | `<Kun ved entydig dato, motstander og bekreftet spilt>` |
| Berikede canonical matches | `<Antall>` | `<Eksisterende kamper tilført kilde eller felt>` |
| Allerede dokumentert i eldre kilder | `<Antall>` | `<Funn som alt er dekket av eldre primærkilder>` |
| Reprint / duplisert kildestoff | `<Antall>` | `<Funn som er identisk opptrykk>` |
| Person candidates vurdert | `<Antall>` | `<Kandidatliste gjennomgått og disponert>` |
| Nye personer opprettet | `<Antall>` | `<Nye personfiler i data/people/>` |
| Unike eksisterende personfiler beriket | `<Antall>` | `<Eksisterende personer tilført data>` |
| Personroller opprettet eller beriket | `<Antall>` | `<Roller ført i personfilenes roles-array>` |
| Honorary roles & milestones | `<Antall>` | `<Gullmerker, hedersgaver (category: honorary)>` |
| Mentions vurdert eller knyttet | `<Antall>` | `<Omtaler lagt til som kildereferanse i sources>` |
| Historical observations | `<Antall>` | `<Bane, anlegg eller klubbhistorisk milepæl>` |
| Organisasjonssnapshots | `<Antall>` | `<data/organization/snapshots/<år>-<klubb>.yaml>` |
| Konflikter løst | `<Antall>` | `<Konflikter med resolved: true>` |
| Konflikter åpne | `<Antall>` | `<Konflikter med resolved: false>` |
| Identity uncertain | `<Antall>` | `<Navnelikhet / uavklart personidentitet>` |

---

## 4. Terminlister og fixture-reconciliation

Dokumentasjon av terminlister og avstemming mot faktiske resultater etter de 9 sjekkpunktene i runbooken:

- **Vårterminliste (s. `<X>`):** `<Beskrivelse av oppgitte kamper og planlagte datoer>`
- **Høstterminliste (s. `<Y>`):** `<Beskrivelse av oppgitte kamper og planlagte datoer>`
- **Cup / NM (s. `<Z>`):** `<Beskrivelse av cupoppsett>`

### Avstemmingstabell (Planlagt oppsett vs. Faktisk resultat)

| Planlagt dato | Motstander | H/B | Konkurranse | Faktisk resultat | Kilde s. | Disposition | Kanonisk status |
|---|---|---|---|---|---|---|---|
| `<YYYY-MM-DD>` | `<Klubb>` | `<H/B>` | `<Serie/Cup>` | `<Mål–Mål>` | `<s. XX>` | `canonical_enriched` | `<Filnavn eller source-result>` |

---

## 5. Retrospektiv kildereconciliation og opptrykk (reprints)

Dokumentasjon av artikler og notiser som omtaler historiske hendelser fra tidligere år ($seasons[].year \neq sourcePublicationYear$):

| Kamp / Historisk hendelse | Faktisk år (`seasons[].year`) | Score / Utfall | Kilde side | Disposition | Status i arkivet / Handling |
|---|---:|---|---|---|---|
| `<Kamp / Hendelse>` | `<YYYY>` | `<Score>` | `<s. XX>` | `<disposition>` | `<Normalisert i source-results under seasons[].year = YYYY>` |

---

## 6. Personfunn og eksplisitt disposition

Samtlige personfunn i publikasjonen med formell disposition i henhold til gjeldende schema:

| Person | Funn / Sidetall | Kategori | Disposition | Handling / Notat |
|---|---|---|---|---|
| `<Fullt navn>` | `<Rolle / Omtale s. XX>` | `<board / sporting / honorary / admin>` | `<person_enriched / role_created>` | `<Beskrivelse av endring i personfil og snapshot>` |

---

## 7. Kildearitmetikk og sesongsummer

- **Trykt sesongtotal:** `<f.eks. 28 kamper (12 V, 6 U, 10 T, mål 54–48, 30 poeng)>`
- **Sum av dokumenterte enkeltkamper:** `<f.eks. 14 kamper (8 V, 2 U, 4 T, mål 32–18)>`
- **Differanse / status:** `<f.eks. 14 kamper mangler individuell kampdokumentasjon og er ikke diktet opp>`
- **Kildearitmetiske avvik i trykket:** `<Eventuelle trykkfeil i kildens egen summering er bevart med merknad>`

---

## 8. Konflikthåndtering

Dokumentasjon av eventuelle kildekonflikter i tråd med schema:

| Felt (`field`) | Kilde A | Kilde B | Status (`resolved`) | Beslutning (`decision`, `chosen`, `reason`) |
|---|---|---|---|---|
| `<formann.1962 / position / role>` | `<Kilde 1: verdi>` | `<Kilde 2: verdi>` | `<true / false>` | `<chosen: verdi, reason: begrunnelse>` |


---

## 9. Side-for-side kontrollmatrise

Komplett logg over samtlige sider i publikasjonen (100 % visuell kontroll):

| Side | Hefte / Del | Tittel / Innhold | Kategori | Handling / Status | Notater & Historiske funn |
|---:|---|---|---|---|---|
| 1 | `<Nr. 1>` | `<Forside / Innhold>` | `<season_fact>` | `reviewed` | `<Merknad>` |
| 2 | `<Nr. 1>` | `<Artikkel>` | `<notes>` | `reviewed` | `<Merknad>` |

---

## 10. Valideringslogg

### Tekniske krav (Må være 0 feil)
- [ ] `pnpm validate` passerer (0 feil)
- [ ] `AAFK_DATA_DIR=fixtures/data pnpm validate` passerer (0 feil)
- [ ] `pnpm db:build` fullfører
- [ ] `AAFK_DATA_DIR=fixtures/data pnpm db:build` fullfører
- [ ] `pnpm typecheck && pnpm lint && pnpm test` er 100 % grønn
- [ ] `AAFK_DATA_DIR=fixtures/data pnpm build && pnpm smoke` kjører feilfritt (18/18 sider OK)
- [ ] `git diff data/people/` bekrefter full additivitet (ingen uforklarlige slettinger)

### Redaksjonelle rapporter (Kjørt og vurdert)
- [ ] `pnpm data:duplicates` – Ingen uønskede duplikater introdusert
- [ ] `pnpm data:opponents-unresolved` – Nye motstandere er vurdert
- [ ] `pnpm data:contradictions` – Rapport er kontrollert og eventuelle nye sprik dokumentert

---

## 11. Definition of Done (DoD)

- [ ] Source inventory er utfylt og alle kilder for året er disponert.
- [ ] Alle tilgjengelige sider er visuelt gjennomgått mot faksimile.
- [ ] Alle person- og kampfunn har en gyldig formell disposition.
- [ ] Kildedata er lagret i `data/source-results/<sourceId>.yaml` med korrekt `seasons[].year`.
- [ ] Ingen kanoniske kamper, datoer eller roller er gjettet eller utledet matematisk.
- [ ] Personhistorikk, verv, æresbevisninger og observasjoner følger gjeldende schema.
- [ ] Preservation-regresjonstester er lagt til dersom eksisterende personer er endret vesentlig.
- [ ] Full valideringsløype er kjørt og grønn.
