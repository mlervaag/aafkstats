-- SQLite-skjemaet for arkivet.
--
-- Bygges fra data/ ved hver utrulling og legges ved som en fil i funksjonsbunten.
-- Siden git er sannheten, kan dataene ikke endre seg mellom to utrullinger — et
-- byggetidsøyeblikksbilde er derfor alltid ferskt, ikke en cache som kan bli utdatert.
--
-- SQLite har ingen skjemaer, så skillet mellom internt og publisert uttrykkes med
-- navn: tabeller med core_-prefiks er interne, og viewene uten prefiks er den
-- offentlige kontrakten som nettstedet og spørrefunksjonen leser fra. Senere API- og
-- MCP-grensesnitt skal bruke den samme kontrakten når de blir bygget.

PRAGMA journal_mode = OFF;
PRAGMA synchronous = OFF;

-- ── Interne tabeller ────────────────────────────────────────────────────────

CREATE TABLE core_clubs (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  short_name  TEXT,
  country     TEXT NOT NULL DEFAULT 'NO',
  city        TEXT,
  founded     INTEGER,
  names       TEXT NOT NULL DEFAULT '[]',   -- JSON
  aliases     TEXT NOT NULL DEFAULT '{}',   -- JSON
  note        TEXT
);

CREATE TABLE core_venues (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  city      TEXT,
  country   TEXT NOT NULL DEFAULT 'NO',
  capacity  INTEGER,
  opened    INTEGER,
  closed    INTEGER,
  names     TEXT NOT NULL DEFAULT '[]',
  note      TEXT
);

CREATE TABLE core_competitions (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL
               CHECK (type IN ('league','national_cup','european','friendly','playoff')),
  tier       INTEGER,
  organizer  TEXT,
  country    TEXT,
  names      TEXT NOT NULL DEFAULT '[]',
  note       TEXT
);

CREATE TABLE core_sources (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  url       TEXT,
  priority  INTEGER NOT NULL,
  license   TEXT,
  note      TEXT
);

CREATE TABLE core_seasons (
  year             INTEGER PRIMARY KEY,
  competition_id   TEXT NOT NULL REFERENCES core_competitions(id),
  -- Navnet konkurransen hadde det året, slått opp ved bygging på samme måte som
  -- for kampene. Uten dette sier sesongsiden «Eliteserien» for 2005 mens kampene
  -- samme år sier «Tippeligaen» — to svar på samme spørsmål.
  competition_name TEXT NOT NULL,
  final_position   INTEGER,
  teams_in_league  INTEGER,
  head_coach       TEXT,
  promoted         INTEGER NOT NULL DEFAULT 0,
  relegated        INTEGER NOT NULL DEFAULT 0,
  note             TEXT
);

