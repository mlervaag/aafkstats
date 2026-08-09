import type { HistoryTurn } from "@/lib/chat-request";

export const FOLLOW_UP_TOOL_NAME = "suggest_follow_up";
export const MAX_FOLLOW_UP_QUESTION_CHARS = 240;
export const MAX_FOLLOW_UP_LABEL_CHARS = 48;
export const MAX_FOLLOW_UP_PROMPT_CHARS = 1000;

export interface FollowUp {
  question: string;
  yesLabel: string;
  yesPrompt: string;
}

export interface ConversationTurn {
  id: string;
  question: string;
  answer: string;
  queries: { sql: string; durationMs: number; rowCount: number; error?: string }[];
  followUp: FollowUp | null;
  state: "loading" | "done" | "error";
  error?: string;
}

/** Klienten og begge modelløkkene bruker samme validering av modellens forslag. */
export function parseFollowUp(input: unknown): FollowUp | null {
  if (typeof input !== "object" || input === null) return null;
  const value = input as Record<string, unknown>;
  const question = clean(value.question, MAX_FOLLOW_UP_QUESTION_CHARS);
  const yesLabel = clean(value.yesLabel, MAX_FOLLOW_UP_LABEL_CHARS);
  const yesPrompt = clean(value.yesPrompt, MAX_FOLLOW_UP_PROMPT_CHARS);
  if (!question || !yesLabel || !yesPrompt) return null;
  return { question, yesLabel, yesPrompt };
}

function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (text === "" || text.length > max) return null;
  return text;
}

/** Historikken er kort og består bare av ferdige svar som brukeren faktisk har sett. */
export function historyFromTurns(turns: ConversationTurn[]): HistoryTurn[] {
  return turns
    .filter((turn) => turn.state === "done" && turn.answer.trim() !== "")
    .flatMap((turn): HistoryTurn[] => [
      { role: "user", content: turn.question },
      { role: "assistant", content: turn.answer },
    ])
    .slice(-6);
}

/** Én modellkjøring kan registrere høyst ett forslag, uansett antall verktøykall. */
export function createFollowUpCollector() {
  let current: FollowUp | null = null;
  return {
    suggest(candidate: FollowUp): boolean {
      if (current !== null) return false;
      current = candidate;
      return true;
    },
    get(): FollowUp | null {
      return current;
    },
  };
}

/** Et verktøyforslag blir synlig bare når hovedsvaret faktisk ble fullført. */
export function completedFollowUp(
  suggestion: FollowUp | null,
  answerLength: number,
  failure: string | null,
): FollowUp | null {
  return suggestion !== null && answerLength > 0 && failure === null ? suggestion : null;
}

export const followUpJsonSchema = {
  type: "object",
  properties: {
    question: { type: "string", minLength: 1, maxLength: MAX_FOLLOW_UP_QUESTION_CHARS },
    yesLabel: { type: "string", minLength: 1, maxLength: MAX_FOLLOW_UP_LABEL_CHARS },
    yesPrompt: { type: "string", minLength: 1, maxLength: MAX_FOLLOW_UP_PROMPT_CHARS },
  },
  required: ["question", "yesLabel", "yesPrompt"],
  additionalProperties: false,
} as const;
