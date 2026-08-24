# Faksimilepilot for Sunnmørsposten

Piloten kontrollerer et lite utvalg fra den datoankrede avisberikelsen mot selve
faksimilen i Nasjonalbiblioteket. Den utvider ikke retrieval-scope.

## Visuelt kontrollert

| Kamp | Utgave og side | Resultat |
| --- | --- | --- |
| AaFK–Rollon 6. juni 1915 | Søndmørsposten 7. juni, s. 3 | Kampen og 2–2 bekreftet. |
| AaFK–Brann 26. august 1917 | Søndmørsposten 27. august, s. 4 | Tidligere `no_ocr_candidate`; kampreferatet bekrefter 0–14. |
| AaFK–Drafn 3. september 1922 | Søndmørsposten 4. september, s. 3 | 3–0 (2–0) til Drafn. OCR-konflikten var pauseresultatet. |
| AaFK–Hødd 29. april 1979 | Sunnmørsposten 30. april, s. 7 | Kampreferatet bekrefter 0–1. |

Fire av fire kontrollerte kampkoblinger traff riktig utgave og kamp. Én av dem
var ikke funnet av den automatiske lokale OCR-bindingen.

## Sideadresser

NB sitt OCR-felt bruker trykt sidenummer. Dokumentviseren bruker nullbasert
`page`-parameter. En artikkel på trykt side 7 skal derfor lenkes med `?page=6`.
Dette er kontrollert i utgaver fra 1915, 1922 og 1979. Kilde- og
OCR-ledgeradressene for de 218 Sunnmørsposten-/Søndmørsposten-kildefilene i den
datoankrede løypa er korrigert uten å endre de trykte
sidetallene. Eldre `true_visual_review`-referanser er beholdt når de peker på en
annen, visuelt dokumentert side i samme utgave.

## Datoløs delpilot

To datoløse 1954-saker ble valgt, men søket på sak nummer to ble avbrutt da det
overskred pilotens tidsbudsjett. Den første saken ga et sikkert funn:

- Kildepåstand `srcclaim-dd1ea55ba0040dc0b056d5d9b7211a7d`, AaFK–Spjelkavik 3–1.
- Sunnmørsposten 12. april 1954, trykt side 3, har resultatnotisen under
  overskriften «Treningskamp».
- Kampdatoen er søndag 11. april 1954.

Dette funnet ble også kontrollert visuelt i NB-leseren. Det kan ikke
kanoniseres isolert. Review-enheten `1954|spjelkavik` inneholder
også en egen 2–2-påstand. Siblinggruppen skal behandles samlet før canonical
skriving.
