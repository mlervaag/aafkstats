# Sunnmørsposten-pilot 1979

Piloten kjørte alle 39 canonical AaFK-kamper med eksakt dato og resultat gjennom den datoankrede NB-løypa. Reviewgrunnlaget er NB sitt OCR-API. AaFK–Hødd 29. april er senere visuelt kontrollert som kalibreringssak; de øvrige postene har `facsimileReviewed: false`.

Et manuelt kontrollert utvalg av 1979-faksimilene viste 100 prosent korrekt kampkobling. Dette kalibreringsresultatet er grunnlaget for produksjonspolicyen som tillater OCR-review i den datoankrede canonical-løypa, men utvalget skal ikke forveksles med kontroll av alle 39 kamper.

## Resultat

| Mål | Antall |
| --- | ---: |
| Canonical kamper i scope | 39 |
| Kamper med koblet Sunnmørsposten-kilde | 31 |
| Kampreferat/resultatnotis koblet som ekstern rapport | 24 |
| OCR-korrelerte kamper | 30 |
| Kampreferat klassifisert | 23 |
| Ingen lokal OCR-kandidat | 8 |
| Mulig resultatkonflikt | 1 |
| Faksimileverifisert | 1 |

Statusen skiller omtale fra ferdig berikelse: 31 kamper har en koblet samtidig Sunnmørsposten-omtale, 24 har klassifisert kampreferat eller resultatnotis, og 28 har etterkampbevis. Med den konservative terminalregelen er 22 komplette; 17 står igjen fordi de mangler OCR-kandidat, bare har svak/perifer omtale, har tidsmessig uforenlig rapportklassifisering eller har konflikt.

Serie og cup ga 19 koblede kilder av 21 kamper: 18 OCR-korrelasjoner og én konfliktkandidat. Treningskampene ga 12 av 18. Av de 31 valgte utgavene lå 29 innen D-2 til D+2; to lå på D+3. Mandagsutgaven var klart viktigst: 18 av 31 valgte utgaver kom D+1.

## Faktayield

De additive skrivene tilføyde fakta til 8 kamper:

- 7 pauseresultater
- 5 publikumstall
- 2 arenaer
- 1 dommer

Ingen lagoppstillinger, spillere, målscorere, hendelser eller historiske observasjoner ble skrevet. OCR-utdrag som kunne inneholde slike data var ikke entydige nok uten faksimile eller sikker personidentitet. Resultatavviket ble bevart som `conflict_candidate`; canonical resultat ble ikke endret.

## Arbeidsmengde og kvalitet

| Mål | Antall |
| --- | ---: |
| Kandidatutgaver funnet i søkene | 136 |
| Kandidater bevart i reviewrapporten | 130 |
| Gjennomsnitt kandidater per kamp | 3,33 |
| Visuelt kontrollerte sider registrert i ledgeren | 1 |
| OCR-false positives klassifisert | 0 |
| Kandidater klassifisert som annen kamp | 0 |

De to siste nullene betyr at den automatiserte korrelasjonen ikke markerte slike tilfeller. De er ikke et mål på visuelt kontrollert feilrate. Rå OCR og søkefragmenter ligger bare i ignorert `.cache`; repoet inneholder strukturerte fakta, NB-identifikatorer, permanente lenker og korte metodenotater.

## Beslutningsport

Piloten støtter sesongvis skalering av discovery: serie-/cupdekningen er 90 prosent, 94 prosent av de koblede utgavene ligger innen femdagersvinduet, og kandidatbudsjettet er håndterbart. Automatisk canonical berikelse bør fortsatt være begrenset til lokalt forankrede skalarfelt. Personer, oppstillinger og hendelser trenger sterkere tekstgrunnlag eller faksimile.

1979 beholdes som golden production pilot. Endringer i ranking, spørringer, sjanger, datoscore, lokal binding eller faktauttrekk skal gjøre eventuelle avvik fra disse tallene synlige. Den regenererte PR #212-ledgeren fikk 10 flere `matched_existing`-saker og reduserte visuell restkø fra 627 til 617.

Maskinlesbare resultater ligger i `data/discovery/newspaper-enrichment-reviews.yaml` og `data/discovery/newspaper-enrichment-status.yaml`.
