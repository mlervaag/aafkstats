-- public_api: det publiserte datasettet.
--
-- Dette er den offentlige kontrakten. Nettstedet, REST-API-et, MCP-serveren og chatten
-- leser kun herfra, og chat-rollen har SELECT kun på dette skjemaet. Kolonnenavnene er
-- valgt for å leses av et menneske i en SQL-spørring, ikke for normalisering.

CREATE SCHEMA IF NOT EXISTS public_api;

-- Slår opp navnet som gjaldt på en gitt dato.
-- Klubber, stadion og konkurranser bytter navn; en kamp fra 1998 skal si «Tippeligaen»,
-- ikke «Eliteserien». IMMUTABLE så den kan brukes i indekser og planlegges effektivt.
CREATE OR REPLACE FUNCTION core.name_at(names jsonb, fallback text, at date)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT coalesce(
    (
      SELECT entry->>'name'
      FROM jsonb_array_elements(coalesce(names, '[]'::jsonb)) AS entry
      WHERE (entry->>'from' IS NULL OR at >= (entry->>'from')::date)
        AND (entry->>'to'   IS NULL OR at <= (entry->>'to')::date)
      ORDER BY (entry->>'from') NULLS FIRST
      LIMIT 1
    ),
    fallback
  );
$$;

-- ---------------------------------------------------------------------------
-- public_api.matches — én rad per kamp, sett fra AaFKs synsvinkel.
--
-- Den viktigste avgjørelsen i hele databasen. I stedet for hjemme/borte-kolonner der
-- man må vite hvilken side AaFK spilte på, er hver kamp flatet ut til «oss» og
-- «motstander». Det gjør spørsmål som «når tapte vi sist med 6 mål på hjemmebane?»
-- til én WHERE-setning i stedet for et resonnement modellen kan bomme på.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public_api.matches AS
SELECT
  m.id                                        AS match_id,
  m.match_date                                AS date,
  m.season,
  m.date_confidence,
  m.kickoff,
  m.status,

  core.name_at(comp.names, comp.name, m.match_date) AS competition,
  comp.type                                   AS competition_type,
  comp.tier                                   AS competition_tier,
  m.stage,
  m.round,

  m.is_home,
  core.name_at(opp.names, opp.name, m.match_date)   AS opponent,
  m.opponent_club_id,

  m.aafk_score,
  m.opponent_score,
  m.goal_difference,
  m.result,
  m.decided_on_pens                           AS decided_on_penalties,
  m.won_on_pens                               AS won_on_penalties,

  core.name_at(v.names, v.name, m.match_date) AS venue,
  m.neutral_venue,
  m.attendance,
  m.referee,

  m.report_summary,
  m.confidence,
  jsonb_array_length(m.conflicts) > 0         AS has_conflicts,
  m.completeness,
  m.tags,
  '/kamp/' || m.id                            AS url
FROM core.matches m
JOIN core.competitions comp ON comp.id = m.competition_id
JOIN core.clubs opp         ON opp.id  = m.opponent_club_id
LEFT JOIN core.venues v     ON v.id    = m.venue_id;

COMMENT ON VIEW public_api.matches IS
  'Én rad per kamp, sett fra AaFKs synsvinkel. is_home sier om AaFK spilte hjemme; '
  'aafk_score/opponent_score er alltid AaFK først; goal_difference er negativ ved tap; '
  'result er S (seier), U (uavgjort) eller T (tap), regnet etter ordinær tid pluss '
  'ekstraomgang. Straffekonkurranse gir result U — se won_on_penalties.';

-- ---------------------------------------------------------------------------
-- public_api.seasons — ett sammendrag per sesong.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public_api.seasons AS
SELECT
  s.year                                                AS season,
  core.name_at(comp.names, comp.name, make_date(s.year, 7, 1)) AS competition,
  comp.type                                             AS competition_type,
  comp.tier                                             AS competition_tier,
  s.final_position,
  s.teams_in_league,
  s.head_coach,
  s.promoted,
  s.relegated,
  count(m.id) FILTER (WHERE m.status = 'played')        AS played,
  count(m.id) FILTER (WHERE m.result = 'S')             AS wins,
  count(m.id) FILTER (WHERE m.result = 'U')             AS draws,
  count(m.id) FILTER (WHERE m.result = 'T')             AS losses,
  coalesce(sum(m.aafk_score), 0)                        AS goals_for,
  coalesce(sum(m.opponent_score), 0)                    AS goals_against,
  coalesce(sum(m.goal_difference), 0)                   AS goal_difference,
  round(avg(m.attendance) FILTER (WHERE m.is_home))     AS avg_home_attendance,
  '/sesong/' || s.year                                  AS url
