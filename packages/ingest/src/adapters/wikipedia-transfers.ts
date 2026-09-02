import type { TransferDirection, TransferKind } from "@aafkstats/schema";

/**
 * Overganger fra engelske Wikipedias sesongartikler
 * («List of Norwegian football transfers summer 2017», «... winter 2016–17»).
 *
 * ## Hva denne kilden er god for, og hva den ikke er
 *
 * Klubbstallen (se `wikipedia-squad.ts`) viser hvem som var med, men ikke
 * hvorfor noen er nye eller borte. Disse artiklene fører hvert vindu for seg,
 * med retning, motpart og — oftest — en kildehenvisning til klubbens egen
 * melding. Det er nettopp det `Transfer`-skjemaet i `packages/schema` trenger.
 *
 * Den dekker bare det norske toppfotball-systemet har hatt egne artikler for,
 * og bare fra det tidspunktet noen på Wikipedia begynte å skrive dem. Eldre
 * overganger og overganger for klubber uten sesongartikkel finnes ikke her.
 *
 * ## Hvorfor modulen ikke gjør nettverk selv
 *
 * Denne fila er en ren parser: wikitekst inn, rader ut. Henting av artikkelen
 * og skriving til `data/` hører hjemme i et CLI-skript som kaller inn i denne
 * modulen — se `wikipedia-squad.ts` og `wikipedia-profile.ts` for mønsteret.
 * Å holde parsingen fri for side-effekter gjør den testbar mot ekte wikitekst
 * uten et nettverkskall per test.
 *
 * ## Rettigheter
 *
 * Som med den norske stallmalen: det vi leser er fakta — navn, retning,
 * klubb, draktnummer, nasjonalitet, posisjon, dato — ikke Wikipedias egen
 * prosa. `other`-feltet er et unntak i denne fila: det bevares råtekst fordi
 * det er grunnlaget `kind` og `club` utledes av, men det skal ikke vises fram
 * som sitat i arkivet.
 */

export interface WikipediaTransferRow {
  /** Spillernavn slik artikkelen skriver det, uten wikilenke-syntaks. */
  name: string;
  direction: TransferDirection;
  /** Motparten slik artikkelen skriver den, uten wikilenke-syntaks. Null når ingen klubb er oppgitt. */
  club: string | null;
  kind: TransferKind;
  /** Draktnummer når malen oppgir det. */
  number: number | null;
  /** Landkode slik malen oppgir den, f.eks. "NOR". */
  nationality: string | null;
  /** "GK" | "DF" | "MF" | "FW" når malen oppgir det. */
  position: string | null;
  /** Rå «other=»-tekst, bevart uendret. Den er grunnlaget for kind og club. */
  other: string;
  /** Fotnotene raden bærer. */
  refs: WikipediaTransferRef[];
}

export interface WikipediaTransferRef {
  title?: string;
  url?: string;
  publisher?: string;
  /** Dato slik cite-malen oppgir den, normalisert til YYYY-MM-DD når den lar seg tolke. */
  date?: string;
  archiveUrl?: string;
}

const MONTHS: Record<string, string> = {
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  may: "05",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12",
};

/**
 * Henter AaFK-seksjonen ut av artikkelens wikitekst.
 *
 * Overskriften er `===Aalesund===`, av og til med klubbens fulle navn som
 * wikilenke: `===[[Aalesunds FK|Aalesund]]===`. Seksjonen slutter ved neste
 * overskrift på samme eller høyere nivå — enten neste lag (`===`) eller neste
 * liga (`==`) — så avgrensningen ser etter en hvilken som helst linje som
 * starter med to eller flere likhetstegn, ikke bare tre.
 */
export function aalesundSection(wikitext: string): string | null {
  const start = /^===[^=\n]*Aalesund[^=\n]*===[ \t]*$/im.exec(wikitext);
  if (!start) return null;

  const rest = wikitext.slice(start.index + start[0].length);
  const end = /^==+[^=\n]/m.exec(rest);
  return end ? rest.slice(0, end.index) : rest;
}

