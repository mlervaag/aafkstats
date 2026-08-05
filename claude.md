# Claude / Agent System Prompt for AaFK-arkivet

This file provides context for LLM agents (like Claude, Cursor, Cline, etc.) operating in this repository.

## Core Philosophy
- **Git is the source of truth.** The `data/` directory containing YAML files is the single source of truth for the entire database.
- **The database is a build-time derivative.** The SQLite database is built from the YAML files via `pnpm db:build`. **Never** edit the database directly. It is read-only.

## Workflow & Governance
When tasked with modifying data or code, you MUST adhere to the following workflow to prevent drift:

1. **Make changes to YAML (`data/`) or Code (`packages/`, `apps/`)**.
2. **Rebuild the database**: Always run `pnpm db:build` (or `AAFK_DATA_DIR=fixtures/data pnpm db:build` when running tests).
3. **Validate Data**: Run `pnpm validate` to check the integrity of the data against the schema.
4. **Test & Lint**: Run `pnpm typecheck`, `pnpm lint`, and `pnpm test`. Do not submit PRs if tests fail.
5. **Update Documentation**:
   - If you change the data model (`packages/schema`), you MUST update `packages/db/src/schema.sql`, `packages/db/src/build.ts`, and `packages/query/src/dataset.ts`. If `dataset.ts` is not updated, a test will intentionally fail because the LLM prompt must perfectly match the SQL views.
   - If you make structural changes, update `docs/ARKITEKTUR.md` and/or `docs/DATAMODELL.md`.
   - Ensure the stats in `README.md` and `packages/db/README.md` are aligned with the actual data (e.g. number of matches, seasons).

## Language Guidelines
- All comments, commit messages, and user-facing text MUST be in **Norwegian**.
- Commit messages must use the imperative tense in Norwegian (e.g., "Legg til kamp"). Do not use conventional commit prefixes (e.g., no `feat:` or `fix:`).
- Explain *why* in comments, not *what*.

## Data Ingestion & Rights
- When pulling data from sources, run ingest scripts in dry-run mode first. 
- You must check `data/sources/*.yaml` for legal permission before writing data using the `--write` flag. 
- Do not build automated crawlers; ingest scripts are explicitly designed to do one season or match at a time.

## Verification Checklist
Before completing a task, check:
- [ ] Did I run `pnpm validate`?
- [ ] Are all test commands passing?
- [ ] If I changed the database schema, did I update all 4 places (schema, db views, build script, dataset.ts)?
- [ ] Is my commit message in Norwegian imperative?
- [ ] Are docs synced with my changes?
