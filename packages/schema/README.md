# @aafkstats/schema

Datamodellen, og alt som håndhever den. Ingen andre pakker avhenger av — denne er bunnen i
stabelen.

```
src/
├── primitives.ts   Slug, dato, konfidens, kildehenvisning, konflikt
├── entities.ts     Klubb, stadion, konkurranse, kilde, sesong
├── match.ts        Kampen, med reglene som ikke lar seg uttrykke i en type
├── derive.ts       AaFK-perspektivet og fullstendighet
├── load.ts         Leser hele arkivet fra disk og kryssvaliderer
└── cli/validate.ts «pnpm validate»
```

## Ansvar

**Skjemaet er kontrakten.** Alle skjemaer er Zod og `.strict()`: en skrivefeil i et feltnavn
blir en valideringsfeil, ikke et felt som forsvinner i stillhet. Feltreferansen for mennesker
står i [docs/DATAMODELL.md](../../docs/DATAMODELL.md).

**Validering i to trinn.** `loadArchive()` validerer hver fil for seg og samler feil i
`issues` i stedet for å kaste — én ødelagt fil skal ikke skjule alle de andre.
`crossValidate()` gjør det som først er mulig når hele arkivet er lest: referanseintegritet,
duplikate ID-er, og kamper som ser ut til å være lagt inn to ganger under ulike slugs.

**Avledningen bor her, ikke i SQL.** `toAafkPerspective()` snur en kamp til AaFKs synsvinkel,
og brukes både av byggesteget i `@aafkstats/db` og av testene. Én implementasjon kan ikke bli
uenig med seg selv.

## Bruk

```ts
import { match, toAafkPerspective, nameAt } from "@aafkstats/schema";
import { loadArchive, crossValidate, dataDir } from "@aafkstats/schema/load";

const archive = await loadArchive(dataDir());
const issues = [...archive.issues, ...crossValidate(archive)];

const p = toAafkPerspective(archive.matches[0]!);   // { isHome, opponent, result, … }
const navn = nameAt(klubb.names, klubb.name, "1975-06-01");
```

```sh
pnpm validate                                # data/
AAFK_DATA_DIR=fixtures/data pnpm validate    # fixture-arkivet
```

`AAFK_DATA_DIR` tolkes mot repo-rota, ikke mot cwd — pnpm kjører skript med pakkemappen som
cwd, og en relativ sti derfra ville pekt på et tomt arkiv som består valideringen.

## Verdt å vite

**Bare seks felt er påkrevd på en kamp.** `id`, `date`, `status`, `competition`,
`home.clubId` og `away.clubId`. En kamp fra 1930 der vi bare kjenner dato og motstander skal
kunne ligge i arkivet med `confidence: probable` og forbedres senere.

**Reglene som ikke er typer** står i `superRefine` på `match`: ID-en må starte med datoen,
nøyaktig én side må være AaFK, `played` krever resultat, straffesparkkonkurranse forutsetter
uavgjort, og `disputed` krever en registrert konflikt. Alle feilmeldinger er på norsk og
peker på feltet.

**Datoer normaliseres.** YAML-parseren kan levere `Date` for udaterte skalarer, så `isoDate`
tar imot begge og gir alltid streng ut. Uten det blir samme dato representert ulikt avhengig
av hvordan filen er skrevet, og diffene blir støyete.

**`nameAt()` er hele navnehåndteringen.** Klubber, stadion og konkurranser har `names` med
perioder; oppslaget skjer ved bygging, én gang per kamp, mot kampdatoen.

**Nytt felt?** Da hører det som regel hjemme fire steder: her, i `schema.sql`, i `build.ts`
og i datasettdokumentasjonen i `@aafkstats/query`. Glemmer du det siste, feiler
`dataset.test.ts` — det er meningen.