/** Sesongen og vinduet en artikkeltittel gjelder. */
export function windowFromTitle(title: string): { season: number; window: "summer" | "winter" } | null {
  // «winter 2016–17» leder inn i 2017-sesongen — det er totallet, ikke
  // firetallet, som er sesongen. Streken er en en-strek på ekte artikler, men
  // en vanlig bindestrek dukker opp i lenker og manuelt skrevne titler.
  const winter = /winter\s+(\d{4})\s*[–-]\s*(\d{2,4})/i.exec(title);
  if (winter) {
    const startYear = winter[1]!;
    const endRaw = winter[2]!;
    const endYear = endRaw.length === 4 ? Number(endRaw) : Number(`${startYear.slice(0, 2)}${endRaw}`);
    return { season: endYear, window: "winter" };
  }

  const summer = /summer\s+(\d{4})/i.exec(title);
  if (summer) return { season: Number(summer[1]), window: "summer" };

  // De eldste artiklene («List of Norwegian football transfers 2010») har
  // ikke noe vindu i det hele tatt — bare ett vindu i året, og det er sommeren.
  const plain = /transfers\s+(\d{4})\s*$/i.exec(title.trim());
  if (plain) return { season: Number(plain[1]), window: "summer" };

  return null;
}

/**
 * Alle AaFK-rader i artikkelen, inn og ut.
 *
 * Tar hele artikkelens wikitekst, ikke bare AaFK-seksjonen, fordi en
 * selvlukkende `<ref name=X />` i seksjonen ofte peker på en definisjon som
 * står i en helt annen klubbs seksjon — se `namedRefContents`.
 */
export function parseTransferRows(wikitext: string): WikipediaTransferRow[] {
  const section = aalesundSection(wikitext);
  if (section === null) return [];

  const namedRefs = namedRefContents(wikitext);

  const inMarker = /'''In:'''/i.exec(section);
  const outMarker = /'''Out:'''/i.exec(section);

  const rows: WikipediaTransferRow[] = [];

  // Uten «In:» skal vi ikke gjette hvor inn-listen begynner — heller ingen
  // rader enn feil rader.
  if (inMarker) {
    const inEnd = outMarker ? outMarker.index : section.length;
    const inText = section.slice(inMarker.index + inMarker[0].length, inEnd);
    rows.push(...parseDirection(inText, "in", namedRefs));
  }

  if (outMarker) {
    const outText = section.slice(outMarker.index + outMarker[0].length);
    rows.push(...parseDirection(outText, "out", namedRefs));
  }

  return rows;
}

/**
 * Rekkemalen har to navn i bruk, avhengig av artikkelens alder: `{{Fs
 * player}}` fra rundt 2015 og utover, og `{{football squad player}}` (med
 * mellomrom eller understrek) i artiklene før det. Uten begge mister vi hele
 * 2010–2015.
 */
