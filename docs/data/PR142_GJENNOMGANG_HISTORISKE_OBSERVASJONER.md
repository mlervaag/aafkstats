# Gjennomgang av PR 142 — historiske observasjoner

PR 142 («Legg til historiske observasjoner (fakta)», merget 14. august 2026) innførte en ny
kanonisk modell i arkivet: `data/observations/<id>.yaml` for korte, kildeførte fakta som ikke
henger på én bestemt kamp. Denne gjennomgangen ser på hva endringen faktisk traff i arkivet, hva
den ikke traff, og hvilke andre PR-er som har samme type utslag.

Kontrollert mot arbeidstreet: `pnpm validate` er grønn (1499 kamper · 379 observasjoner · 426 personer).

## Hva som er godt løst

- **Relasjonene er normalisert.** `observation_people`, `observation_seasons`, `observation_matches`
  og `observation_competitions` gjør at samme hendelse kan vises flere steder uten å kopieres. Det er
  riktig valg for et arkiv der samme kildeavsnitt gjelder både en person og en sesong.
- **`crossValidate` dekker alle fem relasjonstypene.** Ukjent kilde, person, sesong, kamp og
  konkurranse gir alle avvik ved validering, med test for hver.
- **Fremmednøkkelrekkefølgen i `build.ts` er tenkt igjennom.** Kamprelasjonene skrives bevisst etter
  kampene, med kommentar som forklarer hvorfor.
- **`packages/query/src/dataset.ts` ble oppdatert** i samme PR, så spørrefunksjonen kjenner viewet.

## Funn

### 1. Tellingen av arkivet fanger ikke den nye modellen

`packages/schema/src/cli/validate.ts:29` teller bare `archive.observations` — leverandørenes
råobservasjoner. `archive.historicalObservations` telles ikke. README sier at «`pnpm validate`
skriver ut de gjeldende» tallene, og «Arkivet i tall» har ingen rad for historiske observasjoner.
Arkivet har nå 22 slike filer uten at det synes noe sted.

Dette er punkt 5 i `claude.md` (README «Arkivet i tall» skal oppdateres ved ny data), og PR 142
rørte ikke `README.md`.

### 2. `packages/db/README.md` mangler viewet i «den offentlige kontrakten»

README-en lister eksplisitt hvilke views uten `core_`-prefiks som utgjør den offentlige kontrakten.
`historical_observations` står ikke der. Ved kontroll mot `schema.sql` mangler også
`match_stats`, `coach_spells`, `declared_coach_spells`, `standings_progression` og
`verification_cases`. Lista har altså drevet fra virkeligheten over flere PR-er, og PR 142 la til én
til.

### 3. Katalogstrukturen i DATAMODELL viser ikke den nye plasseringen

`docs/DATAMODELL.md` fikk et nytt kapittel «Historisk observasjon», men katalogtreet viser fortsatt
bare:

```
├── observations/
│   └── rsssf/      <ekstern-id>.yaml        Hva kilden sa, før normalisering
```

Selve regelen som skiller de to modellene — kanoniske observasjoner på toppnivå, leverandørenes
råobservasjoner i undermapper — står ikke i treet. Det er nettopp den regelen `load.ts` håndhever
(`listYaml(observationsDir)` er ikke rekursiv), og den som gjør at en fil lagt på feil sted stille
blir tolket med feil skjema.

### 4. To ulike modeller deler mappe og etikett

`duplicates(archive.historicalObservations, "observations")` bruker samme etikett som
leverandørobservasjonene. Feilmeldinger blir tvetydige, og en leser som ser `data/observations/`
kan ikke se på mappenavnet hvilken av de to modellene som gjelder. Enten bør de kanoniske faktaene
få egen mappe (`data/facts/`), eller så bør delingen dokumenteres eksplisitt.

### 5. `url` i viewet kan være NULL, og søket dropper da treffet stille

Viewet utleder `url` fra første person, ellers første sesong. En observasjon som bare er knyttet til
en kamp eller en konkurranse får `url = NULL`, og `searchHistoricalObservations` filtrerer den bort
med `row.url !== null` uten spor. Ingen av dagens 22 filer treffes, men modellen tillater det
eksplisitt, og feilen vil vise seg som «faktumet finnes ikke i søket» uten feilmelding.

