# Visuell kontroll og innhøsting av <PUBLIKASJONSTITTEL OG ÅRGANG/NUMMER>

Denne loggen dokumenterer full visuell kontroll, kildekritisk vurdering og normalisering av **<PUBLIKASJONSTITTEL>** (<VOLUM/HEFTE>, <SIDEANTALL> sider). De trykte originalskannene (faksimilene) er kontrollert visuelt side for side som primærkilde i henhold til repoets autoritative standard i [`docs/HISTORISK_KILDEINNHOSTING_RUNBOOK.md`](../HISTORISK_KILDEINNHOSTING_RUNBOOK.md).

## Kilder og metadata

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

## Completion-matrise <ÅR>

| Kategori | Status / Antall | Notat & Tolkning |
|---|---:|---|
| Sider visuelt kontrollert | `<X/X>` | `<100 % visuelt kontrollert mot faksimile>` |
| A-lagskamper oppgitt i sesongfasit | `<Antall>` | `<f.eks. 28 kamper (14-6-8, mål 56-42) s. XX>` |
| Eksplisitte samtidige A-lagsresultater | `<Antall>` | `<Antall konkrete samtidige resultater funnet>` |
| Retrospektive kildepåstander (historiske år) | `<Antall>` | `<Historiske kamper fra tidligere år omtalt>` |
| Kildedokumenterte oppgjør i source-results | `<Antall>` | `<Totalt antall oppført i data/source-results/>` |
| Fixture-kilder vurdert | `<Antall>` | `<Terminlister vårsesong s. XX, høstsesong s. YY>` |
| Nye canonical matches | `<Antall>` | `<Kun ved entydig dato, motstander og bekreftet spilt>` |
| Berikede canonical matches | `<Antall>` | `<Eksisterende kamper tilført kilde eller data>` |
| Allerede dokumentert i eldre kilder | `<Antall>` | `<Funn som alt er dekket av eldre primærkilder>` |
| Reprint / duplisert kildestoff | `<Antall>` | `<Funn som er identisk opptrykk>` |
| Person candidates vurdert | `<Antall>` | `<Kandidatliste gjennomgått og disponert>` |
| Person roles vurdert | `<Antall>` | `<Hovedstyre, oppmenn, trenere, komiteer>` |
| Nye personer opprettet | `<Antall>` | `<Nye personfiler i data/people/>` |
| Unike eksisterende personfiler beriket | `<Antall>` | `<Eksisterende personer tilført kilde/rolle/honor>` |
| Personberikelser for årgangen | `<Antall>` | `<Totalt antall personforekomster beriket>` |
| Personroller opprettet eller beriket | `<Antall>` | `<Roller ført på personfiler>` |
| Honors og milepæler | `<Antall>` | `<Gullmerker, hedersgaver, spillemerker>` |
| Mentions vurdert eller knyttet | `<Antall>` | `<Omtaler lagt til som kildereferanse>` |
| Historical observations | `<Antall>` | `<Bane, anlegg eller klubbhistorisk milepæl>` |
| Organisasjonssnapshots | `<Antall>` | `<data/organizations/<år>-<klubb>.yaml>` |
| Konflikter løst | `<Antall>` | `<Konflikter med resolved: true>` |
| Konflikter åpne | `<Antall>` | `<Konflikter med resolved: false>` |
| Identity uncertain | `<Antall>` | `<Navnelikhet / uavklart personidentitet>` |

---

## Terminlister og fixture-reconciliation

Dokumentasjon av terminlister og avstemming mot faktiske resultater i henhold til runbookens kapittel 7:

- **Vårterminliste (s. `<X>`):** `<Beskrivelse av oppgitte kamper og planlagte datoer>`
- **Høstterminliste (s. `<Y>`):** `<Beskrivelse av oppgitte kamper og planlagte datoer>`
- **Cup / NM (s. `<Z>`):** `<Beskrivelse av cupoppsett>`

### Avstemmingstabell (Planlagt oppsett vs. Faktisk resultat)

| Planlagt dato | Motstander | H/B | Konkurranse | Faktisk resultat | Kilde s. | Disposition | Kanonisk status |
|---|---|---|---|---|---|---|---|
| `<YYYY-MM-DD>` | `<Klubb>` | `<H/B>` | `<Serie/Cup>` | `<Mål–Mål>` | `<s. XX>` | `canonical_enriched` | `<Filnavn eller source-result>` |

