import { clubKey, type Transfer } from "@aafkstats/schema";
import { isMap, isSeq, parseDocument } from "yaml";

/**
 * To rader er samme hendelse bare når de beskriver samme avtaletype på samme
 * dato. En spiller kan både lånes og kjøpes fra samme klubb i én sesong.
 */
export function sameTransferEvent(left: Transfer, right: Transfer): boolean {
  const sameClub = left.clubId && right.clubId
    ? left.clubId === right.clubId
    : clubKey(left.club ?? "") === clubKey(right.club ?? "");
  return left.direction === right.direction
    && left.kind === right.kind
    && left.date === right.date
    && (left.season ?? null) === (right.season ?? null)
    && sameClub;
}

/**
 * Fletter nye overganger inn i et eksisterende YAML-dokument uten å bygge
 * personfila på nytt fra et JS-objekt. YAML-dokumentet beholder kommentarer,
 * nøkkelrekkefølge og skalartyper; bare transfers-sekvensen endres.
 */
export function mergeTransfersIntoYaml(source: string, additions: Transfer[]): string {
  if (additions.length === 0) return source;

  const document = parseDocument(source, { keepSourceTokens: true });
  if (document.errors.length > 0) {
    throw new Error(document.errors.map((error) => error.message).join("; "));
  }

  const transfers = document.get("transfers", true);
  if (transfers === undefined) {
    document.set("transfers", additions);
  } else if (!isSeq(transfers)) {
    throw new Error("transfers-feltet er ikke en liste");
  } else {
    for (const transfer of additions) transfers.add(document.createNode(transfer));
    transfers.items.sort((left, right) => {
      const leftDate = isMap(left) ? String(left.get("date") ?? "") : "";
      const rightDate = isMap(right) ? String(right.get("date") ?? "") : "";
      const leftId = isMap(left) ? String(left.get("id") ?? "") : "";
      const rightId = isMap(right) ? String(right.get("id") ?? "") : "";
      return leftDate.localeCompare(rightDate) || leftId.localeCompare(rightId);
    });
  }

  return document.toString({ lineWidth: 100 });
}