const ROW_TEMPLATE = /\{\{\s*(?:Fs|Football[ _]+Squad)[ _]+Player\s*\|/gi;

/** Én retnings rader: en rekkemal etterfulgt av null eller flere `<ref>`. */
function parseDirection(
  text: string,
  direction: TransferDirection,
  namedRefs: Map<string, string>,
): WikipediaTransferRow[] {
  const rows: WikipediaTransferRow[] = [];
  const starts: { openAt: number; fieldsStart: number }[] = [];
  for (const match of text.matchAll(ROW_TEMPLATE)) {
    starts.push({ openAt: match.index, fieldsStart: match.index + match[0].length });
  }

  for (let i = 0; i < starts.length; i += 1) {
    const { openAt, fieldsStart } = starts[i]!;
    const templateEnd = matchTemplate(text, openAt);
    const fieldsRaw = text.slice(fieldsStart, templateEnd - 2);
    const fields = readFields(fieldsRaw);

    const name = readLinked(fields.get("name") ?? "");
    if (name === "") continue;

    const other = (fields.get("other") ?? "").trim();
    const numberRaw = Number((fields.get("no") ?? "").trim());
    const nationality = nullIfEmpty(fields.get("nat"));
    const position = nullIfEmpty(fields.get("pos"))?.toUpperCase() ?? null;

    const rowEnd = i + 1 < starts.length ? starts[i + 1]!.openAt : text.length;
    const trailing = text.slice(templateEnd, rowEnd);

    const kind = kindFromOther(other, direction);
    // «Promoted from youth team» har et «from», men det peker på egen
    // ungdomsavdeling, ikke en motpart — en akademispiller har ingen klubb.
    const club = kind === "academy" ? null : clubFromOther(other);

    rows.push({
      name,
      direction,
      club,
      kind,
      number: Number.isInteger(numberRaw) && numberRaw >= 1 && numberRaw <= 99 ? numberRaw : null,
      nationality,
      position,
      other,
      refs: refsIn(trailing, namedRefs),
    });
  }

  return rows;
}

function nullIfEmpty(value: string | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Klubben `other=` peker på: teksten etter «from » eller «to », renset for
 * maler og lenker, og kuttet ved første komma.
 *
 * Kommaet er nødvendig fordi klubben ofte har en bisetning etter seg:
 * «from Liaoning Whowin, previously on loan at Aalesund» skal gi klubben
 * «Liaoning Whowin», ikke hele setningen.
 */
function clubFromOther(other: string): string | null {
  const cleaned = cleanText(other);
  const match = /\b(?:from|to)\s+([^,]+)/i.exec(cleaned);
  if (!match) return null;
  // Bisetningen står ikke alltid etter et komma: «on loan from Hødd made
  // permanent» ga klubben «Hødd made permanent». Halen kuttes derfor også på de
  // vendingene som beskriver avtalen i stedet for motparten.
  const club = trimDealTail(match[1]!).trim();
  return club === "" ? null : club;
}

/**
 * Kutter halen som beskriver avtalen i stedet for motparten.
 *
 * «on loan from Hødd made permanent» ga klubben «Hødd made permanent», fordi
 * bisetningen ikke alltid står etter et komma.
 *
 * Kuttet gjøres med indeksøk og ikke med et regex som `\s+(?:…|until .*)$`.
 * Den formen er polynomisk på en lang streng med mellomrom, og teksten her
 * kommer fra en artikkel hvem som helst kan redigere.
 */
const DEAL_TAILS = ["made permanent", "until", "for an undisclosed fee", "on a", "with"];

function trimDealTail(value: string): string {
  const lower = value.toLowerCase();
  let cut = value.length;
  for (const tail of DEAL_TAILS) {
    // Halen teller bare når den står som eget ord etter et mellomrom, ellers
    // ville «Wither» mistet slutten sin til «with».
    let from = 0;
    for (;;) {
      const at = lower.indexOf(` ${tail}`, from);
      if (at === -1) break;
      const after = at + tail.length + 1;
      if (after === lower.length || lower[after] === " ") {
        if (at < cut) cut = at;
        break;
      }
      from = at + 1;
    }
  }
  return value.slice(0, cut);
}

/**
 * Overgangstypen `other=` beskriver.
 *
 * `academy` gjelder bare når spilleren kom inn, `retired` og `released` bare
 * når spilleren gikk ut — sier ordlyden noe annet enn retningen tillater, er
 * det tryggere å falle tilbake til `transfer` enn å påstå noe kilden ikke sa.
 */
function kindFromOther(other: string, direction: TransferDirection): TransferKind {
  const lower = cleanText(other).toLowerCase();

  if (/loan return|returned from loan|end of loan/.test(lower)) return "loan_return";
  // «loan from Hødd made permanent» beskriver ikke et nytt lån. Låneordet
  // viser til avtalen som nå blir erstattet av en ordinær overgang, og må
  // derfor vurderes før den generelle loan-regelen.
  if (/\bmade permanent\b/.test(lower)) return "transfer";
  // «from OB, previously on loan» beskriver en ordinær overgang fra OB. Bare
  // ordlyd som gjør den aktuelle avtalen til et lån skal klassifiseres som lån;
  // historikk om et tidligere lån kan gjelde samme eller en helt annen klubb.
  if (/\bon loan\s+(?:from|to)\b|\bloan(?:ed)?\s+(?:from|to)\b/.test(lower)) return "loan";
  if (/free agent|free transfer/.test(lower)) return "free";
  if (direction === "in" && /\byouth\b|\bacademy\b|\bpromoted\b/.test(lower)) return "academy";
  if (direction === "out" && /\bretired\b/.test(lower)) return "retired";
  if (direction === "out" && /\breleased\b|contract terminated|contract expired/.test(lower)) return "released";
  return "transfer";
}

/**
 * Fotnotene i teksten mellom én rads mal og den neste.
 *
 * Et selvlukkende `<ref name=X />` har ikke noe innhold her — det er en
 * henvisning til en definisjon et annet sted i artikkelen, ofte i
 * motpartsklubbens seksjon. `namedRefs` er slått opp på forhånd over hele
 * wikiteksten nettopp for å løse den henvisningen. Finnes ingen definisjon
 * med det navnet, står raden uten den fotnoten, som før.
 */
function refsIn(text: string, namedRefs: Map<string, string>): WikipediaTransferRef[] {
  const refs: WikipediaTransferRef[] = [];
  for (const tag of readRefTags(text)) {
    const content = tag.content ?? (tag.name === undefined ? undefined : namedRefs.get(tag.name));
    if (content === undefined || content.trim() === "") continue;
    const ref = parseCiteWeb(content);
    if (ref) refs.push(ref);
  }
  return refs;
}

/**
 * Alle navngitte `<ref name=X>innhold</ref>`-definisjoner i hele artikkelen,
 * uansett hvilken klubbs seksjon de står i. Den første definisjonen av et
 * navn vinner, som er den eneste artikkelen selv bruker — de andre
 * forekomstene av samme navn er alltid selvlukkende henvisninger tilbake til
 * den.
 */
function namedRefContents(wikitext: string): Map<string, string> {
  const contents = new Map<string, string>();
  for (const tag of readRefTags(wikitext)) {
    if (tag.name && tag.content && tag.content.trim() !== "" && !contents.has(tag.name)) {
      contents.set(tag.name, tag.content);
    }
  }
  return contents;
}

interface RefTag {
  name?: string;
  content?: string;
}

/** Finner `<ref>...</ref>`, `<ref name=X>...</ref>` og `<ref name=X ... />` i tekst, i rekkefølge. */
function readRefTags(text: string): RefTag[] {
  const tags: RefTag[] = [];
  const openTag = /<ref([^>]*)>/gi;
  let match: RegExpExecArray | null;

  while ((match = openTag.exec(text))) {
    const attrs = match[1]!;
    const name = readRefName(attrs);
    const selfClosing = attrs.trimEnd().endsWith("/");
    if (selfClosing) {
      tags.push({ name });
      continue;
    }

    const closeIndex = text.indexOf("</ref>", openTag.lastIndex);
    if (closeIndex === -1) {
      tags.push({ name, content: text.slice(openTag.lastIndex) });
      break;
    }
    tags.push({ name, content: text.slice(openTag.lastIndex, closeIndex) });
    openTag.lastIndex = closeIndex + "</ref>".length;
  }

  return tags;
}

/** `name=Vito`, `name="Vito"` og `name='Vito'` — alle tre formene er i bruk. */
function readRefName(attrs: string): string | undefined {
  const match = /name\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s/]+))/.exec(attrs);
  if (!match) return undefined;
  return match[1] ?? match[2] ?? match[3];
}

