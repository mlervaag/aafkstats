import { open, all } from '@aafkstats/db';
const db = open();

const total = all(db, "SELECT count(*) as c FROM core_matches")[0].c;
const serie = all(db, "SELECT count(*) as c FROM core_matches m JOIN core_competitions c ON c.id = m.competition_id WHERE c.type = 'league'")[0].c;
const cup = all(db, "SELECT count(*) as c FROM core_matches m JOIN core_competitions c ON c.id = m.competition_id WHERE c.type = 'national_cup'")[0].c;
const tren = all(db, "SELECT count(*) as c FROM core_matches m JOIN core_competitions c ON c.id = m.competition_id WHERE c.type = 'friendly'")[0].c;
const events = all(db, "SELECT count(*) as c FROM core_matches WHERE json_array_length(events) > 0")[0].c;
const lineup = all(db, "SELECT count(*) as c FROM core_matches WHERE lineups IS NOT NULL")[0].c;
const attendance = all(db, "SELECT count(*) as c FROM core_matches WHERE attendance IS NOT NULL")[0].c;

console.log(`Total: ${total}, Serie: ${serie}, Cup: ${cup}, Tren: ${tren}`);
console.log(`Events: ${events}, Lineup: ${lineup}, Attendance: ${attendance}`);
