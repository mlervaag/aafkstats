import type { Metadata } from "next";
import { pageMetadata } from "@/lib/metadata";
import { ArchiveTabs } from "@/components/ArchiveTabs";
import { SourceChips } from "@/components/SourceChips";
import { getSourceTitles } from "@/lib/people";
import { getHomeVenues } from "@/lib/venues";
import { HistoricalObservations } from "@/components/HistoricalObservations";
import { getVenueObservations } from "@/lib/historical-observations";
import { contributionIssueUrl, pageReference } from "@/lib/contribution-links";
import type { HomeVenue, VenueEvent } from "@/lib/venues";
import styles from "./HomeVenues.module.css";

export const metadata: Metadata = pageMetadata(
  "Hjemmebaner",
  "Banene Aalesunds Fotballklubb har spilt hjemmekampene sine på, med perioder, dekke, publikumsrekorder og milepæler.",
  "/hjemmebaner",
  "website",
);

const SURFACE_LABELS: Record<string, string> = {
  gravel: "Grus",
  grass: "Gress",
  artificial_turf: "Kunstgress",
};

const EVENT_LABELS: Record<string, string> = {
  construction_start: "Anleggsstart",
  opening: "Åpning",
  match: "Kamp",
  renovation: "Ombygging",
  reopening: "Gjenåpning",
  ownership_change: "Eierskifte",
  clubhouse: "Klubbhus",
  other: "Hendelse",
};

const MONTHS = ["januar", "februar", "mars", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "desember"];

/** Datoen slik kilden oppgir den — noen milepæler har bare et årstall. */
function when(value: string): string {
  const [year, month, day] = value.split("-");
  if (!month) return year!;
  if (!day) return `${MONTHS[Number(month) - 1]} ${year}`;
  return `${Number(day)}. ${MONTHS[Number(month) - 1]} ${year}`;
}

function period(venue: HomeVenue): string {
  const first = venue.homePeriods[0];
  if (!first) return "";
  const last = venue.homePeriods.at(-1)!;
  return last.to === null ? `${first.from}–` : `${first.from}–${last.to}`;
}

export default function HomeVenuesPage() {
  const venues = getHomeVenues();
  const titles = getSourceTitles();
  const first = venues[0]?.homePeriods[0]?.from;

  return (
    <article>
      <header className={`page-header ${styles.header}`}>
        <div>
          <p className="eyebrow">Der klubben har spilt</p>
          <h1>Hjemmebaner</h1>
          <p className={styles.lead}>
            Banene klubben har spilt hjemmekampene sine på, med periodene de var hjemmebane,
            hvilket dekke de hadde, og hva som har skjedd der. Alt er kildeført, og det
            arkivet ikke har belegg for, står ikke her.
          </p>
        </div>
        <div className={styles.coverage}>
          <span>Kildedekning</span>
          <strong>{first ?? "–"}–</strong>
          <p>{venues.length} baner · {venues.reduce((sum, venue) => sum + venue.events.length, 0)} milepæler</p>
        </div>
      </header>

      <ArchiveTabs current="/hjemmebaner" />

      <div className={styles.grid}>
        {venues.map((venue) => <VenueCard key={venue.id} venue={venue} titles={titles} />)}
      </div>

      <section className="content-section prose-stack">
        <h2>Vet du mer om banene?</h2>
        <p>
          Gjelder det én bestemt bane, står det en lenke på banens eget kort over — da
          følger banenavnet med i skjemaet. Mangler en bane helt, eller gjelder det
          oversikten som helhet, er det denne veien. Oppgi gjerne hvor opplysningen kan
          kontrolleres.
        </p>
        <p>
          <a className="button-link" href={contributionIssueUrl("datafeil", "Hjemmebaner", {
            sted: pageReference("Hjemmebaner", "/hjemmebaner"),
          })}>
            Meld en bane som mangler
          </a>
        </p>
      </section>
    </article>
  );
}

