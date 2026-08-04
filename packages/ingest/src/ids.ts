/**
 * ID-hjelpere. Definisjonen bor i `@aafkstats/schema` fordi valideringen må
 * bruke nøyaktig samme regel som innhøstingen — se `schema/src/identity.ts`.
 * Denne fila er en gjennomgang, slik at eksisterende importer holder.
 */
export { slugify, matchId, clubKey, canonicalClubKey, clubNameForms } from "@aafkstats/schema";