---

## Retrospektiv kildereconciliation og opptrykk (reprints)

Dokumentasjon av artikler og notiser som omtaler historiske hendelser fra tidligere år ($factYear \neq sourcePublicationYear$):

| Kamp / Historisk hendelse | Faktisk år (factYear) | Score / Utfall | Kilde side | Disposition | Status i arkivet / Handling |
|---|---:|---|---|---|---|
| `<Kamp / Hendelse>` | `<YYYY>` | `<Score>` | `<s. XX>` | `<disposition>` | `<Normalisert i source-results under YYYY / merknad>` |

---

## Personfunn og eksplisitt disposition

Samtlige personfunn i publikasjonen med formell disposition i henhold til runbookens kapittel 4:

| Person | Funn / Sidetall | Kategori | Disposition | Handling / Notat |
|---|---|---|---|---|
| `<Fullt navn>` | `<Rolle / Omtale s. XX>` | `<board / sporting / player / honor>` | `<person_enriched / role_created>` | `<Beskrivelse av endring i personfil og snapshot>` |

---

## Kildearitmetikk og sesongsummer

- **Trykt sesongtotal:** `<f.eks. 28 kamper (12 V, 6 U, 10 T, mål 54–48, 30 poeng)>`
- **Sum av dokumenterte enkeltkamper:** `<f.eks. 14 kamper (8 V, 2 U, 4 T, mål 32–18)>`
- **Differanse / status:** `<f.eks. 14 kamper mangler individuell kampdokumentasjon og er ikke diktet opp>`
- **Kildearitmetiske avvik i trykket:** `<Eventuelle trykkfeil i kildens egen summering er bevart med merknad>`

---

## Konflikthåndtering

Dokumentasjon av eventuelle sprik mellom kilder:

| Felt / Område | Kilde A | Kilde B | Status | Begrunnelse / Valgt verdi |
|---|---|---|---|---|
| `<f.eks. Fødselsår>` | `<Kilde 1: YYYY>` | `<Kilde 2: YYYY>` | `<resolved: true / false>` | `<Begrunnelse for konklusjon eller bevart uavklart>` |

---

## Side-for-side kontrollmatrise

Komplett logg over samtlige sider i publikasjonen (100 % visuell kontroll):

| Side | Hefte / Del | Tittel / Innhold | Kategori | Handling / Status | Notater & Historiske funn |
|---:|---|---|---|---|---|
| 1 | `<Nr. 1>` | `<Forside / Innhold>` | `<season_fact>` | `reviewed` | `<Merknad>` |
| 2 | `<Nr. 1>` | `<Artikkel>` | `<notes>` | `reviewed` | `<Merknad>` |

---

## Valideringslogg

- [ ] `pnpm validate` passerer (0 feil)
- [ ] `AAFK_DATA_DIR=fixtures/data pnpm validate` passerer (0 feil)
- [ ] `pnpm data:duplicates` rapporterer ingen uønskede duplikater
- [ ] `pnpm data:opponents-unresolved` rapporterer ingen ukjente klubber
- [ ] `pnpm data:contradictions` er sjekket og vurdert
- [ ] `pnpm db:build` fullfører uten advarsler
- [ ] `AAFK_DATA_DIR=fixtures/data pnpm db:build` fullfører
- [ ] `pnpm typecheck && pnpm lint && pnpm test` er 100 % grønn
- [ ] `pnpm build && pnpm smoke` kjører feilfritt
- [ ] `git diff data/people/` bekrefter full additivitet (ingen utilsiktede slettinger)

---

## Definition of Done (DoD)

- [ ] Alle sider er visuelt gjennomgått mot faksimile.
- [ ] Alle person- og kampfunn har en gyldig formell disposition.
- [ ] Kildedata er lagret i `data/source-results/` med feltspesifikk proveniens.
- [ ] Ingen kanoniske kamper eller datoer er gjettet eller utledet matematisk.
- [ ] Personhistorikk, verv, hedersbevisninger og observasjoner er oppdatert additivt.
- [ ] Full valideringsløype er kjørt og grønn.
