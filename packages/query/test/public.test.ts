import { describe, expect, it } from "vitest";
import { PUBLIC_TOOL_NAMES, publicTools, resolvePublicTools } from "../src/public.js";
import { toolsByName } from "../src/tools.js";

describe("offentlig verktøy-allowlist", () => {
  it("løser hvert navn og eksponerer aldri run_sql", () => {
    expect(publicTools.map((tool) => tool.name)).toEqual(PUBLIC_TOOL_NAMES);
    expect(publicTools.some((tool) => tool.name === "run_sql")).toBe(false);
  });

  it("feiler høyt dersom et allowlistet verktøy forsvinner", () => {
    const original = toolsByName.get("search_matches")!;
    toolsByName.delete("search_matches");
    try {
      expect(() => resolvePublicTools(["search_matches"])).toThrow("Offentlig verktøy finnes ikke: search_matches");
    } finally {
      toolsByName.set("search_matches", original);
    }
  });
});
