-- Kjerneskjema: normaliserte tabeller bygget fra data/-katalogen.
--
-- Ingenting utenfor byggesteget skriver hit, og verken nettstedet, API-et, MCP-serveren
-- eller chatten leser herfra — de bruker public_api-viewene. Skillet er det som gjør at
-- chattens SQL-tilgang kan slippes løs uten at intern struktur blir en offentlig kontrakt.

CREATE SCHEMA IF NOT EXISTS core;

CREATE TABLE IF NOT EXISTS core.clubs (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  short_name  text,
  country     text NOT NULL DEFAULT 'NO',
  city        text,
  founded     integer,
  -- Tidsavhengige navn: [{name, from, to}]. Slås opp mot kampdato ved visning.
  names       jsonb NOT NULL DEFAULT '[]'::jsonb,
  aliases     jsonb NOT NULL DEFAULT '{}'::jsonb,
  note        text
);

CREATE TABLE IF NOT EXISTS core.venues (
  id        text PRIMARY KEY,
  name      text NOT NULL,
  city      text,
  country   text NOT NULL DEFAULT 'NO',
  capacity  integer,
  opened    integer,
  closed    integer,
  names     jsonb NOT NULL DEFAULT '[]'::jsonb,
  note      text
);

CREATE TABLE IF NOT EXISTS core.competitions (
  id         text PRIMARY KEY,
  name       text NOT NULL,
  type       text NOT NULL CHECK (type IN ('league','national_cup','european','friendly','playoff')),
  tier       integer,
  organizer  text,
  country    text,
  names      jsonb NOT NULL DEFAULT '[]'::jsonb,
  note       text
);

CREATE TABLE IF NOT EXISTS core.sources (
  id        text PRIMARY KEY,
  name      text NOT NULL,
  url       text,
  priority  integer NOT NULL,
  license   text,
  note      text
);

CREATE TABLE IF NOT EXISTS core.seasons (
  year            integer PRIMARY KEY,
  competition_id  text NOT NULL REFERENCES core.competitions(id),
  final_position  integer,
  teams_in_league integer,
  head_coach      text,
  promoted        boolean NOT NULL DEFAULT false,
  relegated       boolean NOT NULL DEFAULT false,
  note            text
);

CREATE TABLE IF NOT EXISTS core.matches (
  id                text PRIMARY KEY,
  match_date        date NOT NULL,
  date_confidence   text NOT NULL DEFAULT 'exact'
                      CHECK (date_confidence IN ('exact','month','year')),
  kickoff           time,
  status            text NOT NULL
                      CHECK (status IN ('scheduled','played','abandoned','awarded','cancelled','postponed')),

  competition_id    text NOT NULL REFERENCES core.competitions(id),
  season            integer NOT NULL,
  stage             text NOT NULL DEFAULT 'regular_season',
  round             integer,
  leg               integer,
  group_name        text,

  home_club_id      text NOT NULL REFERENCES core.clubs(id),
  away_club_id      text NOT NULL REFERENCES core.clubs(id),
  home_score        integer,
  away_score        integer,
  home_ht_score     integer,
  away_ht_score     integer,
  home_et_score     integer,
  away_et_score     integer,
  home_pens         integer,
  away_pens         integer,

  venue_id          text REFERENCES core.venues(id),
  neutral_venue     boolean NOT NULL DEFAULT false,
  attendance        integer,
  referee           text,

  -- Avledet ved synkronisering fra YAML, ikke beregnet i SQL. Å ha én implementasjon
  -- i TypeScript (packages/schema/derive.ts) som både testene og databasen bruker er
  -- det som hindrer at visningen og forventningene gliser fra hverandre.
  is_home           boolean NOT NULL,
  opponent_club_id  text NOT NULL REFERENCES core.clubs(id),
  aafk_score        integer,
  opponent_score    integer,
  goal_difference   integer,
  result            text CHECK (result IN ('S','U','T')),
  decided_on_pens   boolean NOT NULL DEFAULT false,
  won_on_pens       boolean,

  events            jsonb NOT NULL DEFAULT '[]'::jsonb,
  lineups           jsonb,
  stats             jsonb,
  report_summary    text,
  report_body       text,
  report_byline     text,
  external_reports  jsonb NOT NULL DEFAULT '[]'::jsonb,
  sources           jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence        text NOT NULL DEFAULT 'probable'
                      CHECK (confidence IN ('confirmed','probable','disputed')),
  conflicts         jsonb NOT NULL DEFAULT '[]'::jsonb,
  tags              text[] NOT NULL DEFAULT '{}',
  aliases           jsonb NOT NULL DEFAULT '{}'::jsonb,
  completeness      numeric(3,2) NOT NULL DEFAULT 0,
  missing_fields    text[] NOT NULL DEFAULT '{}',
  note              text,
  source_file       text NOT NULL,

  -- Fritekstsøk over referat. 'simple' og ikke 'norwegian': ordbøkene stemmer dårlig
  -- med egennavn og klubbnavn, og vi søker mest etter navn og steder.
  report_tsv        tsvector GENERATED ALWAYS AS (
                      to_tsvector('simple',
                        coalesce(report_summary,'') || ' ' || coalesce(report_body,''))
                    ) STORED
);

CREATE INDEX IF NOT EXISTS matches_date_idx        ON core.matches (match_date DESC);
CREATE INDEX IF NOT EXISTS matches_season_idx      ON core.matches (season);
CREATE INDEX IF NOT EXISTS matches_opponent_idx    ON core.matches (opponent_club_id);
CREATE INDEX IF NOT EXISTS matches_competition_idx ON core.matches (competition_id);
CREATE INDEX IF NOT EXISTS matches_result_idx      ON core.matches (result);
CREATE INDEX IF NOT EXISTS matches_report_tsv_idx  ON core.matches USING gin (report_tsv);

-- Bruksmåling for chatten. Ligger i Postgres i stedet for Redis for å holde
-- tjenestelisten på én. Nøkkelen er en hash av IP-en, aldri IP-en selv.
CREATE TABLE IF NOT EXISTS core.chat_usage (
  id           bigserial PRIMARY KEY,
  ip_hash      text NOT NULL,
  asked_at     timestamptz NOT NULL DEFAULT now(),
  question     text NOT NULL,
  sql_run      text,
  duration_ms  integer,
  input_tokens integer,
  output_tokens integer,
  error        text
);

CREATE INDEX IF NOT EXISTS chat_usage_ip_time_idx ON core.chat_usage (ip_hash, asked_at DESC);
CREATE INDEX IF NOT EXISTS chat_usage_time_idx    ON core.chat_usage (asked_at DESC);

-- Samme mønster for bidragsskjemaet.
CREATE TABLE IF NOT EXISTS core.contribution_log (
  id           bigserial PRIMARY KEY,
  ip_hash      text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  match_id     text,
  pr_number    integer,
  accepted     boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS contribution_ip_time_idx ON core.contribution_log (ip_hash, created_at DESC);
