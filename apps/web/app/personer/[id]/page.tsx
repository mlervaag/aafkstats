import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPersonById, getPersonIds, getPersonRoles, getPersonSeasons, getSourceTitles, mergeRoleSpells } from "@/lib/people";
import type { PersonConflict, PersonMention, PersonRole, PersonSummary } from "@/lib/people";
import {
  getDerivedPlayerById,
  getDerivedPlayerNameForms,
  getDerivedPlayerSeasons,
  getDerivedPlayers,
} from "@/lib/derived-players";
import type { DerivedPlayer } from "@/lib/derived-players";
import { loadContributions } from "@/lib/archive";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbJsonLd, personJsonLd } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/metadata";
import { contributionIssueUrl } from "@/lib/contribution-links";
import { ContributionButton } from "@/components/ContributionButton";
import { Contributions } from "@/components/Contributions";
import { SourceChips, collapseSources, pageList } from "@/components/SourceChips";
import styles from "../People.module.css";

const POSITION_LABELS: Record<string, string> = { keeper: "Keeper", forsvar: "Forsvar", midtbane: "Midtbane", angrep: "Angrep" };

const PROVIDER_LABELS: Record<string, string> = {
  "aafk-no": "aafk.no",
  nasjonalbiblioteket: "Nasjonalbiblioteket",
  wikipedia: "Wikipedia",
  contribution: "Bidrag",
};

const MONTHS = [
  "januar", "februar", "mars", "april", "mai", "juni",
  "juli", "august", "september", "oktober", "november", "desember",
];

/**
 * Datoer slik kildene oppgir dem, skrevet ut.
 *
 * Rollene har ulik oppløsning med vilje: styreåret 1962 er alt kilden sier om
 * de fleste verv, mens æresmedlemskapet har en eksakt dato. Skrevet som
 * `1915-12-11` ved siden av `1914–1915` ser det ut som en inkonsekvens i
 * arkivet i stedet for i kildene.
 */
function when(from: string, to: string | null): string {
  const day = (value: string): string => {
    const [year, month, date] = value.split("-");
    if (!month || !date) return year!;
    return `${Number(date)}. ${MONTHS[Number(month) - 1]} ${year}`;
  };
  if (to === null || to === from) return day(from);
  if (from.length === 4 && to.length === 4) return `${from}–${to}`;
  return `${day(from)} – ${day(to)}`;
}

/**
 * Beskrivelsen av en person, til søkemotorer og delingskort.
 *
 * Sto som «Roller og registrert kamphistorikk for X» på alle sidene, også de
 * hundrevis som bare har ett styreverv og ingen kamper. Den lovet kamphistorikk
 * arkivet ikke har, og gjorde alle personsidene like å se på utenfra. Her sier
 * teksten hva arkivet faktisk vet om nettopp denne personen.
 */
function personDescription(person: PersonSummary): string {
  const facts: string[] = [];
  if (person.appearances > 0) {
    const span = person.first_season && person.last_season && person.first_season !== person.last_season
      ? ` ${person.first_season}–${person.last_season}`
      : person.first_season ? ` i ${person.first_season}` : "";
    facts.push(`${person.appearances} ${person.appearances === 1 ? "kamp" : "kamper"} for AaFK${span}`);
  }
  if (person.role_count > 0) {
    const span = person.first_role_year && person.last_role_year && person.first_role_year !== person.last_role_year
      ? ` ${person.first_role_year}–${person.last_role_year}`
      : person.first_role_year ? ` fra ${person.first_role_year}` : "";
    facts.push(`${person.role_count} ${person.role_count === 1 ? "verv" : "verv"} i klubben${span}`);
  }

  if (facts.length === 0) return `${person.name} i AaFK-arkivet: kildeført oversikt over det arkivet har registrert.`;
  return `${person.name}: ${facts.join(", ")}. Kildeført i AaFK-arkivet.`;
}

export function generateStaticParams(): { id: string }[] {
  // Begge slag: de med personfil, og de arkivet bare kjenner fra
  // lagoppstillingene. Uten den andre halvparten hadde klubbens toppscorer
  // gjennom 2010-tallet ingen adresse i det hele tatt.
  return [...getPersonIds(), ...getDerivedPlayers().map((player) => player.id)].map((id) => ({ id }));
}

