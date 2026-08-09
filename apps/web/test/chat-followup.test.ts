import { describe, expect, it } from "vitest";
import { systemPrompt } from "@aafkstats/query/prompt";
import {
  MAX_FOLLOW_UP_LABEL_CHARS,
  completedFollowUp,
  createFollowUpCollector,
  historyFromTurns,
  parseFollowUp,
  type ConversationTurn,
  type FollowUp,
} from "../lib/chat-followup.js";

const suggestion: FollowUp = {
  question: "Vil du se hvordan dette fordeler seg hjemme og borte?",
  yesLabel: "Ja, vis fordelingen",
  yesPrompt: "Vis hvordan dette fordeler seg hjemme og borte.",
};

function turn(overrides: Partial<ConversationTurn> = {}): ConversationTurn {
  return {
    id: "turn-1",
    question: "Hvem har AaFK tapt flest ganger mot?",
    answer: "Molde.",
    queries: [],
    followUp: null,
    state: "done",
    ...overrides,
  };
}

describe("strukturert oppfølging", () => {
  it("godtar et komplett og avgrenset forslag", () => {
    expect(parseFollowUp(suggestion)).toEqual(suggestion);
  });

  it("avviser tomme felt og en etikett som er for lang", () => {
    expect(parseFollowUp({ ...suggestion, yesPrompt: " " })).toBeNull();
    expect(parseFollowUp({
      ...suggestion,
      yesLabel: "x".repeat(MAX_FOLLOW_UP_LABEL_CHARS + 1),
    })).toBeNull();
  });

  it("beholder bare det første forslaget i én modellkjøring", () => {
    const collector = createFollowUpCollector();
    expect(collector.suggest(suggestion)).toBe(true);
    expect(collector.suggest({ ...suggestion, question: "Et annet forslag?" })).toBe(false);
    expect(collector.get()).toEqual(suggestion);
  });

  it("sender ikke forslag etter tomt eller feilet hovedsvar", () => {
    expect(completedFollowUp(suggestion, 12, null)).toEqual(suggestion);
    expect(completedFollowUp(suggestion, 0, null)).toBeNull();
    expect(completedFollowUp(suggestion, 12, "Modellen avslo")).toBeNull();
  });
});

describe("samtalehistorikk", () => {
  it("sender ferdige spørsmål og svar i riktig rekkefølge", () => {
    expect(historyFromTurns([turn()])).toEqual([
      { role: "user", content: "Hvem har AaFK tapt flest ganger mot?" },
      { role: "assistant", content: "Molde." },
    ]);
  });

  it("sender ikke feil eller uferdige svar tilbake til modellen", () => {
    expect(historyFromTurns([
      turn({ state: "loading" }),
      turn({ id: "turn-2", state: "error", error: "Feil" }),
    ])).toEqual([]);
  });

  it("begrenser klienthistorikken til tre tidligere runder", () => {
    const turns = Array.from({ length: 5 }, (_, index) => turn({
      id: `turn-${index}`,
      question: `Spørsmål ${index}`,
      answer: `Svar ${index}`,
    }));
    const history = historyFromTurns(turns);
    expect(history).toHaveLength(6);
    expect(history[0]).toEqual({ role: "user", content: "Spørsmål 2" });
  });
});

describe("systemprompten", () => {
  const prompt = systemPrompt();

  it("gjør oppfølging til et sjeldent, strukturert unntak", () => {
    expect(prompt).toContain("suggest_follow_up");
    expect(prompt).toContain("Som hovedregel avslutter du");
    expect(prompt).toContain("aldri også stå som siste setning");
    expect(prompt).toContain("Ikke bruk suggest_follow_up for å holde samtalen i gang");
  });
});
