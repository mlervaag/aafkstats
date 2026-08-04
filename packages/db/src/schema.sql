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
  -- Rettighetsstatus. «Kan hentes» og «kan publiseres» er to forskjellige
  -- spørsmål, og de holdes derfor i hvert sitt felt.
  automated_access       TEXT NOT NULL DEFAULT 'unknown',
  public_redistribution  TEXT NOT NULL DEFAULT 'unknown',
  attribution_required   INTEGER NOT NULL DEFAULT 0,
  -- Hva motparten har sagt. Vår egen beslutning ligger i ingest_decision, og de
  -- to er ulike spørsmål: RSSSF er forespurt uten svar, og videreført likevel.
  permission_status      TEXT NOT NULL DEFAULT 'pending',
  ingest_decision        TEXT NOT NULL DEFAULT 'pending',
  permission_requested_at TEXT,
  risk_accepted_at       TEXT,
  risk_accepted_by       TEXT,
  terms_checked_at       TEXT,
  robots_checked_at      TEXT,
  permission_note        TEXT,
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
  -- Forventet omfang, oppgitt for hånd. Brukes bare når sluttabellen ikke svarer;
  -- se coverage_evidence i seasons-viewet.
  expected_matches INTEGER,
  expected_rounds  INTEGER,
  head_coach       TEXT,
  promoted         INTEGER NOT NULL DEFAULT 0,
  relegated        INTEGER NOT NULL DEFAULT 0,
  note             TEXT
);

-- Sluttabellen for én konkurranse i én sesong, og AaFKs vei gjennom den.
--
-- Lagene bærer kildens eget navn. En divisjon har seksten lag og AaFK har aldri
-- møtt alle, så en klubbrad per lag ville betydd rundt 40 klubber i arkivet uten
-- en eneste kamp. `club_id` settes for dem vi kjenner fra før, og er NULL for
-- resten — en normal tilstand, ikke et hull.
CREATE TABLE core_standings (
  competition_id   TEXT NOT NULL REFERENCES core_competitions(id),
  season           INTEGER NOT NULL,
  position         INTEGER NOT NULL,
  team             TEXT NOT NULL,
  club_id          TEXT REFERENCES core_clubs(id),
  played           INTEGER NOT NULL,
  wins             INTEGER NOT NULL,
  draws            INTEGER NOT NULL,
  losses           INTEGER NOT NULL,
  goals_for        INTEGER NOT NULL,
  goals_against    INTEGER NOT NULL,
  -- Poeng slik tabellen viser dem. Regnes ikke ut: poengtrekk finnes, og to
  -- poeng for seier gjaldt til 1987.
  points           INTEGER NOT NULL,
  outcome          TEXT NOT NULL DEFAULT 'none'
                     CHECK (outcome IN ('promoted','relegated','promotion_playoff',
                                        'relegation_playoff','playoff','none')),
  note             TEXT,
  PRIMARY KEY (competition_id, season, position)
);

-- AaFKs plassering etter hver runde, regnet ut ved innhøsting av kildens fulle
-- runderekke. Kampene bak utregningen lagres ikke; se packages/schema/src/standings.ts.
CREATE TABLE core_standings_progression (
  competition_id   TEXT NOT NULL REFERENCES core_competitions(id),
  season           INTEGER NOT NULL,
  round            INTEGER NOT NULL,
  position         INTEGER NOT NULL,
  points           INTEGER NOT NULL,
  played           INTEGER NOT NULL,
  goal_difference  INTEGER NOT NULL,
  PRIMARY KEY (competition_id, season, round)
);

-- Personer det er noe å si om: draktnummer, posisjon, nasjonalitet, Wikidata-ID
-- eller en trenerperiode fra før kampdataene rekker. De fleste som har spilt har
-- ingen rad her, og finnes bare som et navn i en oppstilling.
--
-- person_key er den samme nøkkelen core_appearances bruker, slik at stallen kan
-- slås opp mot registeret uten å gjette.
CREATE TABLE core_people (
  id           TEXT PRIMARY KEY,
  person_key   TEXT NOT NULL,
  name         TEXT NOT NULL,
  nationality  TEXT,
  position     TEXT CHECK (position IN ('keeper','forsvar','midtbane','angrep')),
  wikidata     TEXT,
  note         TEXT
);

