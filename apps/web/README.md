# @aafkstats/web

Portalen. Next.js 15 med App Router, servert fra Vercel på
[aafkstats.vercel.app](https://aafkstats.vercel.app).

```
app/
├── page.tsx              Forsiden: søkefelt, siste kamper, dekningsnotat
├── kamp/[id]/            Kampsiden: resultat, hendelser, lagoppstilling, kilder
├── sesong/[year]/        Sesongen, per konkurranse
├── sesonger/             Alle sesonger
├── motstander/[id]/      Innbyrdes historikk
├── motstandere/          Alle motstandere
├── data/                 Datasettdokumentasjonen, rendret fra @aafkstats/query
├── om/                   Om arkivet, kilder og rettighetsstatus
├── bidra/                Hvordan bidra, med ferdige prompts
└── api/
    ├── search/           Direktesøk. Ren SQL, ingen modell
    └── chat/             Spørrefunksjonen. SSE-strøm, verktøyløkke mot Claude

lib/
├── archive.ts       Oppslagene sidene bruker
├── search.ts        Parsing og spørring for direktesøket
├── chat-request.ts  Grensene på det klienten sender inn
├── rate-limit.ts    Rate-limiting og logging
├── analytics.ts     Hva som telles, og hva som aldri gjør det
├── prompts.ts       Ferdige prompts for bidragsytere
├── thinking.ts      Tenkeord på sunnmørsk
└── score.ts         Formatering av resultater
```

## Kom i gang

```sh
AAFK_DATA_DIR=fixtures/data pnpm db:build   # arkivfilen må finnes først
pnpm dev                                    # http://localhost:3000
```

Uten `ANTHROPIC_API_KEY` svarer `/api/chat` med 503, og resten av nettstedet virker som
normalt. Se [`.env.example`](../../.env.example).

## Hvordan data kommer inn

Sidene leser arkivfilen direkte gjennom `@aafkstats/db`, på serveren, ved forespørsel
(`dynamic = "force-dynamic"`). Filen er lokal, skrivebeskyttet og allerede varm, så det er
billig — og det finnes ikke et byggetidsledd som kan komme i utakt med dataene.

Arkivfilen må spores inn i funksjonsbunten for å finnes i produksjon. Det er
`outputFileTracingIncludes` i [`next.config.mjs`](next.config.mjs), sammen med to andre
tilpasninger som er kommentert der de står: `node:sqlite` må merkes som ekstern for webpack,
og `.js`-importer må kunne løses til `.ts` fordi arbeidspakkene distribueres som kilde.

## De to API-rutene

**`/api/search`** er direktesøket i hovedfeltet. Ren SQL mot arkivfilen, ingen modell
involvert: skriver du «molde 2019» blir årstallet et sesongfilter og resten et navnesøk.
Treffene vises mens du skriver; Enter sender i stedet spørsmålet til AI-søket.

**`/api/chat`** er spørrefunksjonen. Den kjører verktøyløkka mot Claude (Sonnet 5, maks fem
runder), streamer svaret som SSE, og viser SQL-en ved siden av svaret. Verktøyene og
systemprompten kommer fra [`@aafkstats/query`](../../packages/query/README.md); grensene rundt
SQL-en fra [`@aafkstats/db`](../../packages/db/README.md#guardrailen).

Modellen kan overstyres med `AAFK_CHAT_MODEL` for å prøve noe annet uten å deploye på nytt.
Vær oppmerksom på at kallet forutsetter adaptiv tenkning og `effort` i `output_config` — en
eldre modell som ikke støtter begge deler, krever kodeendring.

Grensene på det klienten sender inn ligger i [`lib/chat-request.ts`](lib/chat-request.ts), med
egne tester: 1 000 tegn per spørsmål, seks meldinger og 12 000 tegn historikk, og en kropp som
leses med et tak på 64 kB. Uten det siste er de andre grensene rådgivende — da har vi lest og
parset alt før første kontroll kjører. Ruten avviser også POST fra andre nettsteder: det
finnes ingen innlogging å misbruke, men `Content-Type: text/plain` gjør en POST til en «simple
request» uten forhåndssjekk, og da kan en fremmed side sette sine besøkendes nettlesere til å
tømme API-budsjettet.

### Rate-limiting

Delt i to, og ingen av delene ligger i datasettet:

1. **Vercel Firewall** teller per IP ute på kanten, før koden kjører.
2. **Utgiftstaket i Anthropic Console** er det harde kostnadsgulvet.

Uten Firewall (lokalt, eller på Hobby) faller vi tilbake til en teller i minnet på ti spørsmål
i timen. Den er en fartsdump, ikke en mur: hver instans har sin egen, så en fordelt avsender
kommer forbi. Det er akseptabelt nettopp fordi utgiftstaket ligger under.

Avsenderen leses fra de plattformsatte hodene først (`x-vercel-forwarded-for`, `x-real-ip`).
Faller vi ned på `x-forwarded-for`, tas den *siste* oppføringen — den er lagt på av leddet
nærmest oss, mens den første er den avsenderen selv kunne finne på å sette. Kartet har et
hardt tak på antall avsendere, så en strøm av nye ikke får det til å vokse i det uendelige.

Hvert spørsmål logges som strukturert JSON til Vercel Logs — spørsmålet, SQL-en modellen
skrev, tokenforbruk og varighet. **IP-en logges aldri.** Vi trenger ikke vite hvem som spurte
for å se hva som spørres om.

## Detaljene som er lette å overse

**Ventetiden er brukt til noe.** Mens svaret lastes bytter `ThinkingLine` ut «Tolker
spørsmålet …» med tenkeord på sunnmørsk. [`lib/thinking.ts`](lib/thinking.ts) forklarer hvor
ordene kommer fra, og hvorfor hvert av dem står i den formen kilden ga det — forrige runde
ble skrevet fra hukommelsen, og seks av formene var gale på en måte en lokal leser ville sett
med en gang.

**Bidragssiden gir bort formatet.** `/bidra` inneholder ferdige prompts man kan lime inn i sin
egen modell, slik at den som vet noe om en gammel kamp slipper å lære seg YAML-strukturen,
slug-reglene og PR-flyten først. Modellen gjør formatet, mennesket står for kildene.

**Rettighetsstatusen vises offentlig.** `/om` rendrer `sources`-viewet med
`automatedAccess`, `publicRedistribution` og `permissionStatus` slik de står i dataene. Et
arkiv som lever av etterprøvbarhet bør ikke gjemme sin egen rettighetssituasjon.

**Jugend-linja er ikke pynt uten grunn.** Ålesund brant i 1904 og ble bygget opp igjen i
jugendstil. Skillelinjene på nettstedet er hentet derfra, i stedet for en skygge.

**Målingen teller aldri spørsmålsteksten.** Tre hendelser dekker det som er verdt å vite:
at et spørsmål ble stilt, om det fikk svar eller feilet, og om noen åpnet en kamp fra
direktesøket. Lista over lovlige egenskaper er en type i [`lib/analytics.ts`](lib/analytics.ts),
ikke en konvensjon, og `Do Not Track` og `Global Privacy Control` respekteres. Et avbrutt
svar telles verken som «ok» eller «error» — brukeren gikk bare videre.
