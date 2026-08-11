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
├── adapters/       fotmob · rsssf · rsssf-discover
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

# Foreslå en personfil fra én eksakt Wikipedia-profil. Tørrkjøring.
pnpm ingest:wikipedia-profile -- \
  --player "Fredrik Ulvestad" --title "Fredrik Ulvestad"

# Engelsk Wikipedia kan velges når norsk side ikke finnes. Bruk --write først
# etter at identitet, fakta og eventuelle KONTROLL-linjer er vurdert.
pnpm ingest:wikipedia-profile -- \
  --player michael-barrantes --title "Michael Barrantes" --lang en --write
```

| Flagg | Gjelder | Betydning |
|---|---|---|
| `--write` | rsssf, fotmob, fotmob-gap | Skriver YAML. Krever `--retrieved-at` |
| `--retrieved-at ÅÅÅÅ-MM-DD` | rsssf, fotmob, fotmob-gap | Hentedato i `sources[]`. Påkrevd ved `--write` for reproduserbare differ |
| `--limit N` | rsssf, fotmob | Tak på antall kamper i kjøringen |
| `--refresh` | alle | Hopper over cachen |
| `--player`, `--title`, `--lang` | wikipedia-profile | Én kjent arkivspiller og én eksakt profilside. Ingen personsøk eller massejobb |
| `--skip-existing` | rsssf | Lar kamper en annen kilde eier stå i fred |
| `--with-details` | fotmob | Henter hendelser, lagoppstilling og statistikk |
| `--details-limit N`, `--details-offset N` | fotmob | Avgrenser detaljoppslagene |
| `--allow-partial` | fotmob | Godtar en ufullstendig høsting. Kun etter manuell kontroll |
| `--report FIL` | fotmob, rsssf-discover | Skriver kjøringsrapporten til fil |
| `--from`, `--to`, `--max-pages` | fotmob-gap | Obligatorisk tidsvindu og hardt sidetak for klubbhistorikken |
| `--report-json`, `--report-md` | fotmob-gap | Maskinlesbar og menneskelesbar gap-rapport |
| `--match-ids`, `--class`, `--competition` | fotmob-gap | Eksplisitt, kontrollert import; alle tre kreves ved `--write` |

Alle kjøringer laster og validerer arkivet først. Er det allerede feil i `data/`, stopper
kommandoen — å høste inn i et ødelagt arkiv gjør bare feilsøkingen vanskeligere.

## Kildene i bruk

| Adapter | Kilde | Periode | Gir |
|---|---|---|---|
| `fotmob` | FotMob | 2010→ | Kampfakta, hendelser, lagoppstillinger, statistikk, tilskuertall |
| `fotmob-gap` | FotMob | 2010→ | Paginert klubbdiscovery, tolerant arkivtreff og eksplisitt gap-import |
| `rsssf` | RSSSF Norway | ←2009 | Dato, lag, resultat, runde |
| `rsssf-discover` | RSSSF Norway | 1902→ | Kartlegging: hvilke sider finnes, og hva de inneholder |
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
tidsgrense. Cachen skrives atomisk gjennom en midlertidig fil, så en avbrutt kjøring ikke
etterlater halve svar.

**Spillerprofiler fra Wikipedia er en kontrollert berikelse, ikke et biografisøk.**
Kommandoen krever både en spiller som allerede finnes i personregisteret eller en
AaFK-lagoppstilling, og en eksakt Wikipedia-tittel. Den leser bare navngitte
infoboksrader og sidens Wikidata-peker. Brødtekst, fødselsdato, klubbhistorikk og
dagens draktnummer kopieres ikke. Eksisterende fakta overskrives aldri; motstrid
blir en `KONTROLL` som stopper `--write`.

**Datoarv er den vanligste feilkilden i RSSSF-parseren.** Datoen står på den første kampen i
en gruppe og gjelder nedover til neste dato. Leses det feil, får en hel runde samme dato — og
ingenting i ettertid avslører det, fordi resultatene fortsatt stemmer. Derfor er arven testet
for seg.