/** Leser `{{cite web|title=...|url=...|publisher=...|date=...|archive-url=...}}` fra en fotnote. */
function parseCiteWeb(content: string): WikipediaTransferRef | undefined {
  const open = /\{\{\s*cite\s+\w+/i.exec(content);
  if (!open) return undefined;

  const openAt = open.index;
  const end = matchTemplate(content, openAt);
  const inner = content.slice(openAt + 2, end - 2);
  const firstPipe = inner.indexOf("|");
  const fields = readFields(firstPipe === -1 ? "" : inner.slice(firstPipe + 1));

  const title = nullIfEmpty(fields.get("title"));
  const url = nullIfEmpty(fields.get("url"));
  const publisherRaw = nullIfEmpty(fields.get("publisher"));
  const dateRaw = nullIfEmpty(fields.get("date"));
  // Malen har vært skrevet med og uten bindestrek i parameternavnet.
  const archiveUrl = nullIfEmpty(fields.get("archive-url")) ?? nullIfEmpty(fields.get("archiveurl"));

  const ref: WikipediaTransferRef = {};
  if (title) ref.title = cleanText(title);
  if (url) ref.url = url;
  if (publisherRaw) ref.publisher = cleanText(publisherRaw);
  const date = dateRaw ? normalizeDate(dateRaw) : undefined;
  if (date) ref.date = date;
  if (archiveUrl) ref.archiveUrl = archiveUrl;

  return ref;
}

/**
 * «19 December 2016», «2016-12-19» og «December 19, 2016» — cite-malen godtar
 * alle tre. Datoen står som Wikipedia skrev den når formatet ikke gjenkjennes,
 * i stedet for et gjettet tall.
 */
function normalizeDate(raw: string): string | undefined {
  const value = raw.trim();

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) return value;

  const dayMonthYear = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(value);
  if (dayMonthYear) {
    const month = MONTHS[dayMonthYear[2]!.toLowerCase()];
    if (month) return `${dayMonthYear[3]}-${month}-${dayMonthYear[1]!.padStart(2, "0")}`;
  }

  const monthDayYear = /^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/.exec(value);
  if (monthDayYear) {
    const month = MONTHS[monthDayYear[1]!.toLowerCase()];
    if (month) return `${monthDayYear[3]}-${month}-${monthDayYear[2]!.padStart(2, "0")}`;
  }

  return undefined;
}

/**
 * Deler en malkropp i felt på `|`, uten å dele på et `|` som hører til en
 * nøstet mal eller lenke. `other=from {{flagicon|NED}} [[Almere City FC|Almere
 * City]]` har to slike rør inni seg — en rett `split("|")` ville gitt fire
 * felt av det som er ett.
 */
function readFields(body: string): Map<string, string> {
  const fields = new Map<string, string>();
  for (const part of splitFields(body)) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    fields.set(part.slice(0, eq).trim().toLowerCase(), part.slice(eq + 1).trim());
  }
  return fields;
}

