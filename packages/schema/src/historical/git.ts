import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { parse as parseYaml } from "yaml";
import type { z } from "zod";

const execFileAsync = promisify(execFile);

/**
 * Kjører git-kommandoer trygt med argumentarray for å unngå shell-injeksjon.
 */
export async function runGit(args: string[], cwd?: string): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd: cwd ?? process.cwd(),
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout.trim();
}

/**
 * Finner standard BASE-revisjon hvis ingen er oppgitt.
 * Forsøker merge-base mot origin/main, main, eller fallback til HEAD~1.
 */
export async function getDefaultBaseRevision(cwd?: string): Promise<string> {
  const candidates = ["origin/main", "main", "origin/master", "master"];
  for (const candidate of candidates) {
    try {
      const base = await runGit(["merge-base", candidate, "HEAD"], cwd);
      if (base) return base;
    } catch {
      // Prøv neste kandidat
    }
  }
  try {
    const headMinusOne = await runGit(["rev-parse", "HEAD~1"], cwd);
    if (headMinusOne) return headMinusOne;
  } catch {
    // Hvis ingen commits finnes bakover, returner HEAD
  }
  return "HEAD";
}

/**
 * Løser opp en git-ref (branch, tag, SHA) til fullcommit-SHA.
 * Kaster feil dersom referansen ikke eksisterer i git.
 */
export async function resolveGitSha(ref: string, cwd?: string): Promise<string> {
  if (ref === "working-tree" || ref === "HEAD" || ref === "") {
    try {
      return await runGit(["rev-parse", "HEAD"], cwd);
    } catch (err) {
      throw new Error(`Kunne ikke lese git HEAD: ${String(err)}`);
    }
  }
  try {
    return await runGit(["rev-parse", "--verify", `${ref}^{commit}`], cwd);
  } catch {
    throw new Error(`Ugyldig git-referanse: «${ref}» (finnes ikke som commit)`);
  }
}

/**
 * Lister alle YAML-filer i en gitt mappe under en git-ref eller fra disk.
 */
export async function listYamlFiles(
  ref: string | "working-tree" | null,
  relativeDir: string,
  repoRoot: string,
): Promise<string[]> {
  const normalizedDir = relativeDir.replace(/\\/g, "/").replace(/\/$/, "");

  if (!ref || ref === "working-tree") {
    const fullDir = join(repoRoot, normalizedDir);
    if (!existsSync(fullDir)) return [];
    const entries = await readdir(fullDir, { withFileTypes: true, recursive: true });
    return entries
      .filter((e) => e.isFile() && (e.name.endsWith(".yaml") || e.name.endsWith(".yml")))
      .map((e) => {
        const p = join(e.parentPath ?? fullDir, e.name);
        return relative(repoRoot, p).replace(/\\/g, "/");
      })
      .sort();
  }

  try {
    const stdout = await runGit(["ls-tree", "-r", "--name-only", ref, `${normalizedDir}/`], repoRoot);
    if (!stdout) return [];
    return stdout
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && (l.endsWith(".yaml") || l.endsWith(".yml")))
      .sort();
  } catch (err) {
    throw new Error(`Kunne ikke liste filer for ${ref}:${normalizedDir}: ${String(err)}`);
  }
}

/**
 * Leser råinnhold for mange filer i én operasjon ved hjelp av git cat-file --batch.
 */
export async function readFilesBatchFromGit(
  ref: string,
  relativeFilePaths: string[],
  repoRoot: string,
): Promise<Map<string, string>> {
  const resultMap = new Map<string, string>();
  if (relativeFilePaths.length === 0) return resultMap;

  return new Promise((resolve, reject) => {
    const child = spawn("git", ["cat-file", "--batch"], {
      cwd: repoRoot,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const chunks: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    let errOutput = "";
    child.stderr.on("data", (chunk: Buffer) => {
      errOutput += chunk.toString("utf8");
    });

    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code !== 0 && chunks.length === 0) {
        return reject(new Error(`git cat-file feilet med kode ${code}: ${errOutput}`));
      }

      const fullBuffer = Buffer.concat(chunks);
      let offset = 0;

      for (const filePath of relativeFilePaths) {
        if (offset >= fullBuffer.length) break;

        // Finn slutten på headerlinjen (<sha/ref> <type> <size>\n)
        const newlineIdx = fullBuffer.indexOf(0x0a, offset);
        if (newlineIdx === -1) break;

        const headerLine = fullBuffer.subarray(offset, newlineIdx).toString("utf8").trim();
        offset = newlineIdx + 1;

        if (headerLine.endsWith("missing")) {
          continue;
        }

        const parts = headerLine.split(" ");
        if (parts.length < 3) continue;

        const size = Number.parseInt(parts[2]!, 10);
        if (Number.isNaN(size)) continue;

        const content = fullBuffer.subarray(offset, offset + size).toString("utf8");
        resultMap.set(filePath, content);

        // Hopp over innholdet + påfølgende newline (\n)
        offset += size + 1;
      }

      resolve(resultMap);
    });

    for (const filePath of relativeFilePaths) {
      child.stdin.write(`${ref}:${filePath.replace(/\\/g, "/")}\n`);
    }
    child.stdin.end();
  });
}

/**
 * Laster og validerer en samling YAML-filer fra git ref eller disk inn i et map etter ID.
 */
export async function loadYamlMap<TSchema extends z.ZodTypeAny>(
  ref: string | "working-tree" | null,
  relativeDir: string,
  schema: TSchema,
  repoRoot: string,
  getId?: (item: z.output<TSchema>, file: string) => string,
): Promise<{ items: Map<string, z.output<TSchema>>; rawYamls: Map<string, unknown>; errors: Array<{ file: string; message: string }> }> {
  const files = await listYamlFiles(ref, relativeDir, repoRoot);
  const items = new Map<string, z.output<TSchema>>();
  const rawYamls = new Map<string, unknown>();
  const errors: Array<{ file: string; message: string }> = [];

  let contentsMap: Map<string, string>;

  if (!ref || ref === "working-tree") {
    contentsMap = new Map();
    for (const file of files) {
      const fullPath = join(repoRoot, file);
      if (existsSync(fullPath)) {
        contentsMap.set(file, await readFile(fullPath, "utf8"));
      }
    }
  } else {
    contentsMap = await readFilesBatchFromGit(ref, files, repoRoot);
  }

  for (const [file, content] of contentsMap) {
    let raw: unknown;
    try {
      raw = parseYaml(content, { schema: "core" });
      rawYamls.set(file, raw);
    } catch (err) {
      errors.push({ file, message: `YAML parse error: ${String(err)}` });
      continue;
    }

    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      errors.push({ file, message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ") });
      continue;
    }

    const item = parsed.data;
    const defaultId = basename(file).replace(/\.ya?ml$/, "");
    const id = getId ? getId(item, file) : ((item as { id?: string }).id ?? defaultId);
    items.set(id, item);
  }

  return { items, rawYamls, errors };
}
