# Bidra til AaFK-arkivet

Arkivet lever av at folk retter det. En gal dato fra 1963, en målscorer på feil lag, en
kamp som mangler helt — alt sammen er én YAML-fil å endre og én pull request å sende.
Det er hele grunnen til at dataene ligger i git og ikke i en database bak et skjema.

Du trenger ikke kunne programmere for å bidra med data. Alt du trenger for å bidra med
kode står lenger ned.

- [Meld fra uten å kode](#meld-fra-uten-å-kode)
- [Rett en kamp](#rett-en-kamp)
- [Legg til en kamp](#legg-til-en-kamp)
- [Nye klubber, stadion og konkurranser](#nye-klubber-stadion-og-konkurranser)
- [Krav til kilder](#krav-til-kilder)
- [Bidra med kode](#bidra-med-kode)
- [Nye datakilder og adaptere](#nye-datakilder-og-adaptere)
- [Commit-meldinger og pull requests](#commit-meldinger-og-pull-requests)

## Meld fra uten å kode

AI-assistert research er velkommen. En AI er ikke en kilde: bidraget må peke på konkret
dokumentasjon som et menneske kan kontrollere. MCP-innsending er bare en annen inngang til
samme GitHub-innboks og redaksjonelle vurdering som nettsiden. Den publiserer aldri selv.

Opprett en [issue](https://github.com/mlervaag/aafkstats/issues/new/choose). Det finnes egne
maler for hver slags melding:

| Mal | Når |
|---|---|
| Feil i arkivet | Gal dato, feil resultat, feil målscorer — noe som står, men står galt |
| Manglende kamp | Kampen finnes ikke i arkivet i det hele tatt |
| Ny kilde eller flere kampdetaljer | Kampen står riktig, men tynt: målscorere, lagoppstilling, tilskuertall, avisreferanse |
| Ny eller feil kilde i kildearkivet | Bok, medlemsblad, avisarkiv eller rettelse til en kildeoppføring |
| Klubbidentitet eller historisk navn | Dublett, sammenslåing, navneperiode, kamp ført på feil klubb |
| Feil i koden eller på nettstedet | Noe krasjer, ser rart ut eller oppfører seg feil |
| Forslag eller spørsmål | Alt annet — blanke issues er slått av |

Det viktigste i en datamelding er **hva som er galt, hva som er riktig, og hvor du vet det
fra** — uten kilde blir det stående som en påstand mot en annen påstand.

## Rett en kamp

Hver kamp er én fil, og filnavnet er kampens ID:

```
data/seasons/2019/matches/2019-06-19-aalesunds-fk-molde-fk.yaml
     └─ sesong          └─ YYYY-MM-DD-hjemmelag-bortelag
```

Framgangsmåte:

```sh
# 1. Fork og klon, eller rediger filen direkte i GitHub-grensesnittet
pnpm install

# 2. Rett filen
$EDITOR data/seasons/2019/matches/2019-06-19-aalesunds-fk-molde-fk.yaml

# 3. Sjekk at arkivet fortsatt validerer
pnpm validate
```

`pnpm validate` leser hele arkivet, sjekker hver fil mot skjemaet og kontrollerer
referanser, duplikater og filnavn. Den skriver ut hvilken fil og hvilket felt som er galt,
så feilmeldingen er stort sett svaret på hva som må gjøres.

Endrer du en opplysning, skal `sources` si hvor den nye verdien kommer fra:

```yaml
sources:
  - sourceId: nasjonalbiblioteket
    url: https://www.nb.no/items/…
    retrievedAt: 2026-08-03
    fields: [attendance, referee]     # hvilke felt denne kilden dekker
```

Feltreferansen — hvert felt, hva det betyr og hvilke regler som gjelder — står i
[docs/DATAMODELL.md](docs/DATAMODELL.md).

### Når kildene er uenige

Ikke velg i stillhet. Uenigheten er en opplysning i seg selv, og den har et eget felt:

```yaml
confidence: disputed
conflicts:
  - field: attendance
    values:
      - { value: 4210, sourceId: rsssf }
      - { value: 4200, sourceId: nasjonalbiblioteket }
    resolved: false
    note: Avisreferatet runder trolig av.
```

`confidence: disputed` uten minst én oppføring i `conflicts` avvises av skjemaet.

## Legg til en kamp

Bare seks felt er påkrevd: `id`, `date`, `status`, `competition`, `home.clubId` og
`away.clubId`. En kamp fra 1930 der vi bare kjenner dato og motstander hører hjemme i
arkivet med `confidence: probable` — det er bedre enn å holdes utenfor til noen har full
oversikt.

```yaml
id: 1930-06-15-aalesunds-fk-brann          # må starte med datoen, og være filnavnet
date: 1930-06-15
dateConfidence: exact                       # exact | month | year
status: played                              # played krever resultat på begge lag
competition:
  id: nm
  season: 1930
  stage: round_of_32
home:
  clubId: aalesunds-fk
  score: 1
away:
  clubId: sk-brann
  score: 3
confidence: probable
sources:
  - sourceId: rsssf
    url: https://www.rsssf.no/…
    retrievedAt: 2026-08-03
    fields: [date, home.score, away.score]
```

Kjenner du bare måneden, settes `date` til første dag i perioden og `dateConfidence: month`.
Nøyaktig én av sidene må være `aalesunds-fk` — det er invarianten hele AaFK-perspektivet i
databasen hviler på.

## Nye klubber, stadion og konkurranser

En kamp kan bare peke på klubber, stadion og konkurranser som finnes fra før; valideringen
sier fra med filnavnet som mangler. Nye oppføringer legges i `data/clubs/`, `data/venues/`
eller `data/competitions/`, med ID = filnavn = slug (små bokstaver, tall og bindestrek; æ→ae,
ø→o, å→a).

Har navnet endret seg underveis, skal `names` fange det:

```yaml
id: aalesunds-fk
name: Aalesunds FK
names:
  - { name: Aalesunds Fotballklub, from: null, to: "1927-12-31" }
  - { name: Aalesunds FK, from: "1928-01-01", to: null }
```

Da viser en kamp fra 1917 navnet som gjaldt i 1917. Det samme gjelder konkurranser
(Hovedserien → 1. divisjon → Tippeligaen → Eliteserien er én konkurranse med fire navn) og
stadion.

## Krav til kilder

**Referat skrives alltid for dette arkivet.** Tekst fra Sunnmørsposten, aafk.no, NTB eller
andre kopieres aldri inn — heller ikke omskrevet setning for setning. Originalen lenkes fra
`externalReports` med utgiver og dato. Fakta er frie, tekst er det ikke; detaljene står i
[DATA_LICENSE.md](DATA_LICENSE.md).

Bidrag du selv har skrevet, legges inn under kilden `contribution`, og du beholder
opphavsretten til teksten samtidig som du gir arkivet rett til å publisere den under
[CC BY 4.0](DATA_LICENSE.md).

Vil du bruke en kilde som ikke finnes i `data/sources/`, må den legges inn med
rettighetsstatus først — se [Nye datakilder og adaptere](#nye-datakilder-og-adaptere).

## Bidra med kode

```sh
pnpm install
AAFK_DATA_DIR=fixtures/data pnpm db:build   # bygg testarkivet
pnpm dev                                    # http://localhost:3000
```

Før du sender pull request skal alt dette være grønt — det er nøyaktig det CI kjører:

```sh
pnpm validate
AAFK_DATA_DIR=fixtures/data pnpm validate
pnpm typecheck
pnpm lint
pnpm test
```

Testene trenger ingen tjeneste. De bygger sin egen arkivfil fra `fixtures/data` i `beforeAll`,
så de kjører likt lokalt og i CI. Bruk fixture-arkivet — aldri `data/` — når en test trenger
et bestemt resultat: fixturene er konstruert nettopp for å gi deterministiske svar, og ekte
kamper endrer seg når arkivet vokser.

Hvor koden hører hjemme:

| Endring | Pakke |
|---|---|
| Nytt felt i datamodellen, ny valideringsregel | [`packages/schema`](packages/schema/README.md) |
| SQLite-skjema, views, byggesteget, SQL-guardrails | [`packages/db`](packages/db/README.md) |
| Ny kilde, parser, reconcile | [`packages/ingest`](packages/ingest/README.md) |
| Datasettdokumentasjon, verktøy, systemprompt | [`packages/query`](packages/query/README.md) |
| Sider, komponenter, API-ruter | [`apps/web`](apps/web/README.md) |

### Stil

Norsk i kommentarer, commit-meldinger, feilmeldinger og grensesnitt. Koden er ellers
alminnelig TypeScript i strict-modus.

Kommentarer forklarer **hvorfor**, ikke hva. En kommentar som gjentar linjen under seg er
støy; en som forklarer at `node:sqlite` hentes via `createRequire` fordi bundlere ellers
leter etter en npm-pakke som ikke finnes, sparer neste person for en time. Er valget
overraskende, skriv ned hva alternativet var og hvorfor det ikke ble brukt.

Legger du til et felt i datamodellen, hører det som regel hjemme fire steder: skjemaet i
`packages/schema`, tabellen og viewet i `packages/db/src/schema.sql`, byggesteget i
`packages/db/src/build.ts`, og datasettdokumentasjonen i `packages/query/src/dataset.ts`.
Glemmer du det siste, feiler testen som sammenligner dokumentasjonen med den faktiske
databasen — det er meningen.

## Holde sesongen à jour

```sh
pnpm etter-kamp                                  # tørrkjøring: hva mangler, og hva ville skjedd
pnpm etter-kamp -- --retrieved-at ÅÅÅÅ-MM-DD --write
```

Rutinen gjør to ting. Den henter kampfakta for våre egne kamper som står på
terminlista med passert dato, og den henter tabellen for hver seriesesong som ikke er
ferdigspilt. Det andre skjer uansett om vi har spilt: tabellen flytter seg hver gang to
andre lag møtes.

Den kan derfor kjøres på et fast skjema. Har ingenting endret seg, skrives ingenting — en
ny hentedato alene teller ikke som en endring. Er en kamp ikke ferdigspilt hos kilden,
hopper rutinen over den og sier fra.

Kampen kjennes igjen på kildens ID, ikke på datoen. Blir en kamp flyttet etter at
terminlista er arkivert, finner rutinen den likevel — og siden kamp-ID-en er bygget av
datoen, skrives kampen på ny fil og den gamle datofila fjernes i samme kjøring.

Etterpå: `pnpm db:build && pnpm validate`, og commit YAML-diffen. Arkivfilen bygges av CI
og skal ikke committes.

Kadensen hører ikke hjemme i repoet. Prosjektets begrunnelse for å hente fra FotMob er et
avgrenset uttrekk, ikke regelmessig høsting — se `permissionNote` i
`data/providers/fotmob.yaml`. Skal rutinen kjøres jevnlig, styr det utenfra.

### Nye spillere i kamptroppen

```sh
pnpm data:new-players                  # siste 30 dager
pnpm data:new-players -- --sesong 2026
pnpm data:new-players -- --alle
```

Kamptroppene kommer inn automatisk etter hver kamp; overgangene føres for hånd fra en
kilde som må finnes først. De to går derfor ut av takt på ett punkt: et navn står i en
oppstilling uten at noen har ført inn hvordan spilleren kom til klubben. Rapporten peker
på debutantene og skiller de tre tilfellene fra hverandre — overgangen finnes, personfila
finnes uten overgang, eller navnet har ingen personfil.

Den henter ingenting og skriver ingenting, og sluttkoden er alltid 0. En manglende
overgang er ikke en datafeil: kilden kan mangle, og en spiller kan være hentet opp fra
egen ungdomsavdeling uten at noen skrev om det. Er den ført, skal den ha kilden som sa
den — se `ingest:wikipedia-transfers` og `ingest:nb-transfer-candidates` for kandidater.

Kjøres den etter `pnpm etter-kamp`, er vinduet nettopp de kampene som kom inn.

## Nye datakilder og adaptere

Les [kildekartet](docs/research/KILDEKART_OG_INNHENTINGSSTRATEGI.md) før du skriver noe.
Flere av de opplagte kildene er røde, og grunnen står der.

Reglene rundt innhøsting er ikke stilspørsmål:

1. **En adapter er ikke en crawler.** Hver kjøring navngir kilde, konkurranse og sesong
   eksplisitt. Det finnes ingen kommando som oppdager alle sesonger og starter en full
   backfill, og det skal ikke lages en.
2. **Tørrkjøring er standard.** `--write` er et eget valg som skriver YAML, aldri direkte
   til databasen. PR-diffen er siste kontroll før data havner på nettstedet.
3. **Rettighetsstatus er data.** Kilden må ligge i `data/sources/` med `automatedAccess` og
   `publicRedistribution` satt før første nettverkskall. Tørrkjøring krever at kilden kan
   hentes; `--write` krever i tillegg at den kan publiseres. `unknown` er aldri et ja, og
   det finnes ikke noe flagg som slår av porten.
4. **Cache alt du henter.** `.cache/` er git-ignorert. En parser skal kunne utvikles og
   testes uten å treffe kilden på nytt.
5. **Fest formatet i en fixture.** Legg et representativt utdrag i
   `packages/ingest/test/fixtures/` og test parseren mot det. Kildeformater endrer seg
   stille, og en fixture er den eneste måten å oppdage det på.

## Commit-meldinger og pull requests

Commit-meldinger er norske, i imperativ, og sier hva endringen gjør:

```
Høst kamper tilbake til 1917
Gjør kildepolicy til data, og la den stoppe skriving
Rett tilskuertallet i 1998-cupkampen mot Brann
```

Ingen prefikser, ingen `feat:`/`fix:`. Er endringen verdt en forklaring, hører den hjemme i
brødteksten — særlig hvis du har valgt bort et alternativ underveis.

I pull requesten: si hva som er endret og hvordan det er kontrollert. Er det en datarettelse,
skal kilden være med. Er det kode, skal `pnpm validate`, `pnpm typecheck`, `pnpm lint` og
`pnpm test` være grønne. CI kjører det samme, men det er raskere å oppdage selv.

Deltakelse i prosjektet skjer under [Code of Conduct](CODE_OF_CONDUCT.md).
Sikkerhetsproblemer meldes etter [SECURITY.md](SECURITY.md), ikke som en vanlig issue.
