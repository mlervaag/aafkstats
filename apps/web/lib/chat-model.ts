/**
 * Hvilken modell spørrefunksjonen kjører på, og hos hvem.
 *
 * Arkivet er ikke bundet til én leverandør. Oppgaven chatten løser er avgrenset —
 * les et dokumentert skjema, velg et verktøy, skriv én SELECT mot seks views — og
 * den løses like godt av en mellomklassemodell hos Anthropic som hos OpenAI. Da
 * skal valget ligge i miljøet, ikke i koden, slik at den som setter opp sin egen
 * kopi bruker nøkkelen han allerede har.
 *
 * Selve kallet er ikke felles: `chat-anthropic.ts` og `chat-openai.ts` har hver
 * sin verktøyløkke, fordi de to API-ene skiller seg for mye til at et lag imellom
 * ville vært annet enn en oversettelse med tap. Det som *er* felles — takene,
 * innpakkingen av verktøysvar og valget av modell — står her.
 */

import type { ToolContext } from "@aafkstats/query/tools";
import type { HistoryTurn } from "@/lib/chat-request";
import type { FollowUp } from "@/lib/chat-followup";

export type ChatProvider = "anthropic" | "openai";

export interface ChatSetup {
  provider: ChatProvider;
  model: string;
}

/**
 * Standardmodellen hos hver leverandør.
 *
 * **Anthropic: Sonnet 5, ikke Opus 5.** Arbeidet her er avgrenset, og prislappen
 * på Opus er dobbel: 5/25 dollar per million tokens mot Sonnet 5s 3/15 (2/10 i
 * introduksjonspris ut august 2026). For et gratis supporterarkiv er det
 * forskjellen som betyr noe.
 *
 * **OpenAI: Terra, ikke Sol og ikke Luna.** GPT-5.6 kommer i tre trinn: Sol til
 * 5/30 dollar, Terra til 2/12 og Luna til 0,20/1,20. Sol er til «komplekst
 * profesjonelt arbeid» og løser ikke denne oppgaven bedre enn Terra. Luna er
 * fristende billig, men det den sparer er nettopp det vi bruker: å velge riktig
 * verktøy og skrive gyldig SQL mot et skjema den leser i prompten. Terra ligger
 * omtrent der Sonnet 5 ligger, i pris og i oppgave.
 *
 * Begge kan overstyres med AAFK_CHAT_MODEL for å prøve noe annet uten å deploye
 * på nytt. Merk at hver løkke forutsetter tenkning og innsatsnivå slik den
 * leverandøren staver det; en eldre modell som ikke støtter begge deler krever en
 * kodeendring, ikke bare en ny verdi her.
 */
export const DEFAULT_MODELS: Record<ChatProvider, string> = {
  anthropic: "claude-sonnet-5",
  openai: "gpt-5.6-terra",
};

/** Miljøvariabelen som holder nøkkelen, per leverandør. */
const API_KEY_VARS: Record<ChatProvider, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
};

/**
 * Rekkefølgen når begge nøklene er satt.
 *
 * Anthropic vinner, og det er et valg, ikke en tilfeldighet: systemprompten
 * caches eksplisitt med `cache_control`, språkreglene i prompten er skrevet og
 * prøvd mot Claude, og verktøyløkka der er SDK-ets egen. OpenAI-veien er like
 * fullverdig, men den er den nyere av de to. Vil du ha den, sier du det med
 * AAFK_CHAT_PROVIDER=openai.
 */
const PREFERENCE: ChatProvider[] = ["anthropic", "openai"];

/** Et statistikksvar skal være kort. Dette er også et hardt tak på kostnaden per kall. */
export const MAX_TOKENS = 6_000;

/** Maks antall runder modellen får med verktøy før vi stopper løkken. */
export const MAX_ITERATIONS = 5;

/**
 * Miljøet slik denne filen leser det.
 *
 * Egen type og ikke `NodeJS.ProcessEnv`: den krever `NODE_ENV`, og da måtte hver
 * test i chat-model.test.ts dratt med seg et felt som ikke har noe med saken å gjøre.
 */
export type ChatEnv = Readonly<Record<string, string | undefined>>;

export type ChatSetupResult =
  | { ok: true; setup: ChatSetup }
  | { ok: false; error: string };

/**
 * Finner leverandør og modell fra miljøet.
 *
 * Ren funksjon med miljøet som argument, slik at den kan testes uten å skrive i
 * `process.env`. Feilene er formulert for å leses av den som setter opp
 * nettstedet, og går rett ut i 503-svaret fra `/api/chat`.
 */
export function resolveChatSetup(env: ChatEnv = process.env): ChatSetupResult {
  const available = PREFERENCE.filter((p) => (env[API_KEY_VARS[p]] ?? "").trim() !== "");

  const requested = (env.AAFK_CHAT_PROVIDER ?? "").trim().toLowerCase();
  if (requested !== "" && requested !== "anthropic" && requested !== "openai") {
    return {
      ok: false,
      error: `Spørrefunksjonen er ikke satt opp: AAFK_CHAT_PROVIDER er «${requested}». Gyldige verdier er «anthropic» og «openai».`,
    };
  }

  if (requested !== "") {
    const provider = requested as ChatProvider;
    if (!available.includes(provider)) {
      return {
        ok: false,
        error: `Spørrefunksjonen er ikke satt opp: AAFK_CHAT_PROVIDER er «${provider}», men ${API_KEY_VARS[provider]} mangler.`,
      };
    }
    return { ok: true, setup: { provider, model: modelFor(provider, env) } };
  }

  const provider = available[0];
  if (!provider) {
    return {
      ok: false,
      error:
        "Spørrefunksjonen er ikke satt opp: verken ANTHROPIC_API_KEY eller OPENAI_API_KEY er satt.",
    };
  }

  return { ok: true, setup: { provider, model: modelFor(provider, env) } };
}

/**
 * AAFK_CHAT_MODEL gjelder den leverandøren som er valgt.
 *
 * Én variabel og ikke én per leverandør: det er alltid nøyaktig én modell i bruk,
 * og et modellnavn sier uansett hvem det hører hjemme hos.
 */
function modelFor(provider: ChatProvider, env: ChatEnv): string {
  const override = (env.AAFK_CHAT_MODEL ?? "").trim();
  return override === "" ? DEFAULT_MODELS[provider] : override;
}

/** Én SSE-hendelse ut til klienten. Ruta eier strømmen; løkkene får bare kalle denne. */
export type SendEvent = (event: string, data: unknown) => void;

export interface ChatRun {
  question: string;
  history: HistoryTurn[];
  ctx: ToolContext;
  send: SendEvent;
  /** Beholder bare det første gyldige forslaget i én modellkjøring. */
  suggestFollowUp: (followUp: FollowUp) => boolean;
}

export interface ChatResult {
  inputTokens: number;
  outputTokens: number;
  /** Satt når modellen avslo. Andre feil kastes og håndteres i ruta. */
  failure: string | null;
}

/**
 * Verktøysvaret slik modellen får se det.
 *
 * Innholdet pakkes i en tydelig avgrenser. Systemprompten slår fast at alt
 * innenfor er data fra arkivet, aldri instruksjoner — det er forsvaret mot at en
 * bidragsyter legger en beskjed til modellen i et kampreferat. Begge løkkene
 * bruker denne, så forsvaret ikke gjelder bare hos den ene leverandøren.
 */
export function wrapToolResult(toolName: string, content: unknown): string {
  return `<arkivdata verktoy="${toolName}">\n${JSON.stringify(content)}\n</arkivdata>`;
}
