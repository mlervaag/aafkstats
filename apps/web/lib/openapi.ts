import { API_VERSION } from "./public-api";
import { SITE_ORIGIN } from "./site";

const envelope = (schema: Record<string, unknown>) => ({
  type: "object",
  required: ["meta", "data"],
  properties: {
    meta: { type: "object", required: ["apiVersion", "datasetVersion"], properties: { apiVersion: { const: API_VERSION }, datasetVersion: { type: "string" }, count: { type: "integer" }, nextCursor: { type: ["string", "null"] } } },
    data: schema,
  },
});

const ok = (schema: Record<string, unknown>) => ({ description: "OK", content: { "application/json": { schema: envelope(schema) } } });
const error = { description: "Ugyldig forespørsel", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } };
const rateLimited = { description: "For mange forespørsler", headers: { "Retry-After": { schema: { type: "integer" } } }, content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } };
const responses = (entries: Record<string, unknown>) => ({ ...entries, "429": rateLimited });
const integer = (name: string, description?: string) => ({ name, in: "query", schema: { type: "integer" }, description });
const text = (name: string, values?: string[]) => ({ name, in: "query", schema: values ? { type: "string", enum: values } : { type: "string" } });

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "AaFK-arkivet REST API",
    version: API_VERSION,
    description: "Gratis, skrivebeskyttet tilgang til AaFK-arkivets publiserte kunnskap og åpne researchsaker. canonical_match og source_claim er ulike evidensnivåer og skal aldri summeres som ett kampgrunnlag.",
    license: { name: "Se datasettets rettighetsnotat", url: `${SITE_ORIGIN}/data#lisens-og-rettigheter` },
  },
  servers: [{ url: `${SITE_ORIGIN}/api/v1` }],
  paths: {
    "/meta": { get: { summary: "Versjon, rettigheter og dekning", responses: responses({ "200": ok({ type: "object" }) }) } },
    "/results": { get: { summary: "Hele resultathistorien med evidensnivå", description: "Returnerer canonical_match og grupperte source_claim-rader separat. Ikke summer evidensnivåene.", parameters: [integer("season"), integer("seasonFrom"), integer("seasonTo"), text("opponent"), text("opponentClubId"), text("result", ["S", "U", "T"]), text("ranking", ["largest_win", "largest_defeat", "most_goals_for", "most_goals_total", "newest", "oldest"]), integer("limit", "1–100, standard 20")], responses: responses({ "200": ok({ type: "array", items: { $ref: "#/components/schemas/Result" } }), "400": error }) } },
    "/matches": { get: { summary: "Kanoniske kamper", parameters: [integer("season"), integer("seasonFrom"), integer("seasonTo"), text("opponent"), text("competitionType"), text("result", ["S", "U", "T"]), integer("limit", "1–100, standard 20")], responses: responses({ "200": ok({ type: "array", items: { type: "object" } }), "400": error }) } },
    "/matches/{id}": { get: { summary: "Én kanonisk kamp", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: responses({ "200": ok({ type: "object" }), "404": { description: "Ikke funnet" } }) } },
    "/seasons/{year}": { get: { summary: "Sesongsammendrag og dekning", parameters: [{ name: "year", in: "path", required: true, schema: { type: "integer" } }], responses: responses({ "200": ok({ type: "array", items: { type: "object" } }), "404": { description: "Ikke funnet" } }) } },
    "/research/overview": { get: { summary: "Aggregert oversikt over mangler", responses: responses({ "200": ok({ type: "object" }) }) } },
    "/research/cases": { get: { summary: "Bare publiserte, åpne verification cases", parameters: [text("category"), text("targetType"), integer("priority"), integer("limit", "1–100, standard 20")], responses: responses({ "200": ok({ type: "array", items: { $ref: "#/components/schemas/VerificationCase" } }), "400": error }) } },
    "/research/cases/{id}": { get: { summary: "Én publisert, åpen verification case", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: responses({ "200": ok({ $ref: "#/components/schemas/VerificationCase" }), "404": { description: "Draft, paused, resolved eller ukjent sak" } }) } },
    "/openapi.json": { get: { summary: "Denne OpenAPI-kontrakten", responses: responses({ "200": { description: "OpenAPI 3.1" } }) } },
  },
  components: { schemas: {
    Error: { type: "object", required: ["error"], properties: { error: { type: "object", required: ["code", "message"], properties: { code: { type: "string" }, message: { type: "string" } } } } },
    Result: { type: "object", required: ["evidenceLevel", "recordId", "season", "aafkScore", "opponentScore"], properties: { evidenceLevel: { type: "string", enum: ["canonical_match", "source_claim"] }, recordId: { type: "string" }, date: { type: ["string", "null"] }, datePrecision: { type: "string" }, season: { type: "integer" }, opponent: { type: ["string", "null"] }, confidence: { type: ["string", "null"] }, hasConflicts: { type: "integer" }, missingFields: { type: "array", items: { type: "string" } }, sources: { type: "array" }, canonicalUrl: { type: "string", format: "uri" } } },
    VerificationCase: { type: "object", description: "Et spørsmål som trenger research, ikke et faktum.", required: ["id", "status", "question", "revision", "sources"], properties: { id: { type: "string" }, status: { const: "open" }, question: { type: "string" }, context: { type: "string" }, sources: { type: "array" }, researchTask: { type: ["object", "null"] }, revision: { type: "string" }, canonicalUrl: { type: "string", format: "uri" } } },
  } },
} as const;
