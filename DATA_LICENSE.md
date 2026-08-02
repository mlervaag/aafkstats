# Lisens for dataene

Innholdet i `data/` er lisensiert under
[Creative Commons Navngivelse 4.0 (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/deed.no).

Koden er lisensiert separat under MIT — se `LICENSE`.

## Hvorfor to lisenser

Kode og data har ulike bruksmønstre. Vi vil at hvem som helst skal kunne bygge videre på
koden uten forpliktelser, og samtidig at arkivet skal krediteres når dataene brukes andre
steder. Det er hele poenget med å samle dem.

## Opphavsrett — hva vi kan og ikke kan gjøre

Dette er den viktigste delen av dokumentet, og gjelder både mennesker og agentene som
vedlikeholder arkivet.

**Fakta er frie.** Datoer, resultater, målscorere, tilskuertall og tabellplasseringer er
opplysninger om virkeligheten, ikke åndsverk. De kan samles inn og gjengis fritt.

**Tekst er det ikke.** Kampreferat fra Sunnmørsposten, aafk.no, NTB eller andre er
opphavsrettsbeskyttet. De kan ikke kopieres inn i arkivet — heller ikke omskrevet så tett
at det i praksis er samme tekst.

Derfor gjelder:

- `report.body` og `report.summary` skal alltid være skrevet for dette arkivet.
- Originalen lenkes fra `externalReports`, med utgiver og dato.
- Korte, tydelig markerte sitat er greit (`externalReports[].quote`, maks 300 tegn).
  Gjengivelse av en hel artikkel er det ikke.
- **Wikipedia-tekst er CC BY-SA**, som smitter over på avledede verk. Wikipedia brukes til
  fakta, aldri til formuleringer.

Dette gjelder også når en agent skriver referat. Instruksen står i agentens prompt, og et
bidrag som ser kopiert ut skal avvises i PR-vurderingen.

## Kildehenvisning

Hvert felt i arkivet bærer sin egen kilde i `sources[]`, med hvilke felt kilden dekker og
når den ble hentet. `data/sources/` beskriver hver kilde, dens lisens og forbehold.

Bruker du dataene, ber vi om kreditering til «AaFK-arkivet» med lenke til prosjektet.
