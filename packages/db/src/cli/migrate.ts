import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { connect } from "../index.js";

const migrationsDir = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../migrations");
const reset = process.argv.includes("--reset");

// Passordet til chat-rollen. Lokalt holder en forutsigbar standardverdi; i produksjon
// settes CHAT_DB_PASSWORD, og DATABASE_URL_READONLY må bruke samme verdi.
const chatPassword = process.env.CHAT_DB_PASSWORD ?? "chat-local-dev";

const sql = connect();

try {
  if (reset) {
    console.log("Dropper core og public_api …");
    await sql.unsafe("DROP SCHEMA IF EXISTS public_api CASCADE");
    await sql.unsafe("DROP SCHEMA IF EXISTS core CASCADE");
  }

  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    const body = await readFile(join(migrationsDir, file), "utf8");

    // 003 bruker psql-variabelen :'chat_password'. Vi kjører ikke gjennom psql, så
    // vi setter den inn selv — med korrekt SQL-escaping av apostrofer.
    const prepared = body.replaceAll(
      ":'chat_password'",
      `'${chatPassword.replaceAll("'", "''")}'`,
    );

    process.stdout.write(`  ${file} … `);
    await sql.unsafe(prepared);
    console.log("ok");
  }

  console.log(`\n✓ ${files.length} migrasjoner kjørt.`);
} catch (err) {
  console.error("\n✗ Migrasjon feilet:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
