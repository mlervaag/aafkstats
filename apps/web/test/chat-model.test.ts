import { describe, expect, it } from "vitest";
import { DEFAULT_MODELS, resolveChatSetup, type ChatEnv } from "../lib/chat-model.js";

/**
 * Valget av leverandør er den delen av oppsettet det er lettest å ta feil av: to
 * nøkler, en overstyring, og et 503-svar som skal si hva som mangler. Funksjonen tar
 * miljøet som argument nettopp for å kunne prøves uten å røre `process.env`.
 */

const anthropic = { ANTHROPIC_API_KEY: "sk-ant-test" };
const openai = { OPENAI_API_KEY: "sk-test" };

function setup(env: ChatEnv) {
  const result = resolveChatSetup(env);
  if (!result.ok) throw new Error(`Forventet et oppsett, fikk: ${result.error}`);
  return result.setup;
}

function error(env: ChatEnv) {
  const result = resolveChatSetup(env);
  if (result.ok) throw new Error("Forventet en feil, fikk et oppsett.");
  return result.error;
}

describe("resolveChatSetup", () => {
  it("bruker den nøkkelen som finnes", () => {
    expect(setup(anthropic)).toEqual({ provider: "anthropic", model: DEFAULT_MODELS.anthropic });
    expect(setup(openai)).toEqual({ provider: "openai", model: DEFAULT_MODELS.openai });
  });

  it("velger Anthropic når begge nøklene er satt", () => {
    expect(setup({ ...anthropic, ...openai }).provider).toBe("anthropic");
  });

  it("lar AAFK_CHAT_PROVIDER avgjøre når begge er satt", () => {
    const chosen = setup({ ...anthropic, ...openai, AAFK_CHAT_PROVIDER: "openai" });
    expect(chosen).toEqual({ provider: "openai", model: DEFAULT_MODELS.openai });
  });

  it("bryr seg ikke om store bokstaver eller mellomrom i overstyringen", () => {
    expect(setup({ ...openai, AAFK_CHAT_PROVIDER: " OpenAI " }).provider).toBe("openai");
  });

  it("lar AAFK_CHAT_MODEL gjelde den leverandøren som er valgt", () => {
    expect(setup({ ...openai, AAFK_CHAT_MODEL: "gpt-5.6-luna" }).model).toBe("gpt-5.6-luna");
    expect(setup({ ...anthropic, AAFK_CHAT_MODEL: "claude-opus-5" }).model).toBe("claude-opus-5");
  });

  // Tom streng er det man får av en miljøvariabel som *står* i Vercel uten verdi.
  // Uten denne kontrollen ville den vunnet over en nøkkel som faktisk finnes.
  it("teller ikke en tom nøkkel som satt", () => {
    expect(setup({ ANTHROPIC_API_KEY: "  ", ...openai }).provider).toBe("openai");
    expect(error({ ANTHROPIC_API_KEY: "", OPENAI_API_KEY: "" })).toContain("verken");
  });

  it("sier hva som mangler når ingen nøkkel er satt", () => {
    const message = error({});
    expect(message).toContain("ANTHROPIC_API_KEY");
    expect(message).toContain("OPENAI_API_KEY");
  });

  it("sier fra når den valgte leverandøren mangler nøkkel", () => {
    const message = error({ ...anthropic, AAFK_CHAT_PROVIDER: "openai" });
    expect(message).toContain("OPENAI_API_KEY");
  });

  it("avviser en ukjent leverandør framfor å falle tilbake i stillhet", () => {
    const message = error({ ...anthropic, AAFK_CHAT_PROVIDER: "mistral" });
    expect(message).toContain("mistral");
  });
});
