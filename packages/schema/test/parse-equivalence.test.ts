import { describe, expect, it } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { parse as parseWithYaml } from "yaml";
import { repoRoot } from "../src/load.js";
import { parseArchiveYaml } from "../src/yaml.js";

/**
 * Arkivet leses med js-yaml fordi det er drøyt ti ganger raskere enn `yaml` på
 * de tusenvis av filene, og lasten skjer mange ganger i én testkjøring. Farten
 * er bare verdt noe hvis de to leser dataene likt, og «likt» er ikke noe man
 * kan slutte seg til fra dokumentasjonen: YAML-bibliotek skiller lag på
 * randtilfeller som ustiterte datoer, tall med ledende null og «yes»/«no».
 *
 * Derfor leses hver eneste fil i arkivet med begge bibliotekene her, og
 * resultatene må være identiske. Skulle en framtidig datafil, eller en ny
 * versjon av et av bibliotekene, innføre et avvik, blir det en rød test med
 * filnavnet i — ikke en stille endring av hva arkivet inneholder.
 */
async function yamlFilesUnder(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await yamlFilesUnder(path)));
    else if (entry.name.endsWith(".yaml") || entry.name.endsWith(".yml")) out.push(path);
  }
  return out;
}

describe("YAML-lesing", () => {
  it("leser hver fil i arkivet likt med js-yaml og yaml", async () => {
    const root = repoRoot();
    const files = [
      ...(await yamlFilesUnder(join(root, "data"))),
      ...(await yamlFilesUnder(join(root, "fixtures", "data"))),
    ];

    // En tom liste ville gjort testen grønn uten å ha sammenlignet noe.
    expect(files.length).toBeGreaterThan(1000);

    const avvik: string[] = [];
    for (const file of files) {
      const text = await readFile(file, "utf8");
      const fraJsYaml = parseArchiveYaml(text);
      const fraYaml = parseWithYaml(text, { schema: "core" });
      if (!isDeepStrictEqual(fraJsYaml, fraYaml)) {
        avvik.push(file.slice(root.length + 1));
      }
    }

    expect(avvik).toEqual([]);
    // Romslig grense: testen leser hele arkivet med `yaml`, som er nettopp det
    // trege biblioteket lasten slapp unna. Den kostnaden betales én gang her,
    // ikke 41 ganger slik den ble før.
  }, 120_000);

  it("holder datoer som strenger, slik YAML 1.2s kjerneskjema krever", () => {
    // Uten kjerneskjemaet blir en usitert dato et Date-objekt, og da avhenger
    // typen på feltet av om den som skrev fila satte anførselstegn.
    const parsed = parseArchiveYaml("kickoff: 2026-09-04\nsitert: '2026-09-04'\n") as Record<
      string,
      unknown
    >;
    expect(parsed.kickoff).toBe("2026-09-04");
    expect(parsed.sitert).toBe("2026-09-04");
  });

  it("leser «no» og «yes» som strenger, ikke som boolske verdier", () => {
    // YAML 1.1 gjorde disse om til false/true. Et klubbnavn eller en landkode
    // som «no» ville da blitt borte på veien inn i arkivet.
    const parsed = parseArchiveYaml("land: no\nsvar: yes\nekte: true\n") as Record<string, unknown>;
    expect(parsed.land).toBe("no");
    expect(parsed.svar).toBe("yes");
    expect(parsed.ekte).toBe(true);
  });
});
