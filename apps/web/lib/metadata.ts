import { formatDate } from "@/lib/date";

/**
 * Titler og beskrivelser for de sidene som har noe eget å si.
 *
 * Alle kamp-, sesong- og motstandersider delte én tittel og én beskrivelse fra
 * rotoppsettet. Delte noen en kamp, fikk mottakeren «AaFK-arkivet» og en generell
 * prosjekttekst, uansett hvilken kamp det gjaldt. Det er også det en søkemotor
 * ser: tusen sider som ser identiske ut.
 *
 * Funksjonene her er rene, slik at de kan testes uten å rendre en side.
 */

export interface MatchMetaInput {
  homeName: string;
  awayName: string;
  homeScore: number | null;
  awayScore: number | null;
  date: string;
  status: string;
  competition: string;
  venue: string | null;
  attendance: number | null;
}

/** Om kampen har funnet sted. Samme regel som resten av arkivet. */
function isPlayed(status: string): boolean {
  return status === "played" || status === "awarded";
}

/**
 * «AaFK 2–1 Haugesund, 26. september 2010» eller «HamKam mot AaFK, 9. august 2026».
 *
 * En kamp som ikke er spilt får «mot», ikke et tomt resultat. Forskjellen er hele
 * poenget: en delt lenke skal ikke se ut som en kamp der noen har glemt tallet.
 */
export function matchTitle(m: MatchMetaInput): string {
  const when = formatDate(m.date);
  if (isPlayed(m.status) && m.homeScore !== null && m.awayScore !== null) {
    return `${m.homeName} ${m.homeScore}–${m.awayScore} ${m.awayName}, ${when}`;
  }
  return `${m.homeName} mot ${m.awayName}, ${when}`;
}

export function matchDescription(m: MatchMetaInput): string {
  const when = formatDate(m.date);
  const where = m.venue ? ` på ${m.venue}` : "";

  if (!isPlayed(m.status)) {
    if (m.status === "cancelled") return `${m.competition} ${when}. Kampen ble avlyst.`;
    if (m.status === "postponed") return `${m.competition} ${when}. Kampen er utsatt.`;
    return `${m.competition} ${when}${where}. Kampen er ikke spilt ennå.`;
  }

  if (m.homeScore === null || m.awayScore === null) {
    return `${m.competition} ${when}${where}. Arkivet har ikke resultatet.`;
  }

  const crowd = m.attendance ? ` ${m.attendance} tilskuere.` : "";
  return `${m.homeName} ${m.homeScore}–${m.awayScore} ${m.awayName} i ${m.competition} ${when}${where}.${crowd}`;
}

export interface SeasonMetaInput {
  year: number;
  /** Konkurransen som bærer året, som regel serien. */
  competition: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  finalPosition: number | null;
  scheduled: number;
}

export function seasonTitle(s: SeasonMetaInput): string {
  return `AaFK ${s.year}`;
}

export function seasonDescription(s: SeasonMetaInput): string {
  const record = `${s.wins} seire, ${s.draws} uavgjorte og ${s.losses} tap på ${s.played} kamper`;
  const place = s.finalPosition ? `, ${s.finalPosition}. plass` : "";
  const rest = s.scheduled > 0 ? ` ${s.scheduled} kamper står igjen på terminlista.` : "";
  return `${s.competition} ${s.year}: ${record}${place}.${rest}`;
}

export interface OpponentMetaInput {
  opponent: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  firstMeeting: string;
  lastMeeting: string | null;
}

export function opponentTitle(o: OpponentMetaInput): string {
  return `AaFK mot ${o.opponent}`;
}

export function opponentDescription(o: OpponentMetaInput): string {
  if (o.played === 0) {
    return `AaFK har ikke møtt ${o.opponent} ennå. Første kamp står på terminlista ${formatDate(o.firstMeeting)}.`;
  }
  const span = o.lastMeeting && o.lastMeeting !== o.firstMeeting
    ? ` fra ${o.firstMeeting.slice(0, 4)} til ${o.lastMeeting.slice(0, 4)}`
    : ` i ${o.firstMeeting.slice(0, 4)}`;
  return `${o.played} kamper mot ${o.opponent}${span}: ${o.wins} seire, ${o.draws} uavgjorte og ${o.losses} tap.`;
}

/**
 * Metadata-objektet Next forventer, med kanonisk adresse og delingskort.
 *
 * Bildet arves fra rotoppsettet. Et eget bilde per kamp ville krevd en
 * bildegenerator, og et generelt bilde med riktig tittel og beskrivelse er
 * allerede hele forskjellen for den som deler en lenke.
 */
export function pageMetadata(title: string, description: string, path: string) {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, type: "article" as const, locale: "nb_NO" },
    twitter: { card: "summary_large_image" as const, title, description },
  };
}
