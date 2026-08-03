import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { crossValidate, loadArchive, repoRoot } from "@aafkstats/schema/load";
import { coverageReport, discoverRange } from "../adapters/rsssf-discover.js";
import { assertMayFetch } from "../policy.js";

/**
 * Kartlegger hva RSSSF har, uten å skrive noe.
 *
 * Skiller seg fra høste-CLI-ene på ett punkt som betyr noe: den kan ikke skrive.
 * Det er ikke en mangel — å undersøke hva en kilde inneholder er nettopp det man
 * må gjøre for å kunne be om tillatelse til å bruke den, og de to stegene skal
 * ikke kunne gli over i hverandre ved et uhell.
 */

interface Args {
  from: number;
  to: number;
  refresh: boolean;
  report?: string;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const root = resolve(repoRoot(), "data");

  const archive = await loadArchive(root);
  const issues = [...archive.issues, ...crossValidate(archive)];
  if (issues.length > 0) throw new Error(`arkivet har ${issues.length} valideringsfeil`);

  // Bare hentingsporten. Publisering er ikke aktuelt her — kommandoen skriver ikke.
  assertMayFetch(archive, "rsssf");

  const years = args.to - args.from + 1;
  console.log(`RSSSF-kartlegging ${args.from}–${args.to} (${years} årganger, ingen skriving)`);

  const pages = await discoverRange({
    from: args.from,
    to: args.to,
    refresh: args.refresh,
    onProgress: (line) => console.log(`  ${line}`),
  });

  const withAafk = pages.filter((page) => page.aafkMatches > 0);
  const total = withAafk.reduce((sum, page) => sum + page.aafkMatches, 0);
  const review = pages.filter((page) => page.needsReview);

  console.log(
    `\n${pages.length} sider undersøkt · ${withAafk.length} med AaFK-kamper · ` +
      `${total} kamper funnet · ${review.length} bør kontrolleres`,
  );

  for (const page of review) {
    console.error(
      `KONTROLL ${page.year} ${page.page}: indeksen sier «${page.labelledAs}», ` +
        `innholdet er «${page.kind}»${page.parseFailures ? `, ${page.parseFailures} parsefeil` : ""}`,
    );
  }

  if (args.report) {
    const path = resolve(repoRoot(), args.report);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(
      path,
      coverageReport(pages, { generatedAt: new Date().toISOString().slice(0, 10) }),
      "utf8",
    );
    console.log(`Rapport: ${path}`);
  } else {
    console.log("Bruk --report docs/data/RSSSF_DEKNINGSKART.md for å lagre kartet.");
  }
}

function parseArgs(argv: string[]): Args {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]!;
    if (arg === "--") continue;
    if (!arg.startsWith("--")) throw new Error(`ukjent argument: ${arg}`);
    if (arg === "--refresh") {
      flags.add(arg);
    } else {
      const value = argv[++index];
      if (!value || value.startsWith("--")) throw new Error(`${arg} krever en verdi`);
      values.set(arg, value);
    }
  }

  const from = Number(values.get("--from"));
  const to = Number(values.get("--to"));
  if (!Number.isInteger(from) || !Number.isInteger(to)) {
    throw new Error("bruk: --from ÅR --to ÅR [--report STI] [--refresh]");
  }
  if (from < 1902 || to > 2100 || from > to) throw new Error("--from/--to er utenfor arkivets område");
  // Hver årgang er ett indekskall pluss én forespørsel per side, med fartsgrense
  // på drøyt sekundet. En full kjøring over 1914-1979 er rundt 400 forespørsler og
  // tar noen minutter. Taket hindrer at noen ved et uhell ber om hele 1900-tallet.
  if (to - from > 70) throw new Error("--from/--to spenner over mer enn 70 år; del opp kjøringen");

  return { from, to, refresh: flags.has("--refresh"), report: values.get("--report") };
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
