# Fixture-arkiv

Et lite, selvstendig arkiv brukt av tester og lokal utvikling.

**Kampresultatene her er konstruerte.** De er laget for å gi deterministiske svar i tester
— blant annet ett hjemmetap med seks måls margin, som er testspørsmålet portalen skal klare:

> «Når tapte vi sist med 6 mål på hjemmebane?»

Ikke bruk disse tallene til noe som helst annet. Det ekte arkivet ligger i `data/` og fylles
av innhøstingen i `packages/ingest` med kildehenvisning på hvert felt.

Fixturen er med vilje en full kopi av referansedataene i stedet for en peker til dem, slik at
en endring i det ekte arkivet ikke kan endre hva testene måler.

Bruk:

```sh
AAFK_DATA_DIR=fixtures/data pnpm validate
```
