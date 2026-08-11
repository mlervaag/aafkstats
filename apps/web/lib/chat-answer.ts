import { SITE_ORIGIN } from "@/lib/site";

export const ARCHIVE_ORIGIN = SITE_ORIGIN;

const RELATIVE_MARKDOWN_LINK = /(\[[^\]]+\]\()\/(?!\/)([^)\s]+)(\))/g;
const ABSOLUTE_MARKDOWN_LINK = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;

/** Gjør interne lenker brukbare utenfor nettstedet, også i eldre modellsvar. */
export function absolutizeAnswerLinks(text: string): string {
  return text.replace(
    RELATIVE_MARKDOWN_LINK,
    `$1${ARCHIVE_ORIGIN}/$2$3`,
  );
}

/** Lager tekst som meldingsapper kan lenkegjenkjenne uten støtte for Markdown. */
export function shareableAnswerText(text: string): string {
  return absolutizeAnswerLinks(text).replace(
    ABSOLUTE_MARKDOWN_LINK,
    (_match, label: string, url: string) => `${label}: ${url}`,
  );
}
