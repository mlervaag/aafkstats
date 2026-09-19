# Jev-pilot for Sunnmørsposten-OCR

Piloten måler om Jev kan rangere brede OCR-treff slik at flere ekte AaFK-funn
kommer tidlig i den manuelle kontrollkøen. Den endrer aldri arkivdata og gjør
ingen live-søk hos Nasjonalbiblioteket.

## Beslutning

Status per 19. september 2026: Jev er godkjent som et assisterende rangerings-
og triagelag etter bred NB-retrieval, men ikke som erstatning for retrieval,
deterministiske regler eller menneskelig kildekontroll. Ingen kandidat skal
slettes eller permanent forkastes på grunnlag av Jev-score.

Råholdouten med `jev-1.13.0` ga 98,8 prosent recall, 96,4 prosent precision og
97,2 prosent støyreduksjon på test-splittet. De 50 øverste testkandidatene var
alle relevante. Den development-kalibrerte terskelen `0.5865` kan derfor brukes
til prioritering av kontrollkøen, men er ikke en sletteterskel.

Fasiten i råholdouten er delvis konstruert fra deterministiske signaler og er
ikke et fullstendig, blindmerket menneskesett. Før automatisk nedprioritering
eller forkasting vurderes, må terskelen valideres mot et uavhengig blindmerket
utvalg. Hvis TypeSafe er utilgjengelig, fortsetter discovery med dagens
deterministiske rangering; Jev er ikke en driftskritisk avhengighet.

## Hva piloten bruker

Datasettet bygges ved hver kjøring fra to allerede versjonerte kilder:

- 22 faksimilekontrollerte NB-saker i
  `packages/ingest/test/fixtures/nb-newspaper-ground-truth.yaml`
- et ekte NB-søkesnapshot fra Sunnmørsposten i september 1935 i
  `packages/ingest/test/fixtures/nb-newspaper-search-1935-09.json`

Det gir 87 tekstfragmenter: 25 relevante, 59 harde negativer og 3 usikre. Av
disse er 24 relevante fragmenter korte, faksimilekontrollerte ground-truth-
utdrag, mens det ekte rå-OCR-snapshotet bidrar med ett relevant, 59 negative og
3 usikre fragmenter. Negativene kommer fra det samme søket som det ekte funnet,
og består derfor også av stedsnavnet Aalesund, annonser og fotball om andre
klubber. De er mer realistiske enn tilfeldig avisstøy.

Fragmentene splittes deterministisk per kamp eller avisutgave. Fragmenter fra
samme gruppe kan aldri havne både i development- og testsettet. De tre usikre
fragmentene vises i rapporten, men brukes ikke til å velge terskel eller måle
binær treffsikkerhet.

## API-nøkkel

Kopier eksempel-filen i repo-roten:

```powershell
Copy-Item .env.jev.example .env.jev.local
```

Legg nøkkelen i den lokale filen:

```dotenv
TYPESAFE_API_KEY=din_nøkkel
```

`.env.jev.local` treffes av repoets `.env*.local`-regel og blir ikke lagt i Git.
En allerede satt `TYPESAFE_API_KEY`-miljøvariabel har prioritet over filen.

## Kjøring

Kontroller først datasettet helt uten nettverk eller nøkkel:

```powershell
pnpm research:jev-newspaper-pilot -- --dry-run
```

Kjør deretter hele piloten:

```powershell
pnpm research:jev-newspaper-pilot
```

Nyttige valg:

```powershell
# Billig smoke-test på de første fem fragmentene
pnpm research:jev-newspaper-pilot -- --limit 5

# Ignorer tidligere API-resultater
pnpm research:jev-newspaper-pilot -- --refresh

# Be om en bestemt modellversjon etter at første kjøring har vist versjonen
pnpm research:jev-newspaper-pilot -- --model jev-X.Y.Z

# Endre antall samtidige kall og ønsket development-recall
pnpm research:jev-newspaper-pilot -- --concurrency 2 --target-recall 0.98
```

## Cache og rapport

Alle eksterne svar checkpointes atomisk etter hvert fullførte fragment:

- `.cache/jev-newspaper/seed-cache.json`
- `.cache/jev-newspaper/seed-report.json`
- `.cache/jev-newspaper/seed-report.md`

Hele `.cache/` er ignorert av Git. Hvis en kjøring avbrytes, fortsetter neste
kjøring fra svarene som allerede er mottatt. Cache blir automatisk forkastet
når modell eller spørsmålsprotokoll endres. `--refresh` tvinger en helt ny
runde.

## Hva som måles

Jev får bare avis, dato, side og OCR-tekst. Forventet motstander, resultat,
eksisterende heuristikkscore og fasit sendes ikke til modellen. Den svarer på
tre uavhengige Noul-spørsmål:

1. om fragmentet kan være AaFK-relevant
2. om det inneholder konkrete historiske opplysninger
3. om OCR-en krever visuell kontroll

Rapporten sammenligner:

- `jev`: 65 % relevans og 35 % konkret evidens
- `baseline`: dagens deterministiske OCR-rangering
- `combined`: 70 % Jev og 30 % baseline

For hver metode velges terskelen kun på development-settet: først må ønsket
recall nås, deretter maksimeres støyreduksjonen. Den frosne terskelen måles så
på testsettet. Rapporten viser også recall@10, recall@20 og recall@50, som sier
hvor mange ekte funn en begrenset manuell kontrollrunde ville funnet.

Dette seed-settet er en integrasjonstest og en første indikasjon, ikke endelig
dokumentasjon på modellkvalitet. De fleste positive utdragene er renere enn de
rå negative OCR-vinduene. En modell kan derfor delvis skille tekstkvalitet, ikke
bare arkivverdi.

## Større rå-OCR-holdout

Den større testen bygges uten nye NB-kall fra eksisterende, lokalt cachede
Sunnmørsposten-søk og canonical-koblede avisutgaver:

```powershell
pnpm research:jev-newspaper-raw-holdout -- --dry-run
pnpm research:jev-newspaper-raw-holdout
```

Standardsettet er 420 rå fragmenter: 160 relevante, 200 høysikre negative og
60 usikre. Utvalget balanseres på tvers av tiår, og samme avisutgave kan bare
ligge i én splitt. Klare AaFK-navn i fotballkontekst og AaFK–motstander-vinduer
fra canonical-koblede utgaver er positive. Fragmenter uten AaFK-identitet,
fotballsignal eller canonical motstandersignal er negative. Avkortede og
tvetydige vinduer legges i `uncertain` og holdes utenfor binærmålingen.

Råsettets `baseline`-rad er bare en kontraktkontroll. Labelingen bruker noen av
de samme deterministiske signalene som dagens baseline, så den raden er ikke en
uavhengig modellbenchmark og kan ikke sammenlignes rettferdig med Jev. Jev får
fortsatt aldri fasit, motstander eller baseline-score i state. JSON- og
Markdown-rapporten lagres som `raw-report.*` sammen med full proveniens.

Piloten er laget som et beslutnings- og rangeringslag, ikke som en automatisk
slettemekanisme. Før produksjonsbruk bør et menneske merke et tilfeldig uttrekk
av både beholdte, forkastede og usikre fragmenter uten å se Jev-score, og den
frosne terskelen bør valideres på dette uavhengige settet.
