# Agent Rules for AaFK-arkivet

This project relies on strict architectural boundaries and a "git-is-the-source-of-truth" model. When acting as an agent on this repository, you MUST follow these governance rules to prevent architecture and data drift.

## 1. Git is the Source of Truth
- The raw data lives in YAML files in `data/`. This is the single source of truth.
- **NEVER** edit the SQLite database directly. The database is a build-time derivative.
- If you change data in `data/`, you MUST rebuild the database by running `pnpm db:build` (or `AAFK_DATA_DIR=fixtures/data pnpm db:build` for test data) before running the app or tests.

## 2. Validation is Mandatory
Before proposing a PR or claiming a task is done, you MUST run and pass the following:
```sh
pnpm validate
AAFK_DATA_DIR=fixtures/data pnpm validate
pnpm typecheck
pnpm lint
pnpm test
```
The CI enforces this. `pnpm validate` checks the integrity of the data in `data/`. Test suites use `fixtures/data`, not real data, to remain deterministic.

## 3. The Contract (Datamodel and Schema)
If you add a field to the data model, it must be updated in **four** places:
1. `packages/schema`: The Zod schema.
2. `packages/db/src/schema.sql`: The SQLite tables (`core_*`) and views.
3. `packages/db/src/build.ts`: The build step logic.
4. `packages/query/src/dataset.ts`: The dataset documentation for the LLM. 
*Note: A test will intentionally fail if `packages/query/src/dataset.ts` is not synced with the actual database views.*

## 4. Documentation and Governance Drift
- Keep `README.md`, `docs/ARKITEKTUR.md`, and `docs/DATAMODELL.md` up-to-date with any architecture or data changes. 
- If you update stats, check the `README.md` and `packages/db/README.md` to ensure numbers match the reality of the database.
- Read `docs/ARKITEKTUR.md` before making any structural changes or adding dependencies.

## 5. Coding Standards and Language
- **Norwegian Language:** Use Norwegian for comments, commit messages, error messages, and user interfaces.
- **Commit Messages:** Written in Norwegian imperative (e.g., "Legg til tilskuertall for 1998"). No `feat:` or `fix:` prefixes.
- **Code:** Standard strict TypeScript. 
- **Comments:** Explain *why* something is done, not *what*. 

## 6. Ingesting Data (Scraping)
- An adapter is NOT a crawler. Never build tools that automatically backfill or scrape everything at once. 
- You MUST dry-run by default. Use `--write` only when you explicitly want to save YAML files.
- Legal permission is data: Check `data/sources/*.yaml`. Never set status to `allowed` without proof.
