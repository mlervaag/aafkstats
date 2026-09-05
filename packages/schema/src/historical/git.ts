import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { parseArchiveYaml as parseYaml } from "../yaml.js";
import type { z } from "zod";

const execFileAsync = promisify(execFile);

const GIT_REF_REGEX = /^(?:HEAD(?:~\d+)?|[a-zA-Z0-9_./@{}^~-]+)$/;
const SHA_REGEX = /^[0-9a-f]{40}$/i;

/**
 * Validerer at en git-ref er syntaktisk trygg og ikke kan tolkes som en git-option.
 */
export function validateGitRef(ref: string): void {
  if (!ref || typeof ref !== "string") {
    throw new Error("Ugyldig git-referanse: referansen kan ikke være tom");
  }
  if (ref.startsWith("-")) {
    throw new Error(`Ugyldig git-referanse: «${ref}» kan ikke starte med «-»`);
  }
  if (/[\r\n\0\t\s]/.test(ref)) {
    throw new Error(`Ugyldig git-referanse: «${ref}» inneholder ugyldige tegn eller linjeskift`);
  }
  if (!GIT_REF_REGEX.test(ref)) {
    throw new Error(`Ugyldig git-referanse: «${ref}» inneholder ugyldige tegn`);
  }
}

/**
 * Validerer at en sti er repo-relativ og ikke forsøker path traversal (..) eller option injection.
 */
export function validateRepoRelativePath(relativePath: string): string {
  if (!relativePath || typeof relativePath !== "string") {
    throw new Error("Ugyldig sti: stien kan ikke være tom");
  }
  if (relativePath.startsWith("-")) {
    throw new Error(`Ugyldig sti: «${relativePath}» kan ikke starte med «-»`);
  }
  if (/[\r\n\0]/.test(relativePath)) {
    throw new Error(`Ugyldig sti: «${relativePath}» inneholder linjeskift eller NUL-tegn`);
  }
  const normalized = relativePath.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
  if (normalized.split("/").some((part) => part === ".." || part === ".")) {
    throw new Error(`Ugyldig sti: path traversal («..») er ikke tillatt («${relativePath}»)`);
  }
  return normalized;
}

/**
 * Finner standard BASE-revisjon hvis ingen er oppgitt.
 * Forsøker merge-base mot origin/main, main, eller fallback til HEAD~1.
 */
export async function getDefaultBaseRevision(cwd?: string): Promise<string> {
  const candidates = ["origin/main", "main", "origin/master", "master"];
  for (const candidate of candidates) {
    try {
      const { stdout } = await execFileAsync(
        "git",
        ["merge-base", "--end-of-options", candidate, "HEAD"],
        { cwd: cwd ?? process.cwd(), maxBuffer: 64 * 1024 * 1024 },
      );
      const base = stdout.trim();
      if (base && SHA_REGEX.test(base)) return base;
    } catch {
      // Prøv neste kandidat
    }
  }
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["rev-parse", "--verify", "--end-of-options", "HEAD~1^{commit}"],
      { cwd: cwd ?? process.cwd(), maxBuffer: 64 * 1024 * 1024 },
    );
    const headMinusOne = stdout.trim();
    if (headMinusOne && SHA_REGEX.test(headMinusOne)) return headMinusOne;
  } catch {
    // Hvis ingen commits finnes bakover, returner HEAD
  }
  return "HEAD";
}

/**
 * Løser opp en git-ref (branch, tag, SHA) til fullcommit-SHA.
 * Kaster feil dersom referansen ikke eksisterer i git eller er ugyldig.
 */
export async function resolveGitSha(ref: string, cwd?: string): Promise<string> {
  if (ref === "working-tree" || ref === "HEAD" || ref === "") {
    try {
      const { stdout } = await execFileAsync(
        "git",
        ["rev-parse", "--verify", "--end-of-options", "HEAD^{commit}"],
        { cwd: cwd ?? process.cwd(), maxBuffer: 64 * 1024 * 1024 },
      );
      const sha = stdout.trim();
      if (!SHA_REGEX.test(sha)) {
        throw new Error(`Ugyldig commit-SHA for HEAD: «${sha}»`);
      }
      return sha;
    } catch (err) {
      throw new Error(`Kunne ikke lese git HEAD: ${String(err)}`);
    }
  }

  validateGitRef(ref);

  try {
    const { stdout } = await execFileAsync(
      "git",
      ["rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`],
      { cwd: cwd ?? process.cwd(), maxBuffer: 64 * 1024 * 1024 },
    );
    const sha = stdout.trim();
    if (!SHA_REGEX.test(sha)) {
      throw new Error(`Ugyldig SHA mottatt: «${sha}»`);
    }
    return sha;
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
  const normalizedDir = validateRepoRelativePath(relativeDir);

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

  const sha = await resolveGitSha(ref, repoRoot);

  try {
    const { stdout } = await execFileAsync(
      "git",
      ["ls-tree", "-r", "--name-only", "--end-of-options", sha, `${normalizedDir}/`],
      { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 },
    );
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

  const sha = await resolveGitSha(ref, repoRoot);

  for (const filePath of relativeFilePaths) {
    validateRepoRelativePath(filePath);
  }

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
      child.stdin.write(`${sha}:${filePath.replace(/\\/g, "/")}\n`);
    }
    child.stdin.end();
  });
}

/**
 * Leser én enkelt fil fra en git-ref. Returnerer null dersom filen ikke fantes
 * i den revisjonen.
 */
export async function readFileFromGit(
  ref: string,
  relativeFilePath: string,
  repoRoot: string,
): Promise<string | null> {
  const normalized = validateRepoRelativePath(relativeFilePath);
  const sha = await resolveGitSha(ref, repoRoot);
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["show", "--end-of-options", `${sha}:${normalized}`],
      { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 },
    );
    return stdout;
  } catch {
    return null;
  }
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
  filterFile?: (file: string) => boolean,
): Promise<{ items: Map<string, z.output<TSchema>>; rawYamls: Map<string, unknown>; errors: Array<{ file: string; message: string }> }> {
  let files = await listYamlFiles(ref, relativeDir, repoRoot);
  if (filterFile) {
    files = files.filter(filterFile);
  }
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
      raw = parseYaml(content);
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
