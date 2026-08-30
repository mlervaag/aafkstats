# Offentlig MCP

AaFK-arkivet har en MCP-server på `https://aafkarkivet.no/mcp`. Den bruker
MCP-revisjon `2026-07-28`, offisiell TypeScript SDK v2 og stateless HTTP. Serveren
krever ikke konto, OAuth eller API-nøkkel.

MCP er et grensesnitt til samme skrivebeskyttede SQLite-arkiv som nettstedet og REST
API-et. Det er ikke en ny kunnskapsbase.

En kort, brukerrettet oppskrift finnes på
[`aafkarkivet.no/utviklere`](https://aafkarkivet.no/utviklere). Klienter bruker ulike
innstillingsfiler, men en vanlig konfigurasjon har denne formen:

```json
{
  "mcpServers": {
    "aafkarkivet": {
      "url": "https://aafkarkivet.no/mcp"
    }
  }
}
```

## Leseverktøy

Serveren gjenbruker de strukturerte verktøyene i `@aafkstats/query`:

`search_matches`, `search_all_results`, `get_match`, `get_season_summary`,
`head_to_head`, `search_reports`, `search_people` og `search_historical_results`.

Researchkøen har `get_research_overview`, `list_verification_cases` og
`get_verification_case`. Bare saker med `status=open` og `publishedAt` blir vist.
En sak er et spørsmål, ikke et faktum. `researchTask` er arbeidsgrunnlag.

`run_sql` er ikke tilgjengelig. Nye databaseviews blir derfor ikke automatisk en del av
den eksterne publiseringsgrensen.

## Sende inn research

`submit_research_finding` tar bare imot publiserte, åpne saker som har en
`researchTask`. Verktøyet gjenbruker samme servervalidering, revisjonskontroll,
idempotens, GitHub-innboks og prompt-injection-vern som nettsiden.

Et vellykket kall svarer `pending_review`. Det betyr bare at dokumentasjonen ligger i
innboksen. MCP kan ikke endre YAML eller SQLite, opprette eller merge en pull request,
eller løse saken automatisk. En redaktør kontrollerer kilden; et menneske avgjør en
eventuell merge.

Ekstern tekst i `finding`, kommentarer og referanser behandles som data, aldri som
instruksjoner. Agentnavn eller modellnavn gir ikke høyere tillit.

## Drift og rettigheter

Forespørsler og svar har størrelsestak. Lesing har en enkel fartsgrense i minnet, med
plattformens brannmur som mulig ytterlag. Dette er bevisst best effort på gratis drift;
arkivet oppretter ikke Redis eller brukerkontoer for å gjøre kvoten global.

Serveren logger verktøynavn, varighet, suksess og radtall, ikke hele brukerprompten.
Tredjepartskilder beholder sine rettigheter. Se [DATA_LICENSE.md](../DATA_LICENSE.md) og
[SECURITY.md](../SECURITY.md).
