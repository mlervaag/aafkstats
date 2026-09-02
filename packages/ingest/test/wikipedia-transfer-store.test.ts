import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import type { Transfer } from "@aafkstats/schema";
import {
  mergeTransfersIntoYaml,
  sameTransferEvent,
} from "../src/wikipedia-transfer-store.js";

function transfer(overrides: Partial<Transfer> = {}): Transfer {
  return {
    id: "inn-hodd-2013",
    direction: "in",
    kind: "loan",
    club: "Hødd",
    date: "2013",
    sources: [],
    providers: [],
    ...overrides,
  };
}

describe("sameTransferEvent", () => {
  it("skiller lån og permanent overgang fra samme klubb i samme sesong", () => {
    expect(sameTransferEvent(
      transfer(),
      transfer({ id: "inn-hodd-2013-2", kind: "transfer" }),
    )).toBe(false);
  });

  it("krever samme dato", () => {
    expect(sameTransferEvent(
      transfer(),
      transfer({ id: "inn-hodd-2013-2", date: "2013-08-09" }),
    )).toBe(false);
  });

  it("normaliserer klubbnavnet", () => {
    expect(sameTransferEvent(transfer(), transfer({ club: "Hodd" }))).toBe(true);
  });
});

describe("mergeTransfersIntoYaml", () => {
  it("beholder resten av personfila og legger til i eksisterende liste", () => {
    const source = `# behold kommentaren\nid: test\nname: Test\ntransfers:\n  - id: ut-brann-2012\n    direction: out\n    kind: transfer\n    club: Brann\n    date: 2012\n    sources: []\n    providers: []\nroles: []\n`;
    const result = mergeTransfersIntoYaml(source, [transfer()]);
    const value = parse(result);

    expect(result).toContain("# behold kommentaren");
    expect(value.roles).toEqual([]);
    expect(value.transfers).toHaveLength(2);
    expect(value.transfers[1].id).toBe("inn-hodd-2013");
  });

  it("oppretter transfers-feltet når det mangler", () => {
    const result = mergeTransfersIntoYaml("id: test\nname: Test\n", [transfer()]);
    expect(parse(result).transfers).toEqual([transfer()]);
  });

  it("avviser et eksisterende transfers-felt som ikke er en liste", () => {
    expect(() => mergeTransfersIntoYaml("id: test\ntransfers: feil\n", [transfer()]))
      .toThrow("transfers-feltet er ikke en liste");
  });
});