CREATE TABLE core_matches (
  id               TEXT PRIMARY KEY,
  match_date       TEXT NOT NULL,          -- 'YYYY-MM-DD'. Sorterer riktig som tekst.
  date_confidence  TEXT NOT NULL DEFAULT 'exact'
                     CHECK (date_confidence IN ('exact','month','year')),
  kickoff          TEXT,
  status           TEXT NOT NULL
                     CHECK (status IN ('scheduled','played','abandoned','awarded','cancelled','postponed')),

  competition_id   TEXT NOT NULL REFERENCES core_competitions(id),
  season           INTEGER NOT NULL,
  stage            TEXT NOT NULL DEFAULT 'regular_season',
  round            INTEGER,
  leg              INTEGER,
  group_name       TEXT,

  home_club_id     TEXT NOT NULL REFERENCES core_clubs(id),
  away_club_id     TEXT NOT NULL REFERENCES core_clubs(id),
  home_score       INTEGER,
  away_score       INTEGER,
  home_ht_score    INTEGER,
  away_ht_score    INTEGER,
  home_et_score    INTEGER,
  away_et_score    INTEGER,
  home_pens        INTEGER,
  away_pens        INTEGER,

  venue_id         TEXT REFERENCES core_venues(id),
  neutral_venue    INTEGER NOT NULL DEFAULT 0,
  attendance       INTEGER,
  referee          TEXT,

  -- Avledet ved bygging av toAafkPerspective() i packages/schema, ikke i SQL.
  -- Én implementasjon delt av databasen og testene, så de ikke kan bli uenige.
  is_home          INTEGER NOT NULL,
  opponent_club_id TEXT NOT NULL REFERENCES core_clubs(id),
  aafk_score       INTEGER,
  opponent_score   INTEGER,
  goal_difference  INTEGER,
  result           TEXT CHECK (result IN ('S','U','T')),
  after_extra_time INTEGER NOT NULL DEFAULT 0,
  decided_on_pens  INTEGER NOT NULL DEFAULT 0,
  won_on_pens      INTEGER,

  -- Navnene som gjaldt på kampdatoen, slått opp ved bygging.
  --
  -- I Postgres-utkastet var dette en SQL-funksjon som kjørte per rad per spørring.
  -- Her er det løst én gang: navnet for en gitt kampdato kan aldri endre seg, så
  -- oppslaget hører hjemme i byggesteget. Enklere og raskere.
  competition_name TEXT NOT NULL,
  opponent_name    TEXT NOT NULL,
  venue_name       TEXT,

  events           TEXT NOT NULL DEFAULT '[]',
  lineups          TEXT,
  stats            TEXT,
  report_summary   TEXT,
  report_body      TEXT,
  report_byline    TEXT,
  external_reports TEXT NOT NULL DEFAULT '[]',
  sources          TEXT NOT NULL DEFAULT '[]',
  confidence       TEXT NOT NULL DEFAULT 'probable'
                     CHECK (confidence IN ('confirmed','probable','disputed')),
  conflicts        TEXT NOT NULL DEFAULT '[]',
  tags             TEXT NOT NULL DEFAULT '[]',
  aliases          TEXT NOT NULL DEFAULT '{}',
  completeness     REAL NOT NULL DEFAULT 0,
  missing_fields   TEXT NOT NULL DEFAULT '[]',
  note             TEXT,
  source_file      TEXT NOT NULL
);

CREATE INDEX matches_date_idx        ON core_matches (match_date DESC);
CREATE INDEX matches_season_idx      ON core_matches (season);
CREATE INDEX matches_opponent_idx    ON core_matches (opponent_club_id);
CREATE INDEX matches_competition_idx ON core_matches (competition_id);
CREATE INDEX matches_result_idx      ON core_matches (result);

-- ── Publisert kontrakt ──────────────────────────────────────────────────────

-- Én rad per kamp, sett fra AaFKs synsvinkel.
--
-- Den viktigste avgjørelsen i hele datasettet. I stedet for hjemme/borte-kolonner
-- der man må vite hvilken side AaFK spilte på, er hver kamp flatet ut til «oss» og
-- «motstander». Det gjør «når tapte vi sist med 6 mål på hjemmebane?» til én
-- WHERE-setning i stedet for et resonnement modellen kan bomme på.
CREATE VIEW matches AS
SELECT
  m.id                AS match_id,
  m.match_date        AS date,
  m.season,
  m.date_confidence,
  m.kickoff,
  m.status,
  m.competition_name  AS competition,
  c.type              AS competition_type,
  c.tier              AS competition_tier,
  m.stage,
  m.round,
  m.is_home,
  m.opponent_name     AS opponent,
  m.opponent_club_id,
  m.aafk_score,
  m.opponent_score,
  m.goal_difference,
  m.result,
  m.after_extra_time,
  m.decided_on_pens   AS decided_on_penalties,
  m.won_on_pens       AS won_on_penalties,
  m.venue_name        AS venue,
  m.neutral_venue,
  m.attendance,
  m.referee,
  m.report_summary,
  m.confidence,
  CASE WHEN json_array_length(m.conflicts) > 0 THEN 1 ELSE 0 END AS has_conflicts,
  m.completeness,
  m.tags,
  '/kamp/' || m.id    AS url
FROM core_matches m
JOIN core_competitions c ON c.id = m.competition_id;

