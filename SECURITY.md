# Sikkerhet

## Meld fra om et sårbarhet

Meld sikkerhetsproblemer **privat**, ikke som en vanlig issue:

1. Gå til [Security-fanen](https://github.com/mlervaag/aafkstats/security/advisories/new) i
   repoet og opprett en privat sikkerhetsrapport («Report a vulnerability»).
2. Beskriv hva som skjer, hvordan det reproduseres, og hva du mener konsekvensen er.
3. Har du en fungerende reproduksjon — en spørring, en forespørsel, et skript — legg den ved.

Dette er et fritidsprosjekt uten vaktordning, men henvendelser blir lest og besvart. Regn med
noen dager, ikke noen timer. Du får beskjed når problemet er bekreftet, og igjen når det er
rettet.

Publiser ikke detaljene før rettelsen er ute. Ønsker du kreditering, si fra — den kommer i så
fall i commit-meldingen og i rådgivningen.

## Hva som er interessant

Arkivet har ingen brukerkontoer, ingen innlogging og ingen personopplysninger. Den delen som
faktisk har en angrepsflate, er spørrefunksjonen: den lar en språkmodell skrive og kjøre
SQL mot arkivfilen. Grensene rundt den er beskrevet i
[docs/ARKITEKTUR.md](docs/ARKITEKTUR.md#spørrefunksjonen-og-grensene-rundt-den), og alt som
bryter et av disse lagene er verdt en rapport:

- **Skriving til arkivfilen.** Filen åpnes med `readOnly`, håndhevet av SQLite selv. Klarer
  du å endre den gjennom applikasjonen, er det den alvorligste feilen prosjektet kan ha.
- **Å komme forbi SELECT-begrensningen** — flere setninger, `ATTACH`, `PRAGMA`, `writable_schema`,
  eller andre veier ut av én lesende spørring.
- **Tilgang til `core_*`-, `sqlite_*`- eller `pragma_*`-objekter** fra spørrefunksjonen. Bare
  de dokumenterte viewene er offentlig kontrakt, og navnekontrollen er den eneste grensen mot
  resten — SQLite har ingen roller. Finner du en skrivemåte den ikke fanger, er det en
  rapport verdt.
- **En spørring som ikke lar seg avbryte.** Hver spørring kjøres i en egen prosess som drepes
  med `SIGKILL` ved timeout. Finner du en vei rundt det, blir tjenesten utsatt for å kunne
  holdes nede.
- **Lekkasje av hemmeligheter** — `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` eller andre miljøvariabler som når
  klienten, loggen eller et svar. Prosessen som kjører SQL får bare `PATH`, med vilje.
- **Kall som omgår grensene på forespørselen** — spørsmålslengde, historikk, kroppens
  størrelse eller opphavskontrollen på POST. Det som står på spill der er regningen.
- **Prompt injection som gir en faktisk konsekvens.** At modellen kan lures til å skrive noe
  rart er ikke i seg selv en sårbarhet; at den kan lures til å gjøre noe lagene over skulle
  ha stoppet, er det.

## Kjente og aksepterte forhold

Meld gjerne fra hvis du mener vurderingen er feil, men disse er kjent og bevisste:

- **Rate-limiting i minnet er en fartsdump, ikke en mur.** Uten Vercel Firewall foran er
  telleren per instans, og en fordelt avsender kommer forbi. Det harde kostnadstaket ligger
  hos modelleverandøren (Anthropic Console eller OpenAI-plattformen), ikke i koden. Se
  [`apps/web/lib/rate-limit.ts`](apps/web/lib/rate-limit.ts).
- **Spørsmål logges.** Spørsmålsteksten, SQL-en modellen skrev og tokenforbruket skrives til
  Vercel Logs. IP-adressen logges aldri. Ikke skriv noe personlig i spørrefeltet.
- **Radtak og énsetningsregel er ikke sikkerhet.** De finnes for å gi modellen forståelige
  feilmeldinger. `readOnly`, prosessgrensen og det tomme miljøet er lagene som faktisk holder.
  Navnekontrollen er unntaket — den er en reell grense, og hull i den er verdt en rapport.
- **Feil i dataene er ikke sikkerhetsproblemer.** Gal dato eller manglende kamp meldes som en
  vanlig [issue](https://github.com/mlervaag/aafkstats/issues/new/choose) — se
  [CONTRIBUTING.md](CONTRIBUTING.md).

## Hva som støttes

Bare `main` og den til enhver tid utrullede versjonen på
[aafkstats.vercel.app](https://aafkstats.vercel.app). Det finnes ingen utgivelser å
tilbakeporte rettelser til.
