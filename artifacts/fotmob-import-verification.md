# Verifikasjon av FotMob-gapimport

Kontrollert 9. august 2026.

## Europacup

[UEFAs klubbhistorikk for AaFK](https://www.uefa.com/uefaeuropaleague/history/clubs/82819--aalesund/)
oppgir 2 kamper i 2010/11, 8 i 2011/12 og 4 i 2012/13. Arkivet har nå nøyaktig de samme
14 kvalifiseringskampene:

| Sesong | Motstandere | FotMob-ID-er |
| --- | --- | --- |
| 2010 | Motherwell | 870503, 870521 |
| 2011 | Neath Athletic, Ferencváros, Elfsborg, AZ Alkmaar | 1029407, 1029408, 1030098, 1030101, 1064489, 1064492, 1090108, 1090147 |
| 2012 | KF Tirana, APOEL | 1240585, 1240706, 1275974, 1275975 |

Hver kamp har FotMob-ID, kamp-URL, hentedato og en separat rå/normalisert observasjon.
Ekstraomgangen mot Ferencváros er splittet fra ordinær tid.

## Kontrollerte treningskamper

Fem eksplisitt prioriterte kamper er importert separat:

- 27. januar 2011: AaFK–Wisła Kraków 2–0 (971182)
- 30. januar 2012: AaFK–Shakhtar Donetsk 2–2, 3–5 på straffer (1161481)
- 2. februar 2012: AaFK–Kalmar FF 3–2 (1162111)
- 29. januar 2013: AaFK–Skarbøvik 7–0 (1403778)
- 18. februar 2013: AaFK–Kalmar FF 2–1 (1388637)

De øvrige 19 treningskampkandidatene står i gap-rapporten og er utsatt til uavhengig
kryssvalidering. Fordi `treningskamp` har konkurransetype `friendly`, holdes disse kampene i
egne sesongaggregater og blandes ikke med serie, cup eller europacup.
