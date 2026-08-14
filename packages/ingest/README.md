# @aafkstats/ingest

Innhøsting fra eksterne kilder til YAML. Aldri direkte til databasen — den eneste veien inn i
arkivet går gjennom en PR-diff et menneske har sett.

```
src/
├── policy.ts       Rettighetsporten: kan hentes ≠ kan publiseres
├── http.ts         Henting med fartsgrense, retry, timeout og cache på disk
├── ids.ts          Slugifisering og kamp-ID
├── types.ts        SourceMatch: kildens flate mellomformat
├── reconcile.ts    Deterministisk skriveplan mot dagens arkiv
├── report.ts       Kjøringsrapport
├── adapters/       fotmob · rsssf · rsssf-discover · sfk-årsrapporter
└── cli/            En kommando per adapter
```

## Reglene

Dette er ikke stilspørsmål. De står også i
[CONTRIBUTING.md](../../CONTRIBUTING.md#nye-datakilder-og-adaptere), og de gjelder enhver ny
kilde:

1. **En adapter er ikke en crawler.** Hver kjøring navngir kilde, konkurranse og sesong
   eksplisitt. Det finnes ingen kommando som oppdager alle sesonger og starter en full
   backfill, og det skal ikke lages en.
2. **Tørrkjøring er standard.** `--write` er et eget valg, og skriver YAML.
3. **Rettighetsstatus er data.** Kilden må ligge i `data/providers/` med `automatedAccess` og
   `publicRedistribution` satt. Porten står før nettverkskallet, og `unknown` er aldri et ja.
4. **Cache alt.** `.cache/ingest/` er git-ignorert. En parsefeil skal kunne rettes uten en ny
   runde mot kilden.
5. **Fest formatet i en fixture.** `test/fixtures/` inneholder representative utdrag.
   Kildeformater endrer seg stille; en fixture er den eneste måten å oppdage det på.

## Flyten

```
arkivet lastes og valideres        ← nekter å høste inn i et ødelagt arkiv
  ↓
assertMayFetch(kilde)              ← før nettverket
  ↓
adapter: hent + normaliser         ← cache på disk, 1 forespørsel/sek per vert
  ↓
reconcile(arkiv, kamper, …)        ← deterministisk plan, tvetydigheter blir issues
  ↓
rapport                            ← tørrkjøring stopper her
  ↓
assertMayPublish(kilde) → writePlan(…)
```

`reconcile()` oppdaterer bare kamper som allerede har samme kilde-ID. En kamp en annen kilde
eier, stopper kjøringen — eller hoppes over og telles, med `--skip-existing`. Hver kamp har
nøyaktig én kilde: et observasjonslag som kan slå sammen flere kilder per felt er ikke bygget
ennå, og en stille sammenslåing ville skjult hvem som mente hva.

## Kommandoer

```sh
# Kartlegg hva RSSSF har. Skriver aldri data.
pnpm ingest:rsssf-discover -- --from 1980 --to 2009

# Kartlegg tekstlag og AaFK-treff i SFKs årsrapporter. Skriver bare arbeidsmanifest
# i ignorert cache og en eksplisitt valgt dekningsrapport.
pnpm ingest:sfk-annual-report-analysis -- \
  --report docs/data/SFK_ARSRAPPORTER_DEKNING.md

# Én divisjon i én sesong. Tørrkjøring.
pnpm ingest:rsssf -- --season 1998 --division First --competition forstedivisjon

# Én FotMob-sesong, med detaljoppslag på de fem første kampene.
pnpm ingest:fotmob -- --league 203 --season 2025 --competition forstedivisjon \
  --with-details --details-limit 5 --limit 30

# Kartlegg hele den tilgjengelige AaFK-historikken i et avgrenset vindu.
# Skriver rapporter, men aldri kampdata uten eksplisitt --write og kamp-ID-er.
pnpm ingest:fotmob-gap -- --from 1902-01-01 --to 2013-12-31 \
  --report-json artifacts/fotmob-gap.json --report-md artifacts/fotmob-gap.md

# Importer bare ferdig kontrollerte kamp-ID-er.
pnpm ingest:fotmob-gap -- --from 2010-01-01 --to 2012-12-31 \
  --match-ids 870503,870521 --class europe --competition europa-liga \
  --retrieved-at 2026-08-09 --write

# Cup over kalenderår: kampdatoen er i 2026, men arkivsesongen er NM 2025.
pnpm ingest:fotmob-gap -- --from 2026-01-01 --to 2026-06-30 \
  --match-ids 4989786,5231038,5266350 --class cup --competition nm \
  --season 2025 --retrieved-at 2026-08-12 --write

# Eliteseriekvalifisering får stadiet relegation_playoff i arkivet.
pnpm ingest:fotmob-gap -- --from 2018-11-01 --to 2018-12-31 \
  --match-ids 2927109,2937540,2940798,2940799 \
  --class qualification --competition eliteserien \
  --retrieved-at 2026-08-12 --write

# Foreslå en personfil fra én eksakt Wikipedia-profil. Tørrkjøring.
pnpm ingest:wikipedia-profile -- \
  --player "Fredrik Ulvestad" --title "Fredrik Ulvestad"

# Engelsk Wikipedia kan velges når norsk side ikke finnes. Bruk --write først
# etter at identitet, fakta og eventuelle KONTROLL-linjer er vurdert.
pnpm ingest:wikipedia-profile -- \
  --player michael-barrantes --title "Michael Barrantes" --lang en --write

# Oppdag FotMob-kandidater for én spiller. Denne modusen skriver aldri.
pnpm ingest:fotmob-profile -- --player "Fredrik Ulvestad" --discover

# Verifiser én valgt profil. Skriving krever i tillegg eksplisitt hentedato.
pnpm ingest:fotmob-profile -- \
  --player "Fredrik Ulvestad" --fotmob-id 180283
pnpm ingest:fotmob-profile -- \
  --player "Fredrik Ulvestad" --fotmob-id 180283 \
  --retrieved-at 2026-08-12 --write
```

| Flagg | Gjelder | Betydning |
|---|---|---|
| `--write` | rsssf, fotmob, fotmob-gap, fotmob-profile | Skriver YAML. Krever `--retrieved-at` |
| `--retrieved-at ÅÅÅÅ-MM-DD` | rsssf, fotmob, fotmob-gap, fotmob-profile | Hentedato i kildehenvisningen. Påkrevd ved `--write` for reproduserbare differ |
| `--limit N` | rsssf, fotmob | Tak på antall kamper i kjøringen |
| `--refresh` | alle | Hopper over cachen |
| `--player`, `--title`, `--lang` | wikipedia-profile | Én kjent arkivspiller og én eksakt profilside. Ingen personsøk eller massejobb |
| `--player`, `--discover`, `--fotmob-id` | fotmob-profile | Søker etter eller verifiserer én kjent arkivspiller. `--write` krever valgt ID |
| `--skip-existing` | rsssf | Lar kamper en annen kilde eier stå i fred |
| `--with-details` | fotmob | Henter hendelser, lagoppstilling og statistikk |
| `--details-limit N`, `--details-offset N` | fotmob | Avgrenser detaljoppslagene |
| `--allow-partial` | fotmob | Godtar en ufullstendig høsting. Kun etter manuell kontroll |
| `--report FIL` | fotmob, rsssf-discover, sfk-annual-report-analysis | Skriver kjøringsrapporten til fil |
| `--year`, `--from`, `--to` | sfk-annual-report-analysis | Avgrenser den tekniske PDF-kartleggingen |
| `--from`, `--to`, `--max-pages` | fotmob-gap | Obligatorisk tidsvindu og hardt sidetak for klubbhistorikken |
| `--report-json`, `--report-md` | fotmob-gap | Maskinlesbar og menneskelesbar gap-rapport |
| `--match-ids`, `--class`, `--competition` | fotmob-gap | Eksplisitt, kontrollert import; alle tre kreves ved `--write`. Klasse kan være `europe`, `friendly`, `cup` eller `qualification` |
| `--season ÅÅÅÅ` | fotmob-gap | Overstyrer arkivsesongen eksplisitt, for eksempel for NM som fortsetter neste kalenderår |

Alle kjøringer laster og validerer arkivet først. Er det allerede feil i `data/`, stopper
kommandoen — å høste inn i et ødelagt arkiv gjør bare feilsøkingen vanskeligere.

## Kildene i bruk

| Adapter | Kilde | Periode | Gir |
|---|---|---|---|
| `fotmob` | FotMob | 2010→ | Kampfakta, hendelser, lagoppstillinger, statistikk, tilskuertall |
| `fotmob-gap` | FotMob | 2010→ | Paginert klubbdiscovery, tolerant arkivtreff og eksplisitt gap-import |
| `fotmob-profile` | FotMob | Én spiller per kjøring | Kandidater, navnekontroll, AaFK-periode, hovedposisjon og land |
| `rsssf` | RSSSF Norway | ←2009 | Dato, lag, resultat, runde |
| `rsssf-discover` | RSSSF Norway | 1902→ | Kartlegging: hvilke sider finnes, og hva de inneholder |
| `sfk-annual-reports` | Sunnmøre Fotballkrets | 1952→ | Discovery og konservativ katalogføring av årsrapportserien |
| `sfk-annual-report-analysis` | Sunnmøre Fotballkrets | 1952→ | Cachet PDF-måling, tekstlag, AaFK-treff og triagesignaler uten OCR |
| `wikipedia-profile` | Wikipedia | Én spiller per kjøring | Manglende personfil, posisjon, nasjonalitet og Wikidata-peker fra infoboks/sideegenskaper |

Dekningen er dokumentert for seg: [FotMob-dekningstaket](../../docs/data/FOTMOB_DEKNINGSTAK.md)
og [RSSSF-dekningen](../../docs/data/RSSSF_DEKNING.md). Begge sier hvor kilden slutter og
hvorfor.

**Før du skriver en ny adapter:** les
[kildekartet](../../docs/research/KILDEKART_OG_INNHENTINGSSTRATEGI.md). Flere av de opplagte
kildene er røde, og grunnen står der.

## Verdt å vite

**Adapteren avgjør ingen arkiv-ID-er.** Den produserer `SourceMatch` — kildens flate
mellomformat, med kildens egne navn og ID-er. Koblingen mot arkivets klubber, stadion og
kamper skjer i `reconcile()`, ett sted, med aliaser som mekanisme.

**Fartsgrensen er per vert**, 1,1 sekund mellom forespørslene, med retry og 20 sekunders
tidsgrense for tekst. Store PDF-er får 60 sekunder. Tekst og binærdata bruker samme atomiske
cache, så en avbrutt kjøring ikke etterlater halve svar.

**Spillerprofiler fra Wikipedia er en kontrollert berikelse, ikke et biografisøk.**
Kommandoen krever både en spiller som allerede finnes i personregisteret eller en
AaFK-lagoppstilling, og en eksakt Wikipedia-tittel. Den leser bare navngitte
infoboksrader og sidens Wikidata-peker. Brødtekst, fødselsdato, klubbhistorikk og
dagens draktnummer kopieres ikke. Eksisterende fakta overskrives aldri; motstrid
blir en `KONTROLL` som stopper `--write`.

**FotMob-profiler bruker to separate beslutninger.** `--discover` søker bare på
navnet som allerede finnes i arkivet og viser kandidat-ID-er; den skriver aldri.
En ny kjøring med `--fotmob-id` henter valgt profil og krever at FotMobs
karrierehistorikk faktisk inneholder Aalesund (`teamId 8404`) før profilen kan
knyttes til personen. Bare navn, hovedposisjon og land kan føres. Fødselsdato,
markedsverdi, karrierestatistikk og løpende klubbdata kopieres ikke. FotMob har
uavklart offentlig gjenbruk og brukes under den eksplisitte risikovurderingen i
`data/providers/fotmob.yaml`; derfor er hver kjøring avgrenset til én spiller.

**Datoarv er den vanligste feilkilden i RSSSF-parseren.** Datoen står på den første kampen i
en gruppe og gjelder nedover til neste dato. Leses det feil, får en hel runde samme dato — og
ingenting i ettertid avslører det, fordi resultatene fortsatt stemmer. Derfor er arven testet
for seg.