function VenueCard({ venue, titles }: { venue: HomeVenue; titles: Map<string, string> }) {
  const record = venue.attendanceRecords[0];
  const observations = getVenueObservations(venue.id);
  const surfaces = [...new Set(venue.surfaceHistory.map((entry) => SURFACE_LABELS[entry.surface] ?? entry.surface))];

  return (
    <section className={styles.card} id={venue.id}>
      <header>
        <p className="eyebrow num">{period(venue)}</p>
        <h2>{venue.name}</h2>
        {venue.city ? <p className="small muted">{venue.city}</p> : null}
      </header>

      <dl className={styles.facts}>
        {venue.opened ? <div><dt>Åpnet</dt><dd className="num">{venue.opened}</dd></div> : null}
        {surfaces.length > 0 ? <div><dt>Dekke</dt><dd>{surfaces.join(" → ")}</dd></div> : null}
        {venue.capacity ? <div><dt>Kapasitet</dt><dd className="num">{venue.capacity.toLocaleString("nb")}</dd></div> : null}
        {venue.matches > 0 ? <div><dt>Kamper i arkivet</dt><dd className="num">{venue.matches}</dd></div> : null}
      </dl>

      {record ? (
        <div className={styles.record}>
          <p className="eyebrow">Publikumsrekord</p>
          <p className={styles.recordNumber}>
            <strong className="num">{record.approximate ? "ca. " : ""}{record.attendance.toLocaleString("nb")}</strong>
            <span className="small muted">
              mot {record.opponent}{record.year ? `, ${record.year}` : ""}{record.context ? ` · ${record.context}` : ""}
            </span>
          </p>
          <SourceChips refs={record.sources} titles={titles} />
        </div>
      ) : null}

      {venue.events.length > 0 ? (
        <div className={styles.events}>
          <h3>Milepæler</h3>
          <ol>
            {[...venue.events]
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((event) => <Milestone key={event.id} event={event} titles={titles} />)}
          </ol>
        </div>
      ) : null}

      {/* Milepælene er banens egne hendelser i korte trekk. De historiske
          observasjonene er kildeført prosa om det samme stedet, og lå tidligere
          bare på personen eller sesongen — så banen som faktisk var stedet,
          viste ingenting. */}
      <HistoricalObservations observations={observations} titles={titles} className={styles.observations} level={3} />

      {venue.note ? <p className="small muted">{venue.note}</p> : null}

      {/* Rettelsen hører til banen, ikke til sida. Sto det bare én knapp nederst
          med «Hjemmebaner» som kontekst, måtte den som så at Kråmyra har feil
          åpningsår, selv skrive hvilken bane det gjaldt — og skjemaet fikk et
          sidenavn i stedet for et banenavn. */}
      <p className={styles.venueContribute}>
        <a href={contributionIssueUrl("datafeil", venue.name, {
          sted: pageReference(venue.name, "/hjemmebaner"),
        })}>
          Meld feil om {venue.name}
        </a>
      </p>
    </section>
  );
}

function Milestone({ event, titles }: { event: VenueEvent; titles: Map<string, string> }) {
  return (
    <li>
      <time className="num">{when(event.date)}</time>
      <div>
        <p className={styles.eventKind}>{EVENT_LABELS[event.kind] ?? event.kind}</p>
        <p className={styles.eventTitle}>{event.title}</p>
        {event.score ? (
          <p className="small muted num">
            {event.score.homeTeam} {event.score.home}–{event.score.away} {event.score.awayTeam}
          </p>
        ) : null}
        {event.attendance ? (
          <p className="small muted">
            {event.approximateAttendance ? "ca. " : ""}
            <span className="num">{event.attendance.toLocaleString("nb")}</span> tilskuere
          </p>
        ) : null}
        {event.participants.length > 0 ? (
          <p className="small muted">
            {event.participants.map((person) => person.affiliation ? `${person.name} (${person.affiliation})` : person.name).join(" · ")}
          </p>
        ) : null}
        {event.note ? <p className="small muted">{event.note}</p> : null}
        <SourceChips refs={event.sources} titles={titles} />
      </div>
    </li>
  );
}