FROM core.seasons s
JOIN core.competitions comp ON comp.id = s.competition_id
LEFT JOIN core.matches m
  ON m.season = s.year AND m.competition_id = s.competition_id
GROUP BY s.year, comp.names, comp.name, comp.type, comp.tier,
         s.final_position, s.teams_in_league, s.head_coach, s.promoted, s.relegated;

COMMENT ON VIEW public_api.seasons IS
  'Ett sammendrag per sesong. Tallene dekker kun kamper i sesongens hovedkonkurranse — '
  'cup, europa og treningskamper er ikke med. Bruk public_api.matches for alt.';

-- ---------------------------------------------------------------------------
-- public_api.opponents — innbyrdes statistikk gjennom historien.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public_api.opponents AS
SELECT
  c.id                                            AS opponent_club_id,
  c.name                                          AS opponent,
  c.city,
  count(*) FILTER (WHERE m.status = 'played')     AS played,
  count(*) FILTER (WHERE m.result = 'S')          AS wins,
  count(*) FILTER (WHERE m.result = 'U')          AS draws,
  count(*) FILTER (WHERE m.result = 'T')          AS losses,
  coalesce(sum(m.aafk_score), 0)                  AS goals_for,
  coalesce(sum(m.opponent_score), 0)              AS goals_against,
  min(m.match_date)                               AS first_meeting,
  max(m.match_date) FILTER (WHERE m.status = 'played') AS last_meeting,
  '/motstander/' || c.id                          AS url
FROM core.matches m
JOIN core.clubs c ON c.id = m.opponent_club_id
GROUP BY c.id, c.name, c.city;

COMMENT ON VIEW public_api.opponents IS
  'Innbyrdes statistikk mot hver motstander, over hele arkivet og alle konkurranser.';

-- ---------------------------------------------------------------------------
-- public_api.match_events — mål, kort og innbyttere, én rad per hendelse.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public_api.match_events AS
SELECT
  m.id                                    AS match_id,
  m.match_date                            AS date,
  m.season,
  (e->>'minute')::int                     AS minute,
  (e->>'stoppage')::int                   AS stoppage,
  e->>'type'                              AS event_type,
  -- Oversatt fra hjemme/borte til AaFK-perspektiv, samme som resten av datasettet.
  CASE WHEN (e->>'team' = 'home') = m.is_home THEN 'aafk' ELSE 'opponent' END AS team,
  e->>'player'                            AS player,
  e->>'assist'                            AS assist,
  e->>'playerOff'                         AS player_off,
  '/kamp/' || m.id                        AS url
FROM core.matches m
CROSS JOIN LATERAL jsonb_array_elements(m.events) AS e;

COMMENT ON VIEW public_api.match_events IS
  'Én rad per kamphendelse. team er «aafk» eller «opponent», ikke hjemme/borte. '
  'Dekningen er ujevn: hendelser finnes stort sett bare for kamper fra ca. 2010.';

-- ---------------------------------------------------------------------------
-- public_api.reports — referat, med fritekstsøk.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public_api.reports AS
SELECT
  m.id                                        AS match_id,
  m.match_date                                AS date,
  m.season,
  core.name_at(opp.names, opp.name, m.match_date) AS opponent,
  m.is_home,
  m.result,
  m.report_summary                            AS summary,
  m.report_body                               AS body,
  m.report_byline                             AS byline,
  m.report_tsv                                AS search_vector,
  '/kamp/' || m.id                            AS url
FROM core.matches m
JOIN core.clubs opp ON opp.id = m.opponent_club_id
WHERE m.report_summary IS NOT NULL OR m.report_body IS NOT NULL;

COMMENT ON VIEW public_api.reports IS
  'Kampreferat. Alle tekster er skrevet for dette arkivet — aldri kopiert fra avis eller '
  'klubbside. Søk med: WHERE search_vector @@ plainto_tsquery(''simple'', ''ordet'').';

-- ---------------------------------------------------------------------------
-- public_api.sources — kildekatalogen, så svar kan forklare hvor data kommer fra.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public_api.sources AS
SELECT id AS source_id, name, url, priority, license, note
FROM core.sources;