-- Ett sammendrag per sesong. Dekker kun sesongens hovedkonkurranse.
CREATE VIEW seasons AS
SELECT
  s.year                                                    AS season,
  s.competition_name                                        AS competition,
  c.type                                                    AS competition_type,
  c.tier                                                    AS competition_tier,
  s.final_position,
  s.teams_in_league,
  s.head_coach,
  s.promoted,
  s.relegated,
  s.note,
  count(m.id)                                               AS played,
  sum(CASE WHEN m.result = 'S' THEN 1 ELSE 0 END)           AS wins,
  sum(CASE WHEN m.result = 'U' THEN 1 ELSE 0 END)           AS draws,
  sum(CASE WHEN m.result = 'T' THEN 1 ELSE 0 END)           AS losses,
  coalesce(sum(m.aafk_score), 0)                            AS goals_for,
  coalesce(sum(m.opponent_score), 0)                        AS goals_against,
  coalesce(sum(m.goal_difference), 0)                       AS goal_difference,
  CAST(round(avg(CASE WHEN m.is_home = 1 THEN m.attendance END)) AS INTEGER)
                                                            AS avg_home_attendance,
  '/sesong/' || s.year                                      AS url
FROM core_seasons s
JOIN core_competitions c ON c.id = s.competition_id
LEFT JOIN core_matches m
  ON m.season = s.year
 AND m.competition_id = s.competition_id
 AND m.status = 'played'
GROUP BY s.year;

-- Innbyrdes statistikk mot hver motstander, hele arkivet og alle konkurranser.
CREATE VIEW opponents AS
SELECT
  c.id                                              AS opponent_club_id,
  c.name                                            AS opponent,
  c.city,
  sum(CASE WHEN m.status = 'played' THEN 1 ELSE 0 END) AS played,
  sum(CASE WHEN m.result = 'S' THEN 1 ELSE 0 END)   AS wins,
  sum(CASE WHEN m.result = 'U' THEN 1 ELSE 0 END)   AS draws,
  sum(CASE WHEN m.result = 'T' THEN 1 ELSE 0 END)   AS losses,
  coalesce(sum(m.aafk_score), 0)                    AS goals_for,
  coalesce(sum(m.opponent_score), 0)                AS goals_against,
  min(m.match_date)                                 AS first_meeting,
  max(CASE WHEN m.status = 'played' THEN m.match_date END) AS last_meeting,
  '/motstander/' || c.id                            AS url
FROM core_matches m
JOIN core_clubs c ON c.id = m.opponent_club_id
GROUP BY c.id;

-- Én rad per kamphendelse. team er 'aafk' eller 'opponent', ikke hjemme/borte.
CREATE VIEW match_events AS
SELECT
  m.id                                    AS match_id,
  m.match_date                            AS date,
  m.season,
  json_extract(e.value, '$.minute')       AS minute,
  json_extract(e.value, '$.stoppage')     AS stoppage,
  json_extract(e.value, '$.type')         AS event_type,
  CASE WHEN (json_extract(e.value, '$.team') = 'home') = (m.is_home = 1)
       THEN 'aafk' ELSE 'opponent' END    AS team,
  json_extract(e.value, '$.player')       AS player,
  json_extract(e.value, '$.assist')       AS assist,
  json_extract(e.value, '$.playerOff')    AS player_off,
  '/kamp/' || m.id                        AS url
FROM core_matches m, json_each(m.events) e;

-- Kildekatalogen, så svar kan forklare hvor dataene kommer fra.
CREATE VIEW sources AS
SELECT id AS source_id, name, url, priority, license, note FROM core_sources;

-- Referat, som en FTS5-tabell.
--
-- Ett objekt som dekker begge bruksmåtene: `WHERE reports MATCH 'ord'` for
-- fritekstsøk, og `WHERE match_id = '…'` for oppslag. Kolonnene merket UNINDEXED
-- er ikke søkbare, men leses ut som vanlig — kun summary og body indekseres.
CREATE VIRTUAL TABLE reports USING fts5(
  match_id UNINDEXED,
  date     UNINDEXED,
  season   UNINDEXED,
  opponent UNINDEXED,
  is_home  UNINDEXED,
  result   UNINDEXED,
  summary,
  body,
  byline   UNINDEXED,
  url      UNINDEXED,
  tokenize = 'unicode61 remove_diacritics 0'
);