-- Skrivemåtene en person er kjent under, én rad per form. Brukes til å knytte et
-- navn fra en oppstilling til registeret når kildene staver det ulikt.
CREATE TABLE core_person_names (
  person_id    TEXT NOT NULL REFERENCES core_people(id),
  person_key   TEXT NOT NULL,
  name         TEXT NOT NULL,
  PRIMARY KEY (person_key, person_id)
);

CREATE TABLE core_squad_numbers (
  person_id    TEXT NOT NULL REFERENCES core_people(id),
  season       INTEGER NOT NULL,
  number       INTEGER NOT NULL,
  PRIMARY KEY (person_id, season)
);

-- Trenerperioder oppgitt av en kilde, ikke utledet av kampene. Se coach_spells.
CREATE TABLE core_declared_coach_spells (
  person_id    TEXT NOT NULL REFERENCES core_people(id),
  from_season  INTEGER NOT NULL,
  to_season    INTEGER,
  PRIMARY KEY (person_id, from_season)
);

-- Én rad per spiller per kamp. Utledet av lineups ved bygging, ikke lagret i
-- data/ — oppstillingen ligger allerede på kampen, og en egen fil per opptreden
-- ville vært samme opplysning to steder.
--
-- person_key slår sammen skrivemåter av samme navn; se personKey() i
-- packages/schema. name er den skrivemåten vi viser.
CREATE TABLE core_appearances (
  match_id    TEXT NOT NULL REFERENCES core_matches(id),
  season      INTEGER NOT NULL,
  person_key  TEXT NOT NULL,
  name        TEXT NOT NULL,
  -- 'start' eller 'bench'. Benken er de som sto oppført, ikke nødvendigvis de
  -- som kom inn: kilden skiller ikke, og å påstå noe annet ville vært å gjette.
  role        TEXT NOT NULL CHECK (role IN ('start','bench')),
  PRIMARY KEY (match_id, person_key)
);

