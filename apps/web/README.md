# @aafkstats/web

Portalen. Next.js 15 med App Router, servert fra Vercel på
[aafkarkivet.no](https://aafkarkivet.no).

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
    └── chat/             Spørrefunksjonen. SSE-strøm, verktøyløkke mot modellen

lib/
├── archive.ts        Oppslagene sidene bruker
├── search.ts         Parsing og spørring for direktesøket
├── chat-request.ts   Grensene på det klienten sender inn
├── chat-followup.ts  Felles kontrakt for historikk og strukturert oppfølging
├── chat-model.ts     Hvem som svarer, og på hvilken modell
├── chat-anthropic.ts Verktøyløkka mot Claude
├── chat-openai.ts    Verktøyløkka mot GPT
├── rate-limit.ts     Rate-limiting og logging
├── analytics.ts      Hva som telles, og hva som aldri gjør det
├── prompts.ts        Ferdige prompts for bidragsytere
├── thinking.ts       Tenkeord på sunnmørsk
└── score.ts          Formatering av resultater
```

## Kom i gang

```sh
AAFK_DATA_DIR=fixtures/data pnpm db:build   # arkivfilen må finnes først
pnpm dev                                    # http://localhost:3000
```

Uten en API-nøkkel — `ANTHROPIC_API_KEY` eller `OPENAI_API_KEY` — svarer `/api/chat` med 503,
og resten av nettstedet virker som normalt. Se [`.env.example`](../../.env.example).

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

**`/api/chat`** er spørrefunksjonen. Den kjører verktøyløkka mot modellen (maks fem runder),
streamer svaret som SSE, og viser SQL-en ved siden av svaret. Et ferdig svar kan kopieres.
Ved kopiering skrives kampreferanser som lenketekst etterfulgt av hele nettadressen, slik at
meldingsapper og sosiale medier kan gjøre lenken klikkbar uten støtte for Markdown.
Når modellen finner ett vesentlig neste steg, registrerer den det med
`suggest_follow_up`; ruta sender da en egen `followup`-hendelse etter hovedsvaret. Ja-knappen
sender et konkret nytt spørsmål med høyst tre tidligere runder, mens Nei avslutter lokalt.
Verktøyene og systemprompten kommer fra [`@aafkstats/query`](../../packages/query/README.md);
grensene rundt SQL-en fra [`@aafkstats/db`](../../packages/db/README.md#guardrailen).

**`/api/contributions`** tar bare imot minner og observasjoner fra kamp-, sesong- og personsidene.
De kan sendes uten konto og blir saker i en separat GitHub-innboks. Datafeil, manglende
kamper, kampdetaljer og kildetips går ikke gjennom denne ruten; brukergrensesnittet sender
dem til hver sin issue-mal i hovedrepoet, der riktig kontekst og kontrollspørsmål følger med.

### Hvem som svarer

Arkivet er ikke bundet til én leverandør. Sett den nøkkelen du har:

| Miljøvariabel | Virkning |
|---|---|
| `ANTHROPIC_API_KEY` | Claude svarer, på `claude-sonnet-5` |
| `OPENAI_API_KEY` | GPT svarer, på `gpt-5.6-terra` |
| `AAFK_CHAT_PROVIDER` | `anthropic` eller `openai`. Avgjør når begge nøklene er satt |
| `AAFK_CHAT_MODEL` | Annen modell hos den leverandøren som er valgt |

Er begge nøklene satt uten `AAFK_CHAT_PROVIDER`, svarer Claude. Det er et valg og ikke en
tilfeldighet: systemprompten caches eksplisitt med `cache_control`, og språkreglene i prompten
er skrevet og prøvd mot Claude. OpenAI-veien er like fullverdig, bare nyere.

Standardmodellene ligger i midtsjiktet hos begge, og det er samme resonnement begge veier:
oppgaven er å lese et dokumentert skjema, velge et verktøy og skrive én SELECT. Sonnet 5
framfor Opus 5, og Terra framfor Sol — toppmodellene løser ikke dette bedre, men koster det
dobbelte. Luna og andre budsjettmodeller sparer nettopp der vi bruker: verktøyvalget og
SQL-en. [`lib/chat-model.ts`](lib/chat-model.ts) har tallene.

Løkkene er to, én per leverandør ([`lib/chat-anthropic.ts`](lib/chat-anthropic.ts) og
[`lib/chat-openai.ts`](lib/chat-openai.ts)), fordi API-ene skiller nok til at et felles lag
imellom hadde blitt en oversettelse med tap. Det som *er* felles — takene, valget av modell og
innpakkingen av verktøysvar i `<arkivdata>`, som er forsvaret mot prompt injection fra et
kampreferat, og kontrakten for strukturert oppfølging — ligger i felles kode, så det ikke kan
gjelde bare hos den ene.

Begge kall forutsetter tenkning og innsatsnivå slik den leverandøren staver det: adaptiv
tenkning og `effort` i `output_config` hos Anthropic, `reasoning.effort` hos OpenAI. En eldre
modell som mangler det, krever kodeendring og ikke bare en ny verdi i `AAFK_CHAT_MODEL`.

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
2. **Utgiftstaket hos modelleverandøren** er det harde kostnadsgulvet. Det settes i Anthropic
   Console eller på OpenAI-plattformen, avhengig av hvilken nøkkel som er i bruk.

Uten Firewall (lokalt, eller på Hobby) faller vi tilbake til en teller i minnet på ti spørsmål
i timen. Den er en fartsdump, ikke en mur: hver instans har sin egen, så en fordelt avsender
kommer forbi. Det er akseptabelt nettopp fordi utgiftstaket ligger under.

Avsenderen leses fra de plattformsatte hodene først (`x-vercel-forwarded-for`, `x-real-ip`).
Faller vi ned på `x-forwarded-for`, tas den *siste* oppføringen — den er lagt på av leddet
nærmest oss, mens den første er den avsenderen selv kunne finne på å sette. Kartet har et
hardt tak på antall avsendere, så en strøm av nye ikke får det til å vokse i det uendelige.

Hvert spørsmål gir strukturert metadata i Vercel Logs: lengde, SQL-form, leverandør,
modell, tokenforbruk og varighet. **Spørsmålstekst og IP-adresse logges aldri.** SQL-strenger
erstattes med `?`, siden de kan inneholde ord fra spørsmålet.

## Detaljene som er lette å overse

**Ventetiden er brukt til noe.** Mens svaret lastes bytter `ThinkingLine` ut «Tolker
spørsmålet …» med tenkeord på sunnmørsk. [`lib/thinking.ts`](lib/thinking.ts) forklarer hvor
ordene kommer fra, og regelen de er bygd på: hvert tenkeord er en *handling* — et verb i
notid, noe man kan se for seg at maskina holder på med mens den tenker (andøver over staden,
bøter nota, kamsar med tala) — og notidsformen er den som faktisk finnes, ikke gjettet fra
hukommelsen.

**Bidragssiden gir bort formatet.** `/bidra` inneholder ferdige prompts man kan lime inn i sin
egen modell, slik at den som vet noe om en gammel kamp eller personrolle slipper å lære seg
YAML-strukturen, slug-reglene og PR-flyten først. Modellen gjør formatet, mennesket står for kildene.

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
