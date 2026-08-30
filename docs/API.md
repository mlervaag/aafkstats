# Offentlig REST API

AaFK-arkivets REST API er gratis og skrivebeskyttet. Basen er
`https://aafkarkivet.no/api/v1`.

Den maskinlesbare kontrakten ligger på [`/api/v1/openapi.json`](https://aafkarkivet.no/api/v1/openapi.json).
Alle svar bruker datasettversjonen som bygges fra samme Git-commit som nettstedet.
En kortere innføring med ferdige eksempler finnes på
[`aafkarkivet.no/utviklere`](https://aafkarkivet.no/utviklere).

## Ruter

| Rute | Innhold |
|---|---|
| `GET /meta` | API-versjon, datasettversjon, rettigheter og dekning |
| `GET /results` | Kanoniske kamper og ukoblede kilderesultater med hvert sitt evidensnivå |
| `GET /matches` | Bare identifiserte, kanoniske kamper |
| `GET /matches/{id}` | Kamp, hendelser og eventuelt referat |
| `GET /seasons/{year}` | Sesongsummer og dekningsmerke |
| `GET /research/overview` | Det brede bildet av hva arkivet mangler |
| `GET /research/cases` | Bare publiserte, åpne verifiseringssaker |
| `GET /research/cases/{id}` | Én publisert, åpen sak |

Lister har `limit=20` som standard og maksimalt 100. Offentlige GET-svar har CORS,
cache-headere og en best-effort-grense på 300 kall per avsender per time. Et `429`-svar
har `Retry-After`. Feilsvar mellomlagres aldri. Arkivet bruker ikke Redis eller en separat
API-database, så fartsgrensen er per kjørende instans og ikke en absolutt global kvote.

## Evidens

`/results` er inngangen for spørsmål om hele historien. Hver rad har
`evidenceLevel`:

- `canonical_match` er en identifisert kamp.
- `source_claim` er resultatet en kilde oppgir uten sikker kobling til én kamp.

De to nivåene skal ikke summeres. Flere kilder med samme `resultGroupId` beskriver ett
mulig oppgjør og returneres som én rad, ikke flere kamper. `sourceCount` teller unike kilder,
mens `claims` bevarer hver originale kildepåstand og skrivemåte. Bevar også `confidence`,
`hasConflicts` og `missingFields` i visninger og analyser.

Lister og kildefelt er ekte JSON-arrays og objekter. Kampdetaljer skiller registrerte
historiske `sources` fra moderne `providers`; de to provenienstypene slås ikke sammen.

```sh
curl "https://aafkarkivet.no/api/v1/results?ranking=largest_win&limit=10"
curl "https://aafkarkivet.no/api/v1/research/cases?limit=20"
```

API-et har ingen SQL-rute, GraphQL, API-nøkler eller skrivemetoder. Rettigheter til
tredjepartskilder endres ikke fordi fakta kan leses gjennom API-et. Se
[DATA_LICENSE.md](../DATA_LICENSE.md).
