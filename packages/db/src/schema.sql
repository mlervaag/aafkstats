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
  identity_key TEXT,
  name_variants TEXT NOT NULL DEFAULT '[]', -- JSON
  country     TEXT NOT NULL DEFAULT 'NO',
  city        TEXT,
  founded     INTEGER,
  founded_date TEXT,
  names       TEXT NOT NULL DEFAULT '[]',   -- JSON
  aliases     TEXT NOT NULL DEFAULT '{}',   -- JSON
  sources     TEXT NOT NULL DEFAULT '[]',   -- JSON
  note        TEXT
);

CREATE TABLE core_venues (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  city      TEXT,
  country   TEXT NOT NULL DEFAULT 'NO',
  capacity  INTEGER,
  opened    INTEGER,
  opened_date TEXT,
  closed    INTEGER,
  closed_date TEXT,
  surface   TEXT CHECK (surface IN ('gravel','grass','artificial_turf')),
  names     TEXT NOT NULL DEFAULT '[]',
  surface_history TEXT NOT NULL DEFAULT '[]',
  home_periods TEXT NOT NULL DEFAULT '[]',
  attendance_records TEXT NOT NULL DEFAULT '[]',
  events    TEXT NOT NULL DEFAULT '[]',
  sources   TEXT NOT NULL DEFAULT '[]',
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

CREATE TABLE core_providers (
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
  sources          TEXT NOT NULL DEFAULT '[]',
  note             TEXT
);

-- Korte, redaksjonelt kontrollerte historiske fakta. Relasjonene er normalisert
-- fordi samme hendelse skal kunne vises på flere sider uten å kopieres.
CREATE TABLE core_historical_observations (
  id       TEXT PRIMARY KEY,
  title    TEXT NOT NULL,
  text     TEXT NOT NULL,
  date     TEXT,
  note     TEXT,
  sources  TEXT NOT NULL
);

CREATE TABLE observation_people (
  observation_id TEXT NOT NULL REFERENCES core_historical_observations(id),
  person_id TEXT NOT NULL REFERENCES core_people(id),
  PRIMARY KEY (observation_id, person_id)
);
CREATE TABLE observation_seasons (
  observation_id TEXT NOT NULL REFERENCES core_historical_observations(id),
  season INTEGER NOT NULL,
  PRIMARY KEY (observation_id, season)
);
CREATE TABLE observation_matches (
  observation_id TEXT NOT NULL REFERENCES core_historical_observations(id),
  match_id TEXT NOT NULL REFERENCES core_matches(id),
  PRIMARY KEY (observation_id, match_id)
);
CREATE TABLE observation_competitions (
  observation_id TEXT NOT NULL REFERENCES core_historical_observations(id),
  competition_id TEXT NOT NULL REFERENCES core_competitions(id),
  PRIMARY KEY (observation_id, competition_id)
);
CREATE TABLE observation_venues (
  observation_id TEXT NOT NULL REFERENCES core_historical_observations(id),
  venue_id TEXT NOT NULL REFERENCES core_venues(id),
  PRIMARY KEY (observation_id, venue_id)
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
  sources          TEXT NOT NULL DEFAULT '[]',
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
  sources      TEXT NOT NULL DEFAULT '[]',
  -- Kilder som er uenige om et verv. At de er uenige er en opplysning i seg
  -- selv, og den skal kunne vises — ikke bare ligge i YAML-en.
  conflicts    TEXT NOT NULL DEFAULT '[]',
  note         TEXT
);

-- Juridiske og organisatoriske enheter må være eksplisitte. «AaFK» og
-- «Ålesund Fotball AS» kan ha parallelle lederroller uten å være samme organ.
CREATE TABLE core_organizations (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  organization_number  TEXT,
  kind                 TEXT NOT NULL CHECK (kind IN ('club','company','stadium')),
  note                 TEXT
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
  -- Dagen perioden begynte og sluttet, der kilden oppgir den. De fleste eldre
  -- periodene har bare årstall, og da står disse tomme.
  from_date    TEXT,
  to_date      TEXT,
  PRIMARY KEY (person_id, from_season)
);

-- Kildeførte roller utenfor den kampavledede spiller- og trenerstatistikken.
-- Samme person kan være spiller, formann og æresmedlem i ulike perioder.
CREATE TABLE core_person_roles (
  person_id    TEXT NOT NULL REFERENCES core_people(id),
  role_id      TEXT NOT NULL,
  category     TEXT NOT NULL CHECK (category IN
                 ('player','coach','sporting_staff','board','administration','honorary','founder','project')),
  title        TEXT NOT NULL,
  organization_id TEXT REFERENCES core_organizations(id),
  body         TEXT,
  from_date    TEXT NOT NULL,
  to_date      TEXT,
  sources      TEXT NOT NULL,
  note         TEXT,
  PRIMARY KEY (person_id, role_id)
);

CREATE INDEX idx_person_roles_category_dates
ON core_person_roles(category, from_date, to_date);

CREATE INDEX idx_person_roles_body_dates
ON core_person_roles(body, from_date, to_date);

-- Et snapshot sier hvem som er observert i en rolle på én dato. Det må holdes
-- atskilt fra rolleperioder, fordi observasjonsdatoen ikke er en startdato.
CREATE TABLE core_organization_snapshot_people (
  snapshot_date  TEXT NOT NULL,
  organization_id TEXT NOT NULL REFERENCES core_organizations(id),
  person_id      TEXT NOT NULL REFERENCES core_people(id),
  observed_title TEXT NOT NULL,
  category       TEXT NOT NULL CHECK (category IN
                   ('player','coach','sporting_staff','board','administration','honorary','founder','project')),
  body           TEXT,
  sources        TEXT NOT NULL,
  note           TEXT,
  PRIMARY KEY (snapshot_date, organization_id, person_id, observed_title)
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
  providers        TEXT NOT NULL DEFAULT '[]',
  confidence       TEXT NOT NULL DEFAULT 'probable'
                     CHECK (confidence IN ('confirmed','probable','disputed')),
  conflicts        TEXT NOT NULL DEFAULT '[]',
  tags             TEXT NOT NULL DEFAULT '[]',
  aliases          TEXT NOT NULL DEFAULT '{}',
  completeness     REAL NOT NULL DEFAULT 0,
  missing_fields   TEXT NOT NULL DEFAULT '[]',
  sources          TEXT NOT NULL DEFAULT '[]',
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

-- Stadionfakta er egne historiske påstander. Hjemmebaneperioder og rekorder
-- beholdes som JSON fordi én bane kan ha flere perioder og flere kildeførte rekorder.
CREATE VIEW venues AS
SELECT
  id,
  name,
  city,
  country,
  capacity,
  opened,
  opened_date,
  closed,
  closed_date,
  surface,
  names,
  surface_history,
  home_periods,
  attendance_records,
  events,
  sources,
  note
FROM core_venues;

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
  CASE WHEN
    json_extract(m.stats, '$.home.possession') IS NOT NULL OR json_extract(m.stats, '$.away.possession') IS NOT NULL OR
    json_extract(m.stats, '$.home.shots') IS NOT NULL OR json_extract(m.stats, '$.away.shots') IS NOT NULL OR
    json_extract(m.stats, '$.home.shotsOnTarget') IS NOT NULL OR json_extract(m.stats, '$.away.shotsOnTarget') IS NOT NULL OR
    json_extract(m.stats, '$.home.corners') IS NOT NULL OR json_extract(m.stats, '$.away.corners') IS NOT NULL OR
    json_extract(m.stats, '$.home.fouls') IS NOT NULL OR json_extract(m.stats, '$.away.fouls') IS NOT NULL OR
    json_extract(m.stats, '$.home.offsides') IS NOT NULL OR json_extract(m.stats, '$.away.offsides') IS NOT NULL OR
    json_extract(m.stats, '$.home.xg') IS NOT NULL OR json_extract(m.stats, '$.away.xg') IS NOT NULL
  THEN 1 ELSE 0 END AS has_stats,
  json_extract(m.stats, CASE WHEN m.is_home = 1 THEN '$.home.possession' ELSE '$.away.possession' END) AS aafk_possession,
  json_extract(m.stats, CASE WHEN m.is_home = 1 THEN '$.away.possession' ELSE '$.home.possession' END) AS opponent_possession,
  json_extract(m.stats, CASE WHEN m.is_home = 1 THEN '$.home.shots' ELSE '$.away.shots' END) AS aafk_shots,
  json_extract(m.stats, CASE WHEN m.is_home = 1 THEN '$.away.shots' ELSE '$.home.shots' END) AS opponent_shots,
  json_extract(m.stats, CASE WHEN m.is_home = 1 THEN '$.home.shotsOnTarget' ELSE '$.away.shotsOnTarget' END) AS aafk_shots_on_target,
  json_extract(m.stats, CASE WHEN m.is_home = 1 THEN '$.away.shotsOnTarget' ELSE '$.home.shotsOnTarget' END) AS opponent_shots_on_target,
  json_extract(m.stats, CASE WHEN m.is_home = 1 THEN '$.home.corners' ELSE '$.away.corners' END) AS aafk_corners,
  json_extract(m.stats, CASE WHEN m.is_home = 1 THEN '$.away.corners' ELSE '$.home.corners' END) AS opponent_corners,
  json_extract(m.stats, CASE WHEN m.is_home = 1 THEN '$.home.fouls' ELSE '$.away.fouls' END) AS aafk_fouls,
  json_extract(m.stats, CASE WHEN m.is_home = 1 THEN '$.away.fouls' ELSE '$.home.fouls' END) AS opponent_fouls,
  json_extract(m.stats, CASE WHEN m.is_home = 1 THEN '$.home.offsides' ELSE '$.away.offsides' END) AS aafk_offsides,
  json_extract(m.stats, CASE WHEN m.is_home = 1 THEN '$.away.offsides' ELSE '$.home.offsides' END) AS opponent_offsides,
  json_extract(m.stats, CASE WHEN m.is_home = 1 THEN '$.home.xg' ELSE '$.away.xg' END) AS aafk_xg,
  json_extract(m.stats, CASE WHEN m.is_home = 1 THEN '$.away.xg' ELSE '$.home.xg' END) AS opponent_xg,
  m.report_summary,
  m.confidence,
  CASE WHEN json_array_length(m.conflicts) > 0 THEN 1 ELSE 0 END AS has_conflicts,
  m.completeness,
  -- Hvilke felt som mangler, med samme navn som completeness regner på. Lå bare i
  -- basetabellen, så «hva mangler vi?» kunne ikke besvares uten å regne det ut på
  -- nytt utenfor databasen — og da med en annen definisjon enn completeness sin.
  m.missing_fields,
  -- Siste gang en kilde ble hentet for denne kampen. Brukes til lastModified i
  -- sitemap, så søkemotorer får vite når opplysningen sist ble kontrollert i
  -- stedet for å anta at hele arkivet er like gammelt som byggetidspunktet.
  (SELECT max(json_extract(pv.value, '$.retrievedAt')) FROM json_each(m.providers) pv)
                      AS last_retrieved_at,
  m.sources,
  m.note,
  m.tags,
  '/kamp/' || m.id    AS url
FROM core_matches m
JOIN core_competitions c ON c.id = m.competition_id;

-- To rader per kamp med statistikk: én for AaFK og én for motstanderen. Dette
-- formatet passer best til summering og sammenligning mellom lag/sider.
CREATE VIEW match_stats AS
SELECT
  match_id, date, season, competition, competition_type, is_home,
  'aafk' AS side, 'Aalesunds FK' AS team, opponent,
  aafk_possession AS possession, aafk_shots AS shots,
  aafk_shots_on_target AS shots_on_target, aafk_corners AS corners,
  aafk_fouls AS fouls, aafk_offsides AS offsides, aafk_xg AS xg, url
FROM matches WHERE has_stats = 1
UNION ALL
SELECT
  match_id, date, season, competition, competition_type, is_home,
  'opponent' AS side, opponent AS team, 'Aalesunds FK' AS opponent,
  opponent_possession, opponent_shots, opponent_shots_on_target,
  opponent_corners, opponent_fouls, opponent_offsides, opponent_xg, url
FROM matches WHERE has_stats = 1;

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
  coalesce(s.sources, '[]')                                 AS sources,
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
  -- «87 sesonger» betyr her 87 år med minst én registrert kamp. Det
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
  t.sources,
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
  d.to_season,
  d.from_date,
  d.to_date
FROM core_declared_coach_spells d
JOIN core_people p ON p.id = d.person_id
ORDER BY d.from_season;

-- Alle eksplisitt kildeførte roller. Spillerstatistikk fra kampoppstillinger
-- ligger fortsatt i squad; dette viewet handler om verv og tilknytninger kilder
-- faktisk navngir med periode.
CREATE VIEW person_roles AS
SELECT
  r.person_id,
  p.name,
  r.role_id,
  r.category,
  r.title,
  r.organization_id,
  o.name AS organization_name,
  r.body,
  r.from_date,
  r.to_date,
  r.sources,
  r.note,
  '/personer/' || p.id AS url
FROM core_person_roles r
JOIN core_people p ON p.id = r.person_id
LEFT JOIN core_organizations o ON o.id = r.organization_id
ORDER BY r.from_date, p.name;

CREATE VIEW organizations AS
SELECT id, name, organization_number, kind, note
FROM core_organizations
ORDER BY name;

CREATE VIEW organization_snapshots AS
SELECT
  s.snapshot_date,
  s.organization_id,
  o.name AS organization_name,
  s.person_id,
  p.name,
  s.observed_title,
  s.category,
  s.body,
  s.sources,
  s.note,
  '/personer/' || p.id AS url
FROM core_organization_snapshot_people s
JOIN core_organizations o ON o.id = s.organization_id
JOIN core_people p ON p.id = s.person_id
ORDER BY s.snapshot_date, o.name, p.name;

-- Én rad per verdi i en uenighet om en personrolle. Formen speiler
-- match_conflicts, slik at AI-søket kan forklare uenigheten uten å velge side.
CREATE VIEW person_conflicts AS
SELECT
  p.id                                               AS person_id,
  p.name,
  json_extract(c.value, '$.field')                   AS field,
  json_extract(v.value, '$.providerId')              AS provider_id,
  json_extract(v.value, '$.value')                   AS value,
  json_extract(v.value, '$.note')                    AS value_note,
  CASE WHEN json_type(c.value, '$.chosen') IS NOT NULL
        AND json_extract(c.value, '$.chosenProviderId') = json_extract(v.value, '$.providerId')
        AND (
          json_extract(c.value, '$.chosen') = json_extract(v.value, '$.value')
          OR (
            json_type(c.value, '$.chosen') = 'null'
            AND json_type(v.value, '$.value') = 'null'
          )
        )
       THEN 1 ELSE 0 END                             AS is_chosen,
  coalesce(json_extract(c.value, '$.decision'), 'unresolved') AS decision,
  json_extract(c.value, '$.decidedAt')               AS decided_at,
  json_extract(c.value, '$.reason')                  AS reason,
  CASE WHEN json_extract(c.value, '$.locked') THEN 1 ELSE 0 END AS locked,
  json_extract(c.value, '$.note')                    AS conflict_note,
  '/personer/' || p.id                               AS url
FROM core_people p,
     json_each(p.conflicts) c,
     json_each(json_extract(c.value, '$.values')) v;

-- Personregisteret som offentlig kontrakt. Det samler identitet, kampavledet
-- aktivitet og eksplisitte organisasjonsroller uten å gjøre personfila til en
-- biografi eller kopiere kildetekst.
CREATE VIEW people AS
SELECT
  p.id,
  p.name,
  p.nationality,
  p.position,
  p.wikidata,
  p.sources,
  p.conflicts,
  p.note,
  CASE WHEN json_array_length(p.conflicts) > 0 THEN 1 ELSE 0 END AS has_conflicts,
  (SELECT min(a.season) FROM core_appearances a
    WHERE a.person_key IN (SELECT n.person_key FROM core_person_names n WHERE n.person_id = p.id)) AS first_season,
  (SELECT max(a.season) FROM core_appearances a
    WHERE a.person_key IN (SELECT n.person_key FROM core_person_names n WHERE n.person_id = p.id)) AS last_season,
  (SELECT count(*) FROM core_appearances a
    WHERE a.person_key IN (SELECT n.person_key FROM core_person_names n WHERE n.person_id = p.id)) AS appearances,
  (SELECT count(*) FROM core_appearances a
    WHERE a.role = 'start'
      AND a.person_key IN (SELECT n.person_key FROM core_person_names n WHERE n.person_id = p.id)) AS starts,
  (SELECT count(*) FROM core_person_roles r WHERE r.person_id = p.id)
    + (SELECT count(*) FROM core_declared_coach_spells d WHERE d.person_id = p.id) AS role_count,
  (SELECT min(year) FROM (
     SELECT substr(r.from_date, 1, 4) AS year FROM core_person_roles r WHERE r.person_id = p.id
     UNION ALL
     SELECT printf('%04d', d.from_season) FROM core_declared_coach_spells d WHERE d.person_id = p.id
   )) AS first_role_year,
  (SELECT max(year) FROM (
     SELECT substr(coalesce(r.to_date, r.from_date), 1, 4) AS year FROM core_person_roles r WHERE r.person_id = p.id
     UNION ALL
     SELECT printf('%04d', coalesce(d.to_season, d.from_season)) FROM core_declared_coach_spells d WHERE d.person_id = p.id
   )) AS last_role_year,
  (SELECT json_group_array(category) FROM (
     SELECT DISTINCT r.category FROM core_person_roles r WHERE r.person_id = p.id
     UNION
     SELECT 'coach' WHERE EXISTS (SELECT 1 FROM core_declared_coach_spells d WHERE d.person_id = p.id)
   )) AS role_categories,
  '/personer/' || p.id AS url
FROM core_people p
ORDER BY p.name;

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
  json_extract(v.value, '$.providerId')             AS provider_id,
  json_extract(v.value, '$.value')                  AS value,
  json_extract(v.value, '$.note')                   AS value_note,
  -- Verdien arkivet faktisk bruker. Null i alle kolonnene under betyr at ingen
  -- har tatt stilling, og det er en ærlig tilstand, ikke et hull.
  CASE WHEN json_type(c.value, '$.chosen') IS NOT NULL
        AND json_extract(c.value, '$.chosenProviderId') = json_extract(v.value, '$.providerId')
        AND (
          json_extract(c.value, '$.chosen') = json_extract(v.value, '$.value')
          OR (
            json_type(c.value, '$.chosen') = 'null'
            AND json_type(v.value, '$.value') = 'null'
          )
        )
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
CREATE VIEW providers AS
SELECT
  id AS provider_id, name, url, priority, license,
  automated_access, public_redistribution, attribution_required,
  permission_status, ingest_decision, permission_requested_at,
  risk_accepted_at, risk_accepted_by,
  terms_checked_at, robots_checked_at, permission_note,
  note
FROM core_providers;

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

-- Bidrag/observasjoner innsendt av brukere via innboksen
CREATE TABLE core_contributions (
  id           TEXT PRIMARY KEY,
  scope        TEXT NOT NULL CHECK (scope IN ('match', 'season', 'person')),
  target_id    TEXT NOT NULL,
  category     TEXT NOT NULL CHECK (category IN ('memory', 'context', 'trivia', 'event_detail')),
  text         TEXT NOT NULL,
  contributor  TEXT,
  submitted_at TEXT NOT NULL,
  verification TEXT NOT NULL CHECK (verification IN ('unverified', 'corroborated', 'verified')),
  source_url   TEXT
);

CREATE TABLE core_sources (
  id            TEXT PRIMARY KEY,
  parent_source_id TEXT REFERENCES core_sources(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  source_type   TEXT NOT NULL CHECK (source_type IN ('book','anniversary_book','member_magazine','annual_report','match_program','supporter_publication','local_history_book','newspaper_supplement','series','other')),
  issue         TEXT,
  volume        TEXT,
  publisher     TEXT,
  year          INTEGER,
  -- Bibliografien. Valgfri, fordi katalogpostene sjelden har alt.
  urn           TEXT,
  author        TEXT,
  description   TEXT,
  cover_url     TEXT,
  access_url    TEXT,
  providers     TEXT NOT NULL DEFAULT '[]'
);

-- Redaksjonelt kvalifiserte, atomiske JA/NEI-saker. Community-svar ligger i
-- GitHub-innboksen; denne tabellen er den publiserte og versjonerte oppgaven.
CREATE TABLE core_verification_cases (
  id                TEXT PRIMARY KEY,
  status            TEXT NOT NULL CHECK (status IN ('draft','open','paused','resolved','rejected','superseded')),
  category          TEXT NOT NULL CHECK (category IN ('role','identity','match','source_reading','club')),
  claim             TEXT NOT NULL,
  question          TEXT NOT NULL,
  context           TEXT NOT NULL,
  why_it_matters    TEXT NOT NULL,
  yes_meaning       TEXT NOT NULL,
  no_meaning        TEXT NOT NULL,
  inconclusive_meaning TEXT,
  instructions      TEXT NOT NULL DEFAULT '[]',
  target_type       TEXT NOT NULL CHECK (target_type IN ('person','match','season','club','source')),
  target_id         TEXT NOT NULL,
  target_field      TEXT NOT NULL,
  sources           TEXT NOT NULL DEFAULT '[]',
  search_hint       TEXT,
  newspaper         TEXT,
  research_task     TEXT,
  estimated_minutes INTEGER NOT NULL CHECK (estimated_minutes BETWEEN 1 AND 60),
  priority          INTEGER NOT NULL CHECK (priority BETWEEN 0 AND 100),
  revision          TEXT NOT NULL,
  published_at      TEXT,
  resolution        TEXT,
  source_file       TEXT NOT NULL
);

CREATE INDEX idx_verification_cases_queue
ON core_verification_cases(status, priority DESC, published_at, id);

CREATE TABLE core_publication_extractions (
  source_id       TEXT PRIMARY KEY REFERENCES core_sources(id) ON DELETE CASCADE,
  provider_id     TEXT NOT NULL REFERENCES core_providers(id),
  adapter         TEXT NOT NULL,
  retrieved_at    TEXT NOT NULL,
  ocr_access      TEXT NOT NULL CHECK (ocr_access IN ('alto','search_only','unavailable')),
  pages_expected  INTEGER NOT NULL,
  pages_processed INTEGER NOT NULL,
  pages_failed    TEXT NOT NULL DEFAULT '[]',
  content_hash    TEXT
);

-- Resultater en historisk kilde dokumenterer uten nok opplysninger til å bli
-- kanoniske kamper. De holdes utenfor all kamp- og sesongstatistikk.
CREATE TABLE core_source_results (
  claim_id        TEXT NOT NULL UNIQUE,
  source_id       TEXT NOT NULL REFERENCES core_sources(id) ON DELETE CASCADE,
  id              TEXT NOT NULL,
  season          INTEGER NOT NULL,
  source_order    INTEGER NOT NULL,
  page            INTEGER NOT NULL,
  date            TEXT,
  opponent        TEXT,
  opponent_club_id TEXT REFERENCES core_clubs(id),
  aafk_score      INTEGER,
  opponent_score  INTEGER,
  competition_id  TEXT REFERENCES core_competitions(id),
  status          TEXT NOT NULL CHECK (status IN ('played','walkover')),
  replay          INTEGER NOT NULL CHECK (replay IN (0,1)),
  after_extra_time INTEGER NOT NULL CHECK (after_extra_time IN (0,1)),
  round           INTEGER,
  result_group_id TEXT,
  match_id        TEXT REFERENCES core_matches(id),
  note            TEXT,
  PRIMARY KEY (source_id, id)
);

CREATE INDEX source_results_claim_id_idx ON core_source_results(claim_id);
CREATE INDEX source_results_season_idx ON core_source_results(season, source_order);
CREATE INDEX source_results_result_group_idx ON core_source_results(result_group_id);
CREATE INDEX source_results_match_idx ON core_source_results(match_id);

CREATE TABLE core_fact_candidates (
  source_id  TEXT NOT NULL REFERENCES core_publication_extractions(source_id) ON DELETE CASCADE,
  id         TEXT NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('person_mention','person_role','match_result','lineup_or_squad','organization','season_fact','fixture_list')),
  page       TEXT NOT NULL,
  confidence TEXT NOT NULL CHECK (confidence IN ('high','medium','low')),
  keywords   TEXT NOT NULL DEFAULT '[]',
  names      TEXT NOT NULL DEFAULT '[]',
  years      TEXT NOT NULL DEFAULT '[]',
  scores     TEXT NOT NULL DEFAULT '[]',
  person_ids TEXT NOT NULL DEFAULT '[]',
  match_ids  TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (source_id, id)
);

CREATE INDEX idx_fact_candidates_kind_confidence ON core_fact_candidates(kind, confidence);

-- Andre gjennomgang av kandidatene. Disse radene er mer presise enn
-- core_fact_candidates, men fortsatt maskinelt løste funn og ikke kanoniske
-- personroller eller kampoppstillinger.
CREATE TABLE core_resolved_roles (
  source_id   TEXT NOT NULL REFERENCES core_publication_extractions(source_id) ON DELETE CASCADE,
  id          TEXT NOT NULL,
  page        TEXT NOT NULL,
  column_no   INTEGER,
  person_name TEXT NOT NULL,
  person_id   TEXT,
  category    TEXT NOT NULL CHECK (category IN
                ('player','coach','sporting_staff','board','administration','honorary','founder','project')),
  title       TEXT NOT NULL,
  body        TEXT,
  from_date   TEXT,
  to_date     TEXT,
  confidence  TEXT NOT NULL CHECK (confidence IN ('high','medium','low')),
  rule        TEXT NOT NULL CHECK (rule IN ('role_then_name','name_then_role','year_row','name_then_year')),
  PRIMARY KEY (source_id, id)
);

CREATE INDEX idx_resolved_roles_person_dates
ON core_resolved_roles(person_id, from_date, to_date);

CREATE INDEX idx_resolved_roles_title_confidence
ON core_resolved_roles(title, confidence);

CREATE TABLE core_resolved_lineups (
  source_id  TEXT NOT NULL REFERENCES core_publication_extractions(source_id) ON DELETE CASCADE,
  id         TEXT NOT NULL,
  page       TEXT NOT NULL,
  column_no  INTEGER,
  season     INTEGER,
  names      TEXT NOT NULL,
  person_ids TEXT NOT NULL DEFAULT '[]',
  confidence TEXT NOT NULL CHECK (confidence IN ('high','medium','low')),
  PRIMARY KEY (source_id, id)
);

CREATE INDEX idx_resolved_lineups_season_confidence
ON core_resolved_lineups(season, confidence);

CREATE VIEW contributions AS
SELECT
  id,
  scope,
  target_id,
  category,
  text,
  contributor,
  submitted_at,
  verification,
  source_url
FROM core_contributions
ORDER BY submitted_at DESC;

CREATE VIEW sources AS
SELECT
  id,
  parent_source_id,
  title,
  source_type,
  issue,
  volume,
  publisher,
  year,
  urn,
  author,
  description,
  cover_url,
  access_url,
  '/kilder/' || id AS url
FROM core_sources
ORDER BY coalesce(year, 0) DESC, title ASC;

CREATE VIEW historical_observations AS
SELECT o.id, o.title, o.text, o.date, o.note, o.sources,
       coalesce((SELECT json_group_array(person_id) FROM observation_people WHERE observation_id = o.id), '[]') AS person_ids,
       coalesce((SELECT json_group_array(season) FROM observation_seasons WHERE observation_id = o.id), '[]') AS season_years,
       coalesce((SELECT json_group_array(match_id) FROM observation_matches WHERE observation_id = o.id), '[]') AS match_ids,
       coalesce((SELECT json_group_array(competition_id) FROM observation_competitions WHERE observation_id = o.id), '[]') AS competition_ids,
       coalesce((SELECT json_group_array(venue_id) FROM observation_venues WHERE observation_id = o.id), '[]') AS venue_ids,
       -- Kjeden dekker alle relasjonene som har en side å vise på, og skjemaet
       -- krever minst én av dem. Sto bare person og sesong her, ville en
       -- observasjon knyttet til en kamp eller en bane fått url = NULL og blitt
       -- filtrert stille bort av søket.
       coalesce(
         (SELECT '/personer/' || person_id || '#observasjon-' || o.id FROM observation_people WHERE observation_id = o.id ORDER BY person_id LIMIT 1),
         (SELECT '/sesong/' || season || '#observasjon-' || o.id FROM observation_seasons WHERE observation_id = o.id ORDER BY season LIMIT 1),
         (SELECT '/kamp/' || match_id || '#observasjon-' || o.id FROM observation_matches WHERE observation_id = o.id ORDER BY match_id LIMIT 1),
         (SELECT '/hjemmebaner#observasjon-' || o.id FROM observation_venues WHERE observation_id = o.id ORDER BY venue_id LIMIT 1)
       ) AS url
FROM core_historical_observations o
ORDER BY coalesce(o.date, '') DESC, o.id;

CREATE VIEW verification_cases AS
SELECT id, status, category, claim, question, context, why_it_matters,
       yes_meaning, no_meaning, inconclusive_meaning, instructions, target_type, target_id,
       target_field, sources, search_hint, newspaper, research_task, estimated_minutes, priority,
       revision, published_at, resolution, source_file,
       '/mangler/' || id AS url
FROM core_verification_cases
ORDER BY CASE status WHEN 'open' THEN 0 ELSE 1 END,
         priority DESC, published_at, id;

CREATE VIEW publication_extractions AS
SELECT source_id, provider_id, adapter, retrieved_at, ocr_access,
       pages_expected, pages_processed, pages_failed, content_hash
FROM core_publication_extractions
ORDER BY source_id;

CREATE VIEW source_results AS
SELECT r.claim_id, r.source_id, s.title AS source_title, r.id, r.season, r.source_order, r.page,
       r.date,
       r.opponent, r.opponent_club_id, r.aafk_score, r.opponent_score,
       CASE
         WHEN r.status = 'walkover' THEN NULL
         WHEN r.aafk_score > r.opponent_score THEN 'S'
         WHEN r.aafk_score = r.opponent_score THEN 'U'
         ELSE 'T'
       END AS result,
       r.competition_id, r.status, r.replay, r.after_extra_time, r.round,
       r.result_group_id, r.match_id, r.note, s.access_url AS source_url, '/kilder/' || s.id AS url
FROM core_source_results r
JOIN core_sources s ON s.id = r.source_id
ORDER BY r.season DESC, r.source_order;

CREATE VIEW fact_candidates AS
SELECT source_id, id, kind, page, confidence, keywords, names, years, scores,
       person_ids, match_ids
FROM core_fact_candidates
ORDER BY source_id, CAST(page AS INTEGER), kind, id;

CREATE VIEW resolved_roles AS
SELECT r.source_id, s.title AS source_title, r.id, r.page, r.column_no,
       r.person_name, r.person_id, r.category, r.title, r.body,
       r.from_date, r.to_date, r.confidence, r.rule,
       s.access_url AS source_url, '/kilder/' || s.id AS url
FROM core_resolved_roles r
JOIN core_sources s ON s.id = r.source_id
ORDER BY r.source_id, CAST(r.page AS INTEGER), r.person_name, r.id;

CREATE VIEW resolved_lineups AS
SELECT l.source_id, s.title AS source_title, l.id, l.page, l.column_no,
       l.season, l.names, l.person_ids, l.confidence,
       s.access_url AS source_url, '/kilder/' || s.id AS url
FROM core_resolved_lineups l
JOIN core_sources s ON s.id = l.source_id
ORDER BY l.source_id, CAST(l.page AS INTEGER), l.id;