### 6. `matchIds` og `competitionIds` lagres, valideres — og vises aldri

`HistoricalObservations`-komponenten brukes bare på personsiden og sesongsiden. Verken kampsiden
eller konkurransesiden viser observasjoner. `data/observations/1962-publikumsrekord-12000-aksla.yaml`
peker på kampen 4. november 1962, men leseren som åpner den kampen ser ikke publikumsrekorden.
Enten bør visningen på plass, eller så bør relasjonene fjernes til de har et formål.

### 7. Dedupliseringen i `people.ts` kan skjule for mye

Nøkkelsettet inneholder `sourceId:page`, men filteret sjekker i tillegg `sourceId:` (tom side).
Siterer én observasjon en kilde uten sidetall, forsvinner *alle* personomtaler fra den kilden fra
personsiden — også omtaler fra helt andre sider som sier noe annet. Riktig oppførsel er å bare
matche på samme side når observasjonen har side, og bare skjule sideløse omtaler når observasjonen
også er sideløs.

### 8. Utvidet virkeområde uten omtale i PR-teksten

Samme PR endret `season`-skjemaet slik at `expectedMatches` og `expectedRounds` godtas med eksplisitt
`sources[].fields` i stedet for `note`, og fjernet deretter noter fra sesongene 1917, 1918 og 1920.
Endringen er i seg selv en forbedring — kilde er sterkere enn fritekstnote — men den er en
guardrail-endring gjemt i en data-PR, og den står ikke i PR-beskrivelsen.

### 9. Mindre punkter

- Sorteringen spriker: personsiden `date DESC`, sesongsiden `date ASC`, viewet `date DESC`.
- `formatDate` normaliserer bare hele ISO-datoer. Modellen tillater eksplisitt `ÅÅÅÅ-MM`, som da
  skrives ut som «1919-05» midt i norsk prosa.
- `seasonYears` er begrenset til 1914–2100 i skjemaet, samtidig som `crossValidate` allerede krever at
  sesongen finnes. Grensa er overflødig og et magisk tall.

### 10. 60,7 MB døde binærfiler ligger igjen i historikken

PR 140 la inn `tmp/pdfs/pr140/` (PDF-er og renderbilder). PR 142 fjernet dem fra sporing og la
`tmp/` i `.gitignore` etter tilbakemelding i PR-en — men blobbene ligger fortsatt i historikken til
`main`: 177 objekter, 60,7 MB av totalt 91 MB i `.git`. `.gitignore` hindrer gjentakelse; opprydding
krever historikkomskriving og må være en bevisst beslutning.

## Andre PR-er som treffer de samme punktene

| PR | Hva den gjorde | Hva som mangler |
|---|---|---|
| **#126** manuell verifisering | La til `core_verification_cases` og viewet `verification_cases` | Viewet ble aldri lagt inn i `packages/query/src/dataset.ts`, og står heller ikke i `packages/db/README.md`. **Dette er aktiv drift i dag.** |
| **#158** historical-harvest-guardrails | 4327 linjer i `packages/schema`, ny `data/preservation-exceptions.yaml` | Verken `DATAMODELL.md` eller `ARKITEKTUR.md` er oppdatert. Fila ligger rett i `data/`, lastes ikke av `loadArchive`, og står ikke i katalogtreet |
| **#156 / #163** Kråmyra 1955 | Faktumet om første bruk av Kråmyra 21. august 1955 | Finnes nå både som `data/observations/1955-kramyra-forste-bruk.yaml` og som `events:`-oppføring i `data/venues/kramyra-stadion.yaml` med nesten ordrett samme tekst i `note`. Dette er akkurat dupliseringen den nye modellen skulle fjerne — men observasjonsmodellen har ingen `venueIds`, så det finnes ingen riktig måte å gjøre det på |
| **#144, #145** | Rørte kjerneskjema | Ingen oppdatering av `dataset.ts` |
| **#153, #155** medlemsblad | Data og skjema | Oppdaterte både `README.md` og `packages/db/README.md`. Dette er mønsteret de andre bør følge |