function splitFields(body: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;

  for (let i = 0; i < body.length; i += 1) {
    if (body.startsWith("{{", i) || body.startsWith("[[", i)) depth += 1;
    else if ((body.startsWith("}}", i) || body.startsWith("]]", i)) && depth > 0) depth -= 1;

    if (body[i] === "|" && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += body[i];
  }
  parts.push(current);

  return parts;
}

/**
 * Finner slutten av malen som åpner ved `openAt` (indeksen til dens første
 * `{`), og teller nivå på `{{ }}` slik at en nøstet mal — som `{{flagicon|
 * NOR}}` inni `{{Fs player|...}}` — ikke lukker den ytre malen for tidlig.
 */
function matchTemplate(text: string, openAt: number): number {
  let depth = 0;
  let i = openAt;

  while (i < text.length) {
    if (text.startsWith("{{", i)) {
      depth += 1;
      i += 2;
      continue;
    }
    if (text.startsWith("}}", i)) {
      depth -= 1;
      i += 2;
      if (depth === 0) return i;
      continue;
    }
    i += 1;
  }

  return text.length;
}

/** Fjerner nøstede maler som `{{flagicon|NOR}}` fra en verdi, og løser lenker til visningsteksten. */
function cleanText(raw: string): string {
  let withoutTemplates = "";
  let i = 0;
  while (i < raw.length) {
    if (raw.startsWith("{{", i)) {
      i = matchTemplate(raw, i);
      continue;
    }
    withoutTemplates += raw[i];
    i += 1;
  }

  const resolved = withoutTemplates.replace(
    /\[\[([^\]|]*)(?:\|([^\]]*))?\]\]/g,
    (_all, target: string, display: string | undefined) => display ?? target,
  );

  return stripAngleTags(resolved).replace(/\s+/g, " ").trim();
}

/**
 * Fjerner taggrester som `<ref name=x />` fra en verdi, helt.
 *
 * Ett enkelt gjennomløp holder ikke. `<scr<ref>ipt>` blir `<script>` av én
 * runde, fordi fjerningen av den indre taggen setter sammen to halvdeler til
 * en ny. Her er verdien et klubb- eller spillernavn og havner i YAML, ikke i
 * HTML, så det er ingen angrepsvei — men en fjerning som etterlater det den
 * skulle fjerne, er uansett ikke ferdig. Derfor gjentas den til strengen står
 * stille. Hver runde gjør strengen kortere, så den stopper alltid.
 */
function stripAngleTags(value: string): string {
  let current = value;
  for (;;) {
    const next = current.replace(/<[^>]*>/g, "");
    if (next === current) return current;
    current = next;
  }
}

/** `[[Mål|Vist]]` blir «Vist»; `[[Mål]]` blir «Mål». */
function readLinked(raw: string): string {
  return cleanText(raw);
}