/** Beskrivelsen av en spiller arkivet bare kjenner fra lagoppstillingene. */
function derivedDescription(player: DerivedPlayer): string {
  const span = player.firstSeason === player.lastSeason
    ? ` i ${player.firstSeason}`
    : ` ${player.firstSeason}–${player.lastSeason}`;
  const goals = player.goals > 0 ? `, ${player.goals} mål` : "";
  return `${player.name}: ${player.appearances} ${player.appearances === 1 ? "kamp" : "kamper"} for AaFK${span}${goals}. `
    + "Utledet av lagoppstillingene i AaFK-arkivet.";
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const person = getPersonById(id);
  if (person) return pageMetadata(person.name, personDescription(person), `/personer/${id}`);
  const derived = getDerivedPlayerById(id);
  if (derived) return pageMetadata(derived.name, derivedDescription(derived), `/personer/${id}`);
  return { title: "Person ikke funnet" };
}

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const person = getPersonById(id);
  if (!person) {
    const derived = getDerivedPlayerById(id);
    if (derived) return <DerivedPlayerPage player={derived} />;
    notFound();
  }

  const roles = mergeRoleSpells(getPersonRoles(id)).reverse();
  const seasons = getPersonSeasons(id);
  const sourceTitles = getSourceTitles();
  const contributions = loadContributions(id, "person");
  const initials = person.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("");
  const played = person.appearances > 0;
  const missingMatchLinks = person.position !== null && !played;
  const squadSpan = seasons.length > 0
    ? ` i stallister fra ${seasons.at(-1)!.season} til ${seasons[0]!.season}`
    : "";
  const noLinkedContent = roles.length === 0 && seasons.length === 0 &&
    person.mentions.length === 0 && person.conflicts.length === 0;

  return (
    <article>
      <JsonLd
        data={[
          personJsonLd({
            id,
            name: person.name,
            nationality: person.nationality,
            description: personDescription(person),
            wikidata: person.wikidata,
            // De viste rolletitlene, uten gjentakelser. Ti år i styret er ett verv
            // å beskrive utad, ikke ti.
            roles: [...new Set(roles.map((role) => role.title))],
            played,
          }),
          breadcrumbJsonLd([
            { name: "Personer", path: "/personer" },
            { name: person.name, path: `/personer/${id}` },
          ]),
        ]}
      />
      <Link href="/personer" className={styles.backLink}>← Tilbake til personer</Link>
      <header className={`page-header ${styles.detailHeader}`}>
        <div className={styles.detailMonogram} aria-hidden="true">{initials}</div>
        <div>
          <p className="eyebrow">Person i AaFK-arkivet</p>
          <h1>{person.name}</h1>
          <div className={styles.detailMeta}>
            {person.position ? <span>{POSITION_LABELS[person.position] ?? person.position}</span> : null}
            {person.nationality ? <span>{person.nationality}</span> : null}
            {person.first_season ? <span>Kamper {person.first_season}–{person.last_season}</span> : null}
            {person.first_role_year ? <span>Roller {person.first_role_year}–{person.last_role_year}</span> : null}
          </div>
        </div>
      </header>

      <div className={styles.detailGrid}>
        <div>
          {missingMatchLinks ? (
            <section className={styles.dataGap}>
              <h2>Kampkoblinger mangler</h2>
              <p>
                Arkivet har registrert {person.name} som spiller{squadSpan}, men har
                foreløpig ikke koblet kamptropper og lagoppstillinger til denne
                personoppføringen. Derfor vises ikke kampantall eller starter ennå.
              </p>
            </section>
          ) : noLinkedContent ? (
            <section className={styles.dataGap}>
              <h2>Ingen koblede oppføringer ennå</h2>
              <p>
                Personen er registrert i arkivet, men ingen kamper, roller eller historiske
                publikasjoner er koblet til oppføringen ennå. Det er et dokumentert hull i
                arkivet, ikke en påstand om personens tilknytning til klubben.
              </p>
            </section>
          ) : null}

          {person.conflicts.length > 0 ? (
            <Conflicts conflicts={person.conflicts} titles={sourceTitles} personName={person.name} />
          ) : null}

          {roles.length > 0 ? (
            <section className={styles.section}>
              <h2>Roller og verv</h2>
              <ol className={styles.timeline}>
                {roles.map((role) => <Role key={role.role_id} role={role} titles={sourceTitles} />)}
              </ol>
            </section>
          ) : null}

          {seasons.length > 0 ? (
            <section className={styles.section}>
              <h2>Registrerte sesonger</h2>
              <div className="table-scroll">
                <table className={styles.seasonTable}>
                  <thead><tr><th>Sesong</th><th>Nr.</th><th>Kamptropper</th><th>Starter</th><th>Mål</th></tr></thead>
                  <tbody>
                    {seasons.map((season) => (
                      <tr key={season.season}>
                        <td><Link href={`/sesong/${season.season}`}>{season.season}</Link></td>
                        <td>{season.number ?? "–"}</td><td>{season.appearances}</td><td>{season.starts}</td><td>{season.goals}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {person.mentions.length > 0 ? <Mentions mentions={person.mentions} titles={sourceTitles} /> : null}
        </div>

        <aside className={styles.asideCard}>
          <h2>Dette vet arkivet</h2>
          <dl>
            {played ? (
              <>
                <div><dt>Kamptropper</dt><dd>{person.appearances}</dd></div>
                <div><dt>Starter</dt><dd>{person.starts}</dd></div>
              </>
            ) : null}
            {seasons.length > 0 ? (
              <div><dt>Stallister</dt><dd>{seasons.length} {seasons.length === 1 ? "sesong" : "sesonger"}</dd></div>
            ) : null}
            {person.role_count > 0 ? <div><dt>Kildeførte roller</dt><dd>{person.role_count}</dd></div> : null}
            {person.mentions.length > 0 ? (
              <div><dt>Omtalt i</dt><dd>{person.mentions.length} {person.mentions.length === 1 ? "publikasjon" : "publikasjoner"}</dd></div>
            ) : null}
            {person.conflicts.length > 0 ? (
              <div><dt>Uavklarte verv</dt><dd>{person.conflicts.length}</dd></div>
            ) : null}
          </dl>
          {person.wikidata ? <p className="small"><a href={`https://www.wikidata.org/wiki/${person.wikidata}`}>Åpne Wikidata →</a></p> : null}
          {person.note ? <p className="small muted">{person.note}</p> : null}
          <ContributionButton
            scope="person"
            targetId={id}
            title={person.name}
            label="Bidra om personen"
          />
        </aside>
      </div>

      <Contributions contributions={contributions} />
    </article>
  );
}

function Role({ role, titles }: { role: PersonRole; titles: Map<string, string> }) {
  return (
    <li>
      <time>{when(role.from_date, role.to_date)}</time>
      <div>
        <h3>{role.title}</h3>
        {role.body ? <p className={styles.roleBody}>{role.body}</p> : null}
        {role.note ? <p className="small muted">{role.note}</p> : null}
        <SourceChips refs={role.sources} titles={titles} />
      </div>
    </li>
  );
}

/**
 * Verv der kildene oppgir ulike navn.
 *
 * Står øverst med vilje. En leser som ser «Formann 1968» lenger nede skal vite
 * at en annen kilde sier noe annet før hen tar tallet med seg videre.
 */
function Conflicts({ conflicts, titles, personName }: {
  conflicts: PersonConflict[];
  titles: Map<string, string>;
  personName: string;
}) {
  /**
   * Merknaden bærer kilde-ID-en fra innhøstingen, som er en intern nøkkel.
   * Leseren skal se publikasjonen den peker på.
   */
  const readable = (note: string): string => {
    const id = /^([a-z0-9-]+)/.exec(note)?.[1];
    const title = id ? titles.get(id) : undefined;
    return title ? note.replace(id!, title) : note;
  };

  return (
    <section className={`${styles.section} ${styles.conflicts}`}>
      <h2>Kildene er uenige</h2>
      <p className="small muted">
        Arkivet velger ikke mellom dem. Vet du hvilken som stemmer, kan du{" "}
        <a href={contributionIssueUrl("datafeil", personName)}>sende inn en rettelse med kilde</a>.
      </p>
      <ul className={styles.conflictList}>
        {conflicts.map((conflict) => {
          const [office, year] = conflict.field.split(".");
          return (
            <li key={conflict.field}>
              <p className={styles.conflictField}>
                <span className={styles.conflictOffice}>{office ? office[0]!.toUpperCase() + office.slice(1) : conflict.field}</span>
                {year ? <span className="num">{year}</span> : null}
              </p>
              <ul>
                {conflict.values.map((value) => (
                  <li key={`${value.providerId}-${String(value.value)}`}>
                    <strong>{String(value.value)}</strong>
                    <span className="small muted">
                      {PROVIDER_LABELS[value.providerId] ?? value.providerId}
                      {value.note ? ` · ${readable(value.note)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Publikasjonene som omtaler personen.
 *
 * Ikke en påstand om hva de sier — bare at navnet står der, gjenkjent mot
 * registeret. For flere av de eldre er dette hele sporet arkivet har etter dem.
 */
function Mentions({ mentions, titles }: { mentions: PersonMention[]; titles: Map<string, string> }) {
  const shown = collapseSources(mentions, titles);
  return (
    <section className={styles.section}>
      <h2>Omtalt i</h2>
      <p className="small muted">
        {shown.length} {shown.length === 1 ? "publikasjon nevner" : "publikasjoner nevner"} navnet.
        Sidetallet er første treff i hver.
      </p>
      <ul className={styles.mentionList}>
        {[...shown]
          .sort((a, b) => a.title.localeCompare(b.title, "nb"))
          .map((mention) => (
            <li key={mention.title}>
              <Link href={`/kilder/${mention.sourceId}`}>
                {mention.title}<span className="num">{pageList(mention)}</span>
              </Link>
            </li>
          ))}
      </ul>
    </section>
  );
}

/**
 * En spiller arkivet bare kjenner fra lagoppstillingene.
 *
 * Sida sier bare det oppstillingene viser: sesonger, kamper, starter og mål.
 * Ingen nasjonalitet, posisjon eller draktnummer — de kommer fra personfila, og
 * finnes den ikke, vet arkivet det ikke. En utledet side som gjettet på
 * nasjonalitet ville vært en påstand uten kilde, og det er hele grunnen til at
 * dette laget kan finnes uten å svekke resten av arkivet.
 *
 * Den er ikke en fattigere utgave av en personside. Den er en annen slags
 * oppføring, på samme måte som et kildedokumentert resultat er noe annet enn en
 * kanonisk kamp, og den sier tydelig hva den er.
 */
function DerivedPlayerPage({ player }: { player: DerivedPlayer }) {
  const seasons = getDerivedPlayerSeasons(player.personKey);
  const nameForms = getDerivedPlayerNameForms(player.personKey);
  const initials = player.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("");

  return (
    <article>
      <JsonLd
        data={[
          personJsonLd({
            id: player.id,
            name: player.name,
            nationality: null,
            description: derivedDescription(player),
            wikidata: null,
            roles: [],
            played: true,
          }),
          breadcrumbJsonLd([
            { name: "Personer", path: "/personer" },
            { name: player.name, path: `/personer/${player.id}` },
          ]),
        ]}
      />
      <Link href="/personer" className={styles.backLink}>← Tilbake til personer</Link>
      <header className={`page-header ${styles.detailHeader}`}>
        <div className={styles.detailMonogram} aria-hidden="true">{initials}</div>
        <div>
          <p className="eyebrow">Spiller i AaFK-arkivet</p>
          <h1>{player.name}</h1>
          <div className={styles.detailMeta}>
            <span>Kamper {player.firstSeason}–{player.lastSeason}</span>
            {player.goals > 0 ? <span>{player.goals} mål</span> : null}
          </div>
        </div>
      </header>

      <div className={styles.detailGrid}>
        <div>
          <section className={styles.dataGap}>
            <h2>Utledet av lagoppstillingene</h2>
            <p>
              Arkivet har ingen egen personfil for {player.name}. Alt på denne sida er
              regnet ut fra lagoppstillingene i kampene, og derfor står det ingenting her
              om posisjon, nasjonalitet eller draktnummer. En personfil ville lagt til
              nettopp det, med kilde.
            </p>
            {nameForms.length > 1 && (
              <p className="small muted">
                Kildene skriver navnet på {nameForms.length} måter: {nameForms.join(", ")}.
              </p>
            )}
            <p>
              <a
                className="button-link"
                href={contributionIssueUrl("manglende-person", player.name)}
              >
                Legg til en personfil
              </a>
            </p>
          </section>

          <section className={styles.section}>
            <h2>Sesong for sesong</h2>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Sesong</th>
                    <th scope="col" className="num">Kamper</th>
                    <th scope="col" className="num">Fra start</th>
                    <th scope="col" className="num">Mål</th>
                  </tr>
                </thead>
                <tbody>
                  {seasons.map((season) => (
                    <tr key={season.season}>
                      <td><Link href={`/sesong/${season.season}`}>{season.season}</Link></td>
                      <td className="num">{season.appearances}</td>
                      <td className="num">{season.starts}</td>
                      <td className="num">{season.goals > 0 ? season.goals : "–"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">Totalt</th>
                    <td className="num">{player.appearances}</td>
                    <td className="num">{player.starts}</td>
                    <td className="num">{player.goals > 0 ? player.goals : "–"}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </div>

        <aside className={styles.asideCard}>
          <h2>Dette vet arkivet</h2>
          <dl>
            <div><dt>Kamptropper</dt><dd>{player.appearances}</dd></div>
            <div><dt>Fra start</dt><dd>{player.starts}</dd></div>
            <div><dt>Mål</dt><dd>{player.goals}</dd></div>
            <div><dt>Sesonger</dt><dd>{seasons.length}</dd></div>
          </dl>
          <p className="small muted">
            Tallene er talt fra lagoppstillinger og hendelser, ikke fra en kilde som
            oppgir dem samlet. Lagoppstillinger finnes fra 2010.
          </p>
        </aside>
      </div>
    </article>
  );
}