-- Én rad per trener per kamp. Samme utledning, fra lineups.coach.
CREATE TABLE core_coach_matches (
  match_id    TEXT NOT NULL PRIMARY KEY REFERENCES core_matches(id),
  season      INTEGER NOT NULL,
  match_date  TEXT NOT NULL,
  person_key  TEXT NOT NULL,
  name        TEXT NOT NULL
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

-- Kampene som har funnet sted.
--
-- Én definisjon av «spilt», delt av alle aggregatene. Regelen sto tidligere tre
-- steder: `seasons` tok bare 'played', `opponents` talte kamper på én måte og
-- seire på en annen, og nettstedet hadde sin egen streng. Samme kamp kunne
-- dermed telles i forsidens totalsum og mangle i sesongsammendraget.
--
-- 'awarded' er med fordi en kamp avgjort på grønt bord har et resultat og ligger
-- bak oss. 'abandoned' er ikke med: en avbrutt kamp har ingen sluttstilling.
-- Statuslista er den samme som PLAYED_STATUSES i packages/db/src/index.ts, og
-- en test feiler hvis de to skiller lag.
CREATE VIEW core_played AS
SELECT * FROM core_matches WHERE status IN ('played', 'awarded');

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
  -- Siste gang en kilde ble hentet for denne kampen. Brukes til lastModified i
  -- sitemap, så søkemotorer får vite når opplysningen sist ble kontrollert i
  -- stedet for å anta at hele arkivet er like gammelt som byggetidspunktet.
  (SELECT max(json_extract(sv.value, '$.retrievedAt')) FROM json_each(m.sources) sv)
                      AS last_retrieved_at,
  m.note,
  m.tags,
  '/kamp/' || m.id    AS url
FROM core_matches m
JOIN core_competitions c ON c.id = m.competition_id;

-- Ett sammendrag per sesong OG konkurranse.
--
-- Var tidligere én rad per år, knyttet til core_seasons.competition_id. Det holdt
-- så lenge arkivet bare hadde serien. Med cup og treningskamper inne ble raden
-- feil på en stille måte: sesongposten peker på den konkurransen som tilfeldigvis
-- ble høstet først, og aggregatet talte bare den. Sesongen 1998 har 26 seriekamper
-- og 3 cupkamper, men sto med «Norgesmesterskapet, 3 kamper» — hele
-- divisjonssesongen var usynlig.
--
-- Sannheten om hvilke konkurranser et år inneholder ligger i kampene, så den
-- utledes derfra. core_seasons bidrar fortsatt med det bare den vet: sluttplass,
-- antall lag, trener, opp- og nedrykk og forbehold — men bare for den
-- konkurransen sesongposten faktisk gjelder.
CREATE VIEW seasons AS
SELECT
  m.season                                                  AS season,
  m.competition_id                                          AS competition_id,
  m.competition_name                                        AS competition,
  c.type                                                    AS competition_type,
  c.tier                                                    AS competition_tier,
  -- Sluttplassen kommer fra tabellen når vi har den, ellers fra sesongposten.
  -- core_seasons har feltet, men ingen har fylt det for en eneste sesong; tabellen
  -- vet svaret, og den vet det for alle lagene, ikke bare vårt.
  coalesce(
    (SELECT t.position FROM core_standings t
      WHERE t.competition_id = m.competition_id AND t.season = m.season
        AND t.club_id = 'aalesunds-fk'),
    s.final_position
  )                                                         AS final_position,
  coalesce(
    (SELECT count(*) FROM core_standings t
      WHERE t.competition_id = m.competition_id AND t.season = m.season),
    s.teams_in_league
  )                                                         AS teams_in_league,
  s.head_coach,
  coalesce(s.promoted, 0)                                   AS promoted,
  coalesce(s.relegated, 0)                                  AS relegated,
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

  -- Forventet antall seriekamper, og hvor tallet kommer fra.
  --
  -- Sluttabellen er førstevalget: står AaFK der med 26 spilte kamper, er 26
  -- fasiten, og den er kildeført. Finnes ingen tabell, kan sesongfila oppgi
  -- tallet for hånd, og da krever skjemaet en note som sier hvor det kommer fra.
  -- Finnes ingen av delene, vet vi ikke omfanget, og da kan ingen sesong kalles
  -- komplett.
  coalesce(
    (SELECT t.played FROM core_standings t
      WHERE t.competition_id = m.competition_id AND t.season = m.season
        AND t.club_id = 'aalesunds-fk'),
    s.expected_matches
  )                                                         AS expected_matches,

  -- Hvor godt sesongen er dekket, utledet av kampene og det forventede omfanget.
  --
  -- «85 sesonger» har hele tiden betydd 85 år med minst én registrert kamp. Det
  -- er noe annet enn 85 komplette sesonger, og forskjellen var usynlig for den
  -- som leste forsiden.
  --
  -- Den forrige utgaven svarte «komplett» på runde 1 til N uten hull. Det er
  -- sant også når den virkelige sesongen hadde 22 runder og arkivet har fem: da
  -- er runde 1 til 5 sammenhengende, og merket lyver. Nå kreves begge deler,
  -- sammenhengende runder OG et kjent forventet omfang som stemmer.
  --
  -- Cup og treningskamper har ingen slik struktur, en cupsesong slutter når
  -- laget ryker ut, så de svarer «ikke relevant» framfor å gjette.
  CASE
    WHEN c.type <> 'league' THEN 'not_applicable'
    WHEN (SELECT count(*) FROM core_matches u
           WHERE u.season = m.season AND u.competition_id = m.competition_id
             AND u.status = 'scheduled') > 0 THEN 'in_progress'
    WHEN count(m."round") = 0 THEN 'isolated'
    WHEN count(m."round") < count(m.id) THEN 'partial'
    WHEN min(m."round") <> 1
      OR count(DISTINCT m."round") <> count(m.id)
      OR max(m."round") <> count(m.id) THEN 'partial'
    -- Sammenhengende runder, men ingen vet hvor mange det skulle vært.
    WHEN coalesce(
           (SELECT t.played FROM core_standings t
             WHERE t.competition_id = m.competition_id AND t.season = m.season
               AND t.club_id = 'aalesunds-fk'),
           s.expected_matches
         ) IS NULL THEN 'unverified'
    WHEN count(m.id) = coalesce(
           (SELECT t.played FROM core_standings t
             WHERE t.competition_id = m.competition_id AND t.season = m.season
               AND t.club_id = 'aalesunds-fk'),
           s.expected_matches
         ) THEN 'complete'
    ELSE 'partial'
  END                                                       AS coverage,

  -- Hva merket over hviler på. Uten dette er «komplett» en påstand uten grunnlag,
  -- og en leser har ingen måte å vurdere hvor mye den er verdt.
  CASE
    WHEN c.type <> 'league' THEN 'not_applicable'
    WHEN (SELECT count(*) FROM core_matches u
           WHERE u.season = m.season AND u.competition_id = m.competition_id
             AND u.status = 'scheduled') > 0 THEN 'season_in_progress'
    WHEN count(m."round") = 0 THEN 'isolated_matches_only'
    WHEN (SELECT count(*) FROM core_standings t
           WHERE t.competition_id = m.competition_id AND t.season = m.season
             AND t.club_id = 'aalesunds-fk') > 0 THEN 'rounds_and_standings'
    WHEN s.expected_matches IS NOT NULL THEN 'rounds_and_declared_count'
    ELSE 'rounds_only'
  END                                                       AS coverage_evidence,

  -- Høyeste runde vi har. For en komplett sesong er dette antall serierunder.
  max(m."round")                                  AS last_round,

  -- Kamper igjen på terminlista. Egen spørring fordi raden over bare ser spilte
  -- kamper, og uten dette står inneværende sesong som «delvis» hele året — som
  -- om noe manglet, ikke som om den pågår.
  (SELECT count(*)
     FROM core_matches u
    WHERE u.season = m.season
      AND u.competition_id = m.competition_id
      AND u.status = 'scheduled')                           AS scheduled,

  '/sesong/' || m.season                                    AS url
FROM core_played m
JOIN core_competitions c ON c.id = m.competition_id
LEFT JOIN core_seasons s
  ON s.year = m.season
 AND s.competition_id = m.competition_id
-- Kvalifiseringskamper hører til sesongen, men ikke til serietabellen. Tas de
-- med her, blir en komplett sesong «delvis» fordi kampantallet overstiger
-- siste runde.
WHERE (c.type <> 'league' OR m.stage = 'regular_season')
GROUP BY m.season, m.competition_id;

-- Innbyrdes statistikk mot hver motstander, hele arkivet og alle konkurranser.
--
-- Kampantallet og seierstatistikken kommer fra det samme radsettet, `core_played`.
-- Tidligere telte `played` bare status 'played' mens seirene telte enhver rad med
-- et resultat, så en kamp avgjort på grønt bord kunne gi en seier uten en kamp.
-- `first_meeting` ser med vilje alle kamper: en motstander vi har på terminlista
-- uten å ha møtt ennå hører hjemme i lista med null spilte kamper.
CREATE VIEW opponents AS
SELECT
  c.id                                              AS opponent_club_id,
  c.name                                            AS opponent,
  c.city,
  coalesce(p.played, 0)                             AS played,
  coalesce(p.wins, 0)                               AS wins,
  coalesce(p.draws, 0)                              AS draws,
  coalesce(p.losses, 0)                             AS losses,
  coalesce(p.goals_for, 0)                          AS goals_for,
  coalesce(p.goals_against, 0)                      AS goals_against,
  min(m.match_date)                                 AS first_meeting,
  p.last_meeting                                    AS last_meeting,
  '/motstander/' || c.id                            AS url
FROM core_matches m
JOIN core_clubs c ON c.id = m.opponent_club_id
LEFT JOIN (
  SELECT
    opponent_club_id,
    count(*)                                        AS played,
    sum(CASE WHEN result = 'S' THEN 1 ELSE 0 END)   AS wins,
    sum(CASE WHEN result = 'U' THEN 1 ELSE 0 END)   AS draws,
    sum(CASE WHEN result = 'T' THEN 1 ELSE 0 END)   AS losses,
    coalesce(sum(aafk_score), 0)                    AS goals_for,
    coalesce(sum(opponent_score), 0)                AS goals_against,
    max(match_date)                                 AS last_meeting
  FROM core_played
  GROUP BY opponent_club_id
) p ON p.opponent_club_id = c.id
GROUP BY c.id;

-- Sluttabellen, ett lag per rad. Lagnavnet er kildens eget; club_id er satt for
-- de lagene arkivet kjenner fra før, og NULL for resten.
CREATE VIEW standings AS
SELECT
  t.competition_id,
  cm.name                                           AS competition,
  t.season,
  t.position,
  t.team,
  t.club_id,
  t.played, t.wins, t.draws, t.losses,
  t.goals_for, t.goals_against,
  t.goals_for - t.goals_against                     AS goal_difference,
  t.points,
  t.outcome,
  t.note,
  CASE WHEN t.club_id IS NULL THEN NULL
       ELSE '/motstander/' || t.club_id END          AS url
FROM core_standings t
JOIN core_competitions cm ON cm.id = t.competition_id;

-- AaFKs plassering etter hver runde. Utregnet ved innhøsting, ikke lagret som
-- kamper — se packages/schema/src/standings.ts for hvorfor.
CREATE VIEW standings_progression AS
SELECT
  p.competition_id,
  p.season,
  p.round,
  p.position,
  p.points,
  p.played,
  p.goal_difference
FROM core_standings_progression p;

-- Stallen per sesong: hvem som var med, og hvor mye.
--
-- Bygget på oppstillingene, som finnes fra 2010. Eldre sesonger har ingen rader
-- her, og det er en manglende kilde, ikke en tom stall.
CREATE VIEW squad AS
SELECT
  a.season,
  a.person_key,
  -- Navnet slik det vises. Samme person kan stå med to skrivemåter i kildene, og
  -- min() gir et stabilt svar; byggesteget har allerede valgt den beste.
  min(a.name)                                       AS name,
  -- Registeret når personen står der. Draktnummer er per sesong; posisjon og
  -- nasjonalitet gjelder personen.
  (SELECT n.person_id FROM core_person_names n WHERE n.person_key = a.person_key) AS person_id,
  (SELECT p.position FROM core_person_names n JOIN core_people p ON p.id = n.person_id
    WHERE n.person_key = a.person_key)              AS position,
  (SELECT p.nationality FROM core_person_names n JOIN core_people p ON p.id = n.person_id
    WHERE n.person_key = a.person_key)              AS nationality,
  (SELECT p.wikidata FROM core_person_names n JOIN core_people p ON p.id = n.person_id
    WHERE n.person_key = a.person_key)              AS wikidata,
  (SELECT s.number FROM core_person_names n JOIN core_squad_numbers s ON s.person_id = n.person_id
    WHERE n.person_key = a.person_key AND s.season = a.season) AS number,
  count(*)                                          AS appearances,
  sum(CASE WHEN a.role = 'start' THEN 1 ELSE 0 END) AS starts,
  min(m.match_date)                                 AS first_match,
  max(m.match_date)                                 AS last_match,
  -- Mål i sesongen, talt fra hendelsene. Bare AaFKs egne mål.
  (SELECT count(*) FROM core_played gm, json_each(gm.events) e
    WHERE gm.season = a.season
      AND json_extract(e.value, '$.player') = a.name
      AND json_extract(e.value, '$.type') IN ('goal','penalty_goal')
      AND (json_extract(e.value, '$.team') = 'home') = (gm.is_home = 1))
                                                    AS goals
FROM core_appearances a
JOIN core_played m ON m.id = a.match_id
GROUP BY a.season, a.person_key;

-- Trenerperioder: én rad per sammenhengende periode en trener hadde laget.
--
-- Utledet av kampene, ikke av ansettelsesdatoer vi ikke har. En periode brytes
-- når en annen trener står oppført på neste kamp, så et trenerbytte midt i
-- sesongen gir to rader det året. 2023 gir tre.
CREATE VIEW coach_spells AS
WITH ordered AS (
  SELECT
    c.person_key, c.name, c.season, c.match_date,
    row_number() OVER (ORDER BY c.match_date) AS seq,
    row_number() OVER (PARTITION BY c.person_key ORDER BY c.match_date) AS own_seq
  FROM core_coach_matches c
  JOIN core_played m ON m.id = c.match_id
)
SELECT
  person_key,
  min(name)                AS name,
  min(match_date)          AS from_date,
  max(match_date)          AS to_date,
  min(season)              AS from_season,
  max(season)              AS to_season,
  count(*)                 AS matches
FROM ordered
-- Differansen mellom løpenummeret i hele rekka og løpenummeret innenfor
-- treneren er konstant så lenge treneren er den samme. Skifter den, er det en
-- ny periode. Det er den klassiske gaps-and-islands-løsningen, og den er her
-- fordi en trener kan komme tilbake: Rekdal hadde laget både 2010 og 2024.
GROUP BY person_key, seq - own_seq
ORDER BY from_date;

-- Trenerperioder oppgitt av en kilde, for årene kampdataene ikke rekker.
-- Holdes atskilt fra coach_spells med vilje: der er periodene utledet av hvem som
-- sto oppført på hver kamp, og de har eksakte datoer og har med vikarene. Disse
-- har bare årstall, men rekker til 2001.
CREATE VIEW declared_coach_spells AS
SELECT
  d.person_id,
  p.name,
  d.from_season,
  d.to_season
FROM core_declared_coach_spells d
JOIN core_people p ON p.id = d.person_id
ORDER BY d.from_season;

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

-- Én rad per verdi i en uenighet mellom kilder.
--
-- Den offentlige modellen hadde bare `has_conflicts`, et null eller ett. Det er
-- nok til å si «kildene er uenige» og ingenting mer, så både leseren og
-- spørrefunksjonen måtte enten tie eller dikte. Her står hva uenigheten gjelder,
-- hvilke verdier som finnes, hvor de kommer fra, og hva arkivet bruker.
--
-- Formen er én rad per verdi framfor én rad per konflikt, fordi det er den
-- formen en spørring kan filtrere og sammenligne på. To kilder som er uenige om
-- ett felt gir to rader med samme field og ulik value.
CREATE VIEW match_conflicts AS
SELECT
  m.id                                              AS match_id,
  m.match_date                                      AS date,
  m.season,
  m.opponent_name                                   AS opponent,
  json_extract(c.value, '$.field')                  AS field,
  json_extract(v.value, '$.sourceId')               AS source_id,
  json_extract(v.value, '$.value')                  AS value,
  json_extract(v.value, '$.note')                   AS value_note,
  -- Verdien arkivet faktisk bruker. Null i alle kolonnene under betyr at ingen
  -- har tatt stilling, og det er en ærlig tilstand, ikke et hull.
  CASE WHEN json_extract(c.value, '$.chosen') IS NOT NULL
        AND json_extract(c.value, '$.chosen') = json_extract(v.value, '$.value')
       THEN 1 ELSE 0 END                            AS is_chosen,
  coalesce(json_extract(c.value, '$.decision'), 'unresolved') AS decision,
  json_extract(c.value, '$.decidedAt')              AS decided_at,
  json_extract(c.value, '$.reason')                 AS reason,
  CASE WHEN json_extract(c.value, '$.locked') THEN 1 ELSE 0 END AS locked,
  json_extract(c.value, '$.note')                   AS conflict_note,
  '/kamp/' || m.id                                  AS url
FROM core_matches m,
     json_each(m.conflicts) c,
     json_each(json_extract(c.value, '$.values')) v;

-- Kildekatalogen, så svar kan forklare hvor dataene kommer fra.
CREATE VIEW sources AS
SELECT
  id AS source_id, name, url, priority, license,
  automated_access, public_redistribution, attribution_required,
  permission_status, ingest_decision, permission_requested_at,
  risk_accepted_at, risk_accepted_by,
  terms_checked_at, robots_checked_at, permission_note,
  note
FROM core_sources;

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