### Hvorfor drift som i #126 ikke blir fanget

`claude.md` lover at «en test vil med vilje feile» hvis `dataset.ts` ikke oppdateres. Testen i
`packages/query/test/dataset.test.ts` itererer over `views` fra `dataset.ts` og sammenligner
kolonnene mot `PRAGMA table_info`. Den fanger derfor kolonner som er lagt til i et **dokumentert**
view — men et helt view som finnes i databasen og mangler i `dataset.ts` blir aldri sett. Det er
nøyaktig hullet `verification_cases` falt gjennom.

## Anbefalte tiltak, og hva som er gjort

Punkt 1–7 er utført i PR 165, som denne gjennomgangen hører til. Punkt 8 er en beslutning som må
tas av et menneske.

| # | Tiltak | Status |
|---|---|---|
| 1 | Dataset-testen sammenligner alle views i `sqlite_master` (uten `core_`-prefiks) med `views` i `dataset.ts` | Utført. `verification_cases` er samtidig dokumentert |
| 2 | View-lista i `packages/db/README.md` kontrolleres mot `schema.sql` i `schema.test.ts` | Utført. Seks views som manglet er skrevet inn |
| 3 | `validate.ts` teller historiske observasjoner, og README har raden | Utført |
| 4 | `venueIds` i observasjonsmodellen, og Kråmyra-dupliseringen ryddet | Utført. Fem observasjoner peker nå på banen sin, og `note` på baneposten er fjernet |
| 5 | Observasjoner vises på kamp- og banesiden | Utført. Konkurransesiden finnes ikke i appen, så skjemaet krever i stedet at hver observasjon har minst én relasjon som gir den en side |
| 6 | `sourceId:`-nøkkelen i `apps/web/lib/people.ts` | Utført. Omtaler skjules bare ved treff på samme kilde *og* samme side |
| 7 | Katalogtreet i `DATAMODELL.md` | Utført, inkludert `harvests/` og `preservation-exceptions.yaml` fra PR 158/164 |
| 8 | De 60,7 MB døde binærfilene i historikken | **Ikke utført — krever en beslutning** |

I tillegg er tre av «mindre punkter» rettet i samme slengen: sorteringen er kronologisk overalt,
delvise datoer skrives ut på norsk, og årstallsgrensa 1914–2100 i `seasonYears` er fjernet siden
`crossValidate` allerede krever at sesongen finnes.

### Punkt 8: hvorfor det står igjen

Blobbene ligger i commit-historikken til `main`. Å fjerne dem krever `git filter-repo` eller
tilsvarende, og det skriver om alle commit-SHA-ene etter PR 140. Konsekvensene er reelle:

- Alle som har en klon må hente på nytt med `--force`, og pågående grener må rebases.
- SHA-referanser i PR-tekster, issues og `approvedIn`-feltene i `data/preservation-exceptions.yaml`
  peker på commits som ikke lenger finnes.
- Bevaringsvernet fra PR 158 sammenligner mot base-commit. En omskrevet historikk må verifiseres
  mot vernet på nytt før den pushes.

Gevinsten er at `.git` faller fra 91 MB til rundt 30 MB. `.gitignore` hindrer allerede at det
skjer igjen, så dette haster ikke. Det er en ryddejobb som bør gjøres bevisst, i en egen PR, på et
tidspunkt uten andre grener i luften — ikke som et biprodukt av en gjennomgang.

## Etterskrift: PR 164

PR 164 ble merget mens denne gjennomgangen pågikk, og dekker to av funnene fra en annen vinkel.
Den innfører strukturell additivitet på `data/observations/` — BASE må være en delmengde av HEAD —
og et batchmanifest i `data/harvests/` som CI krever ved endringer i kildedata. Det er sterke
guardrails på *data*.

De treffer likevel ikke det denne gjennomgangen handler om. Additivitetsvernet ser at en fil ikke
mister innhold; det ser ikke at et view mangler i `dataset.ts`, at README-lista er ufullstendig,
eller at en relasjon aldri blir vist. Det er dokumentasjons- og visningsdrift, ikke datatap, og
den klassen feil trenger sine egne tester. Punkt 1 og 2 er nettopp de testene.
