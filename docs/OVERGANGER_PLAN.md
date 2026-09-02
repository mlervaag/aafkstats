# Overganger i arkivet — vurdering og plan

**Status:** forslag. Ingenting av dette er implementert ennå; dokumentet er beslutningsgrunnlaget.

Målet er å få inn overganger (spillere inn og ut) med minst mulig ny mekanikk, og vise dem
to steder: på personsiden, og på sesongsiden som en «inn/ut»-seksjon knyttet til stallen.

- [Hva arkivet mangler i dag](#hva-arkivet-mangler-i-dag)
- [Hvor overgangene skal bo](#hvor-overgangene-skal-bo)
- [Feltene](#feltene)
- [Fra YAML til side](#fra-yaml-til-side)
- [Personsiden](#personsiden)
- [Sesongsiden](#sesongsiden)
- [Redaksjonelle regler](#redaksjonelle-regler)
- [Hvor dataene kommer fra](#hvor-dataene-kommer-fra)
- [Arbeidsmengde og rekkefølge](#arbeidsmengde-og-rekkefølge)
- [Alternativene som ble forkastet](#alternativene-som-ble-forkastet)

## Hva arkivet mangler i dag

Arkivet vet allerede hvem som var i stallen hvert år, utledet av oppstillingene
(`squad`-viewet, fra 2010). Det den ikke vet, er hvorfor noen kom eller forsvant, og
koden sier det selv:

> «Ny» betyr at spilleren ikke var med sesongen før, ikke at han ble kjøpt. En spiller som
> var skadet hele fjoråret ser like ny ut som en nysignering, og arkivet vet ikke
> forskjellen.
> — `apps/web/lib/archive.ts`, `loadSquad()`

Den motsatte veien er utelatt helt, med samme begrunnelse: «sluttet» ville vært en påstand
om noe arkivet ikke vet. Det er riktig så lenge kilden mangler. En kildeført overgang er
nettopp den kilden, og den løser begge deler: «ny» blir «hentet fra Hødd», og «ut» blir
mulig å vise i det hele tatt.

Overganger finnes allerede i arkivet, men gjemt. Fire spillere fra medlemsbladet 1950 har
dem lagret som *roller*:

```yaml
# data/people/knut-hjelle.yaml
- id: overgang-volda-1950
  category: player
  title: Spiller
  from: "1950"
  to: null
  sources: [{ sourceId: medlemsblad-for-aalesunds-fotb-1950-3b73, page: "12" }]
  note: Meldte overgang fra AaFK til Volda T. & I.L. høsten 1950.
```

Retningen, klubben og at det i det hele tatt *er* en overgang, står bare i fritekstnotatet.
Det er verken søkbart, grupperbart per sesong eller mulig å vise. De fire radene er derfor
også migreringstesten for modellen under.

## Hvor overgangene skal bo

**Anbefaling: et `transfers`-felt på personfila.** Ikke en ny toppnivåkatalog, ikke en ny
rollekategori.

Det gir null ny lastemekanikk: personfilene lastes allerede, `sourceRef` finnes allerede,
valideringen går allerede over dem, og byggesteget skriver allerede tre sidetabeller fra
person-YAML (`core_squad_numbers`, `core_declared_coach_spells`, `core_person_roles`). En
fjerde er samme mønster én gang til.

Innvendingen er reell og verdt å ta: de fleste spillere har ikke personfil. Michael
Barrantes har 134 kamper og ingen fil; han finnes som *utledet* spiller
(`derived-players.ts`). En overgang for ham krever at fila opprettes.

Det er riktig utfall, ikke en kostnad. `person.ts` sier at «en fil lages når det er noe å
si». En kildeført overgang er per definisjon noe å si — den er en sterkere grunn til en fil
enn et draktnummer er. Regelen står uendret; overganger blir en ny utløser for den.
Konsekvensen skal stå på den utledede spillersiden: en spiller uten fil kan ikke ha
overganger registrert, og det er en manglende fil, ikke en manglende overgang.

## Feltene

Minst mulig som fortsatt er ærlig. Nytt skjema i `packages/schema/src/person.ts`:

```ts
/** Om spilleren kom til AaFK eller forlot klubben. AaFK er alltid den ene siden. */
export const transferDirection = z.enum(["in", "out"]);

/**
 * Hva slags overgang. `transfer` dekker det vanlige og er standard; de andre
 * finnes fordi de betyr noe annet for leseren, ikke for å bli uttømmende.
 */
export const transferKind = z.enum([
  "transfer",       // ordinær overgang
  "loan",           // utlån ut eller inn
  "loan_return",    // tilbake fra utlån
  "free",           // kontraktløs / Bosman
  "academy",        // opp fra egen ungdomsavdeling (bare `in`)
  "released",       // kontrakt utløpt eller hevet, uten kjent ny klubb (bare `out`)
  "retired",        // la opp (bare `out`)
]);

export const transfer = z
  .object({
    /** Stabil innenfor personfila, som rolle-ID-ene. `inn-hodd-2016`. */
    id: slug,
    direction: transferDirection,
    kind: transferKind.default("transfer"),
    /**
     * Klubben slik kilden skriver den. Bevares alltid, også når `clubId` er satt:
     * «Volda T. & I.L.» er hva medlemsbladet sa, og det skal ikke skrives om.
     * Null bare når kilden ikke navngir noen — en `released` eller `retired`.
     */
    club: z.string().min(1).nullable().default(null),
    /**
     * Arkivets klubb-ID når klubben finnes i `data/clubs/`. De 208 klubbene der
     * er motstandere; en spiller går ofte til en klubb AaFK aldri har møtt, og
     * da står feltet tomt. Det skal ikke opprettes en klubbfil for å fylle det.
     */
    clubId: slug.optional(),
    /** Datoen kilden oppgir: ÅÅÅÅ eller ÅÅÅÅ-MM-DD. «Høsten 1950» blir "1950". */
    date: historicalDate,
    /**
     * Sesongen overgangen gjelder for. Standard er året i `date`, som er riktig
     * for nesten alt. Feltet finnes for vintervinduet: en spiller kjøpt i
     * desember 2015 hører til stallen i 2016, ikke i 2015.
     */
    season: seasonYear.optional(),
    sources: z.array(sourceRef).min(1, "en overgang må ha minst én kilde"),
    note: z.string().optional(),
  })
  .strict();
```

Fire påkrevde felt: `id`, `direction`, `date`, `sources`. Resten er valgfritt eller har
standardverdi.

**Overgangssum er utelatt med vilje.** Beløp er sjelden dokumentert, ofte et rykte, og et
felt som finnes blir fylt. Det kan legges til senere hvis en kilde faktisk oppgir summer;
til da hører beløpet hjemme i `note` med kilden som sa det.

Superrefine-reglene, i samme stil som `roles` og `coachSpells` allerede har:

- To overganger kan ikke dele `id` innenfor fila.
- `academy` krever `direction: in`; `released` og `retired` krever `direction: out`.
- `retired` og `released` kan ikke ha `club`/`clubId` — de betyr nettopp at det ikke er
  noen klubb å oppgi.
- `season`, når satt, må være året i `date` eller året etter. Alt annet er en skrivefeil,
  ikke et vintervindu.
- `clubId` uten `club` er lov (ID-en gir navnet), men `clubId` valideres mot
  `data/clubs/` i CLI-en, på samme måte som kampenes klubbreferanser.

Eksempel, slik det ser ut i en fil:

```yaml
transfers:
  - id: inn-hodd-2016
    direction: in
    club: IL Hødd
    clubId: hodd
    date: "2016-01-14"
    sources: [{ sourceId: aafk-no-…, fields: [club, date] }]
  - id: ut-volda-1950
    direction: out
    club: Volda T. & I.L.
    date: "1950"
    sources: [{ sourceId: medlemsblad-for-aalesunds-fotb-1950-3b73, page: "12", fields: [club, date] }]
    note: Meldte overgang høsten 1950.
```

## Fra YAML til side

Fire steder må endres i takt — det er regelen i `claude.md`, og den gjelder her:

1. **`packages/db/src/schema.sql`** — én tabell og ett view:

   ```sql
   CREATE TABLE core_transfers (
     person_id   TEXT NOT NULL REFERENCES core_people(id),
     transfer_id TEXT NOT NULL,
     direction   TEXT NOT NULL CHECK (direction IN ('in','out')),
     kind        TEXT NOT NULL,
     club        TEXT,
     club_id     TEXT REFERENCES core_clubs(id),
     date        TEXT NOT NULL,
     season      INTEGER NOT NULL,   -- utledet ved bygging når YAML-en ikke setter den
     sources     TEXT NOT NULL,
     note        TEXT,
     PRIMARY KEY (person_id, transfer_id)
   );

   -- Overganger inn og ut, slik en kilde dokumenterer dem. Egen fra squad med
   -- vilje: squad er utledet av oppstillingene og vet at noen var med, mens
   -- dette er kildens påstand om hvorfor.
   CREATE VIEW transfers AS
   SELECT t.person_id, p.name, t.direction, t.kind, t.season, t.date,
          t.club_id, coalesce(t.club, c.name) AS club, t.sources, t.note,
          '/personer/' || p.id AS url
   FROM core_transfers t
   JOIN core_people p ON p.id = t.person_id
   LEFT JOIN core_clubs c ON c.id = t.club_id
   ORDER BY t.season, t.direction, p.name;
   ```

   `season` materialiseres i tabellen framfor å utledes i viewet, slik at sesongsiden er
   ett indeksert oppslag og ikke en strengoperasjon per rad.

2. **`packages/db/src/build.ts`** — én `INSERT` ved siden av de tre som allerede skriver
   fra personfilene. Standardverdien `season = Number(date.slice(0, 4))` settes her.

3. **`packages/query/src/dataset.ts`** — `transfers` beskrevet med kolonner og forbehold.
   Testen feiler ellers, og med god grunn: spørrefunksjonen må kunne svare på «hvem hentet
   vi i 2016» uten å blande overganger med `squad`. Forbeholdene som må stå:
   *dekningen er ujevn og et tomt år betyr ingen kilde, ikke ingen overganger*;
   *ikke summer transfers og squad*; *en spiller uten personfil kan ikke ha overganger her*.

4. **`docs/DATAMODELL.md`** — nytt avsnitt under «Person», og en linje i «Stall og trener»
   om at «ny» nå kan underbygges av en overgang.

I tillegg: `apps/web/lib/archive.ts` får `loadTransfers(season)`, `apps/web/lib/people.ts`
får `getPersonTransfers(id)`, og MCP-verktøyet `get_person` tar med overgangene.

## Personsiden

Ny seksjon i venstrekolonnen på `/personer/[id]`, mellom «Roller og verv» og «Registrerte
sesonger» — kronologien på siden går allerede fra verv til kamper, og overgangene hører
inn ved starten og slutten av kampaktiviteten.

Samme tidslinjekomponent som rollene bruker, med `SourceChips` under hver rad, slik at
proveniensen ser lik ut over hele siden:

```
Overganger
  2016   Inn    fra IL Hødd            [medlemsblad s. 12]
  2019   Ut     til Sarpsborg 08 (lån) [aafk.no]
```

Klubbnavnet lenkes til `/motstander/<clubId>` når klubben finnes i arkivet, ellers står
kildens tekst uten lenke. Ingen tom seksjon: har personen ingen overganger, rendres
ingenting.

For utledede spillere (uten personfil) vises ikke seksjonen i det hele tatt. Å skrive «ingen
overganger registrert» der ville lest som en påstand om spilleren, når det er en påstand om
arkivet.

## Sesongsiden

Ny komponent `SquadMovements` i `apps/web/components/Squad.tsx`, rendret **inne i**
`SquadList` rett under stalltabellen. Den hører til stallen og skal ikke bli en løsrevet
seksjon lenger nede på siden:

```
Stallen                                    28 spillere, 6 nye
[tabellen]

  Inn i 2016                    Ut av 2016
  Aron Sigurdarson  Hødd        Peter Orry Larsen  Rosenborg
  …                             …

«I kamptropp» … (forklaringsavsnittet som står der i dag)
```

To kolonner i et enkelt grid, som faller til én på mobil. Hver rad er navn (lenket til
personsiden når fila finnes), klubb og en diskret merkelapp for `kind` når den ikke er
`transfer` — «lån», «egen ungdom», «la opp».

**Gevinsten som gjør seksjonen mer enn en liste:** «ny»-merkelappen i stalltabellen kan nå
si mer når det finnes en overgang. `loadSquad()` slår opp `transfers` for sesongen på
`person_key`, og der en `in`-overgang finnes, blir «ny» til «hentet fra Hødd» med
tittelattributt. Der den ikke finnes, står «ny» uendret, med den samme reservasjonen som i
dag. Det er den eksisterende forklaringsteksten som endres minst mulig: den sier fortsatt at
«ny» ikke betyr hentet, og legger til at der arkivet *vet* det, står det.

Seksjonen skjules når sesongen ikke har noen overganger. Sesonger uten oppstillinger (før
2010) har ingen stalltabell i dag, men kan godt ha kildeførte overganger fra medlemsbladene
— derfor må `SquadMovements` kunne rendres alene, uten stalltabellen over seg. Det er den
ene strukturelle detaljen som er lett å gjøre feil: `SquadList` returnerer `null` når stallen
er tom, og den tidligreturneringen må flyttes så bevegelsene overlever den.

## Redaksjonelle regler

Regelen «navnelikhet er et kandidatgrunnlag, ikke bevis» har en direkte parallell her, og
den bør stå i `DATAMODELL.md`:

- **En sesongovergang er ikke bevis for en kampsesong.** En spiller kan være kjøpt i 2016 og
  aldri spilt. Overgangen og stallen er to observasjoner, og de skal ikke utlede hverandre.
- **En manglende overgang er ikke bevis for at ingen skjedde.** Dekningen blir ujevn i mange
  år framover; et år uten rader betyr manglende kilde.
- **Kildens klubbnavn overskrives aldri.** `clubId` kommer i tillegg til `club`, aldri i
  stedet for.
- **Ingen automatisk kobling.** `clubId` settes ikke maskinelt på navnelikhet, av samme grunn
  som `opponentClubId` ikke gjør det.

En rapportkommando i samme ånd som `pnpm opponents:unresolved` er naturlig senere:
`pnpm transfers:check` som lister overganger uten `clubId` der et navnetreff finnes, og
overganger som motsies av stallen (en `out` i 2016 for en spiller som spiller 2017). Den er
ikke nødvendig for første versjon, og hører til når datamengden er stor nok til at den
finner noe.

## Hvor dataene kommer fra

Rekkefølgen er valgt etter rettigheter og innsats, ikke etter volum:

1. **Medlemsbladene (Nasjonalbiblioteket).** Allerede innhøstet, allerede kildeført, og de
   fire eksisterende «overgang»-rollene ligger der. Migreringen av dem er første datasett og
   koster fire redigeringer.
2. **aafk.no.** Egen leverandørfil finnes (`data/providers/aafk-no.yaml`), og klubbens egne
   overgangsmeldinger er den beste kilden for nyere år. Én sesong om gangen, som resten av
   innhøstingen.
3. **Wikipedia.** Sesongartiklene har «Spillerlogg»-tabeller for mange nyere år. Samme
   leverandør som stallmalen allerede kommer fra.
4. **Transfermarkt og lignende.** Ikke uten en avklart rettighetsstatus i `data/sources/`.
   Nevnes her for å være avklart, ikke for å tas i bruk.

Poenget med rekkefølgen: modellen kan innføres og vises med fire rader fra 1950 og en
håndfull fra en enkelt moderne sesong. Den trenger ikke fullstendighet for å være nyttig,
og skal ikke vente på den.

## Arbeidsmengde og rekkefølge

| Steg | Hva | Omfang |
|---|---|---|
| 1 | Skjema i `person.ts` + regler | ~60 linjer, ny test |
| 2 | `schema.sql` (tabell + view) og `build.ts` | ~40 linjer |
| 3 | `dataset.ts` | ~25 linjer |
| 4 | Migrer de fire 1950-rollene til `transfers` | 4 filer |
| 5 | `loadTransfers` / `getPersonTransfers` | ~50 linjer |
| 6 | `SquadMovements` + «hentet fra» i `SquadList` | ~120 linjer |
| 7 | Seksjon på personsiden | ~50 linjer |
| 8 | `DATAMODELL.md`, `README.md`, MCP `get_person` | dokumentasjon |

Stegene 1–4 er en fungerende leveranse i seg selv: dataene er inne, valideringen holder dem,
og spørrefunksjonen svarer på dem. 5–7 er visningen. Det er et naturlig sted å dele i to
PR-er hvis det ønskes.

## Alternativene som ble forkastet

**Egen katalog `data/transfers/<id>.yaml`.** Én fil per overgang, som kamper og kilder. Gir
en ny laster, en ny ID-konvensjon, en ny valideringsregel for filnavn, og et krav om
`personId` som uansett fører tilbake til at personfila må finnes. Alt det `transfers` på
personfila slipper unna. Katalogen er riktig den dagen en overgang har mange egne felt
(beløp, kontraktslengde, klausuler) — den dagen er ikke nå.

**Ny rollekategori `transfer` i `roles`.** Billigst av alt: null skjemaendring utover et
enum-medlem. Men `roles` modellerer en *periode i en rolle* med `title` og `body`, og en
overgang er en *hendelse med retning og motpart*. Retningen ville måtte gjettes fra
tittelen, klubben fra fritekst — nøyaktig tilstanden de fire 1950-radene er i nå, opphøyet
til modell. Det som ser ut som den enkleste veien inn, er grunnen til at overgangene ikke er
synlige i dag.

**Utlede overganger fra stallen.** Gratis, og allerede halvveis gjort med «ny». Kan aldri si
hvilken klubb, aldri skille skade fra salg, og virker ikke i det hele tatt før 2010. Det er
gjetningen arkivet har sagt nei til, og som en kildeført overgang finnes for å erstatte.
