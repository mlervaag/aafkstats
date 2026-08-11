/**
 * Lesing av en ALTO-side med spaltene i behold.
 *
 * ## Hvorfor dette finnes
 *
 * Første masseuttrekk leste ALTO som en strøm av `<TextLine>` og analyserte hver
 * linje for seg. På en tospaltet boksside er det feil på to måter samtidig.
 *
 * For det første er OCR-ens egen blokkinndeling ikke til å stole på. Side 76 i
 * 50-årsboka har en `<TextBlock>` med `HPOS=852 WIDTH=1130` som dekker to
 * spalter, og hver `<TextLine>` i den løper tvers over begge. Linja
 *
 *     «En mente det var et sterkt behov mann, Einar Helseth, sekretær, Carl»
 *
 * er venstre spaltes «En mente det var et sterkt behov» limt sammen med høyre
 * spaltes «mann, Einar Helseth, sekretær, Carl». Leser man den som én setning,
 * blir Einar Helseth sekretær. Leser man spalten for seg, står det
 * «Formann, Øivind Haagensen, nestformann, Einar Helseth, sekretær, Carl
 * Gaaseide, …», og han er nestformann. Rollen forskyves ett hakk, systematisk,
 * fordi navnet følger etter rolleordet.
 *
 * For det andre bærer én linje sjelden et helt faktum. Årstallet står i
 * overskriften over, og navnet fortsetter på neste linje med orddeling.
 *
 * Derfor: bygg siden opp fra ordkoordinatene i stedet for å tro på blokkene.
 */

/** Ett ord med posisjon, slik ALTO oppgir det. */
export interface AltoWord {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** En spalte, med linjene sine i leserekkefølge. */
export interface PageColumn {
  /** Venstre og høyre kant, i ALTO-enheter. */
  from: number;
  to: number;
  lines: string[];
  /** Loddrett plassering for hver linje. Brukes til å pare tabellspalter. */
  positions: number[];
}

const STRING_TAG = /<String\b([^>]*?)\/?>/g;
const ATTRIBUTE = /(\w+)="([^"]*)"/g;

/**
 * Ordene på siden, med orddelingen satt sammen igjen.
 *
 * ALTO merker et delt ord med `SUBS_TYPE="HypPart1"` på første halvdel og
 * `HypPart2` på andre, og begge bærer hele ordet i `SUBS_CONTENT`. Vi tar hele
 * ordet fra første halvdel og hopper over andre. Uten det blir «nestfor-» og
 * «mann» to tokens, og et navnesøk på «nestformann» finner ingenting.
 */
export function parseAltoWords(xml: string): AltoWord[] {
  const words: AltoWord[] = [];

  for (const tag of xml.matchAll(STRING_TAG)) {
    const attributes = new Map<string, string>();
    for (const attribute of tag[1]!.matchAll(ATTRIBUTE)) attributes.set(attribute[1]!, attribute[2]!);

    const subsType = attributes.get("SUBS_TYPE");
    if (subsType === "HypPart2") continue;
    const raw = subsType === "HypPart1" ? attributes.get("SUBS_CONTENT") : attributes.get("CONTENT");
    const text = decodeXml(raw ?? "").trim();
    if (text === "") continue;

    const x = Number(attributes.get("HPOS"));
    const y = Number(attributes.get("VPOS"));
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    words.push({
      text,
      x,
      y,
      width: Number(attributes.get("WIDTH")) || 0,
      height: Number(attributes.get("HEIGHT")) || 0,
    });
  }

  return words;
}

/** Bøttebredden x-dekningen måles i. Smalere enn en typisk rennebredde. */
const BUCKET = 10;

/**
 * Spaltene på siden, funnet som vertikale renner i ordenes x-dekning.
 *
 * Rennen mellom to spalter er ikke nødvendigvis helt tom — en overskrift kan
 * krysse den — så terskelen er relativ til hvor tett siden ellers er, ikke
 * null. På side 76 gir det tre spalter med renner ved x≈825 og x≈1400, der en
 * ren nulltest bare hadde funnet den første.
 */
export function detectColumns(words: AltoWord[], options: { minGutter?: number } = {}): Array<{ from: number; to: number }> {
  if (words.length === 0) return [];

  const first = Math.floor(Math.min(...words.map((word) => word.x)) / BUCKET);
  const last = Math.floor(Math.max(...words.map((word) => word.x + word.width)) / BUCKET);

  const coverage = new Map<number, number>();
  for (const word of words) {
    for (let bucket = Math.floor(word.x / BUCKET); bucket <= Math.floor((word.x + word.width) / BUCKET); bucket += 1) {
      coverage.set(bucket, (coverage.get(bucket) ?? 0) + 1);
    }
  }

  const densities = [...coverage.values()].filter((value) => value > 0).sort((a, b) => a - b);
  const median = densities[Math.floor(densities.length / 2)] ?? 0;
  // Terskelen er relativ, ikke null. Rennen mellom to spalter er sjelden helt
  // tom — en overskrift eller en lang tittel krysser den — og på side 76 har
  // den ene rennen dekning 1-3 mot en median på 22. En absolutt nulltest fant
  // bare den ene av de to rennene, og siden ble lest som én spalte.
  const quiet = Math.max(1, median * 0.15);
  // Bredere enn et ordmellomrom, smalere enn en renne. På en ekte side ligger
  // ordluker rundt 20 enheter og rennene på 45; treffer terskelen mellom dem,
  // deles siden på spaltene og ikke inne i en setning.
  const minGutter = options.minGutter ?? 40;

  // Sammenhengende stille strekk. De som ligger inntil kantene er marger, ikke
  // renner, og skal ikke dele siden.
  const gutters: Array<{ from: number; to: number }> = [];
  let run: number | null = null;
  for (let bucket = first; bucket <= last + 1; bucket += 1) {
    const isQuiet = bucket <= last && (coverage.get(bucket) ?? 0) <= quiet;
    if (isQuiet) {
      run ??= bucket;
      continue;
    }
    if (run !== null) {
      const touchesEdge = run === first || bucket > last;
      if (!touchesEdge && (bucket - run) * BUCKET >= minGutter) {
        gutters.push({ from: run * BUCKET, to: bucket * BUCKET });
      }
      run = null;
    }
  }

  const edges = [first * BUCKET, ...gutters.flatMap((gutter) => [gutter.from, gutter.to]), (last + 1) * BUCKET];
  const columns: Array<{ from: number; to: number }> = [];
  for (let index = 0; index < edges.length; index += 2) {
    const from = edges[index]!;
    const to = edges[index + 1]!;
    if (to > from) columns.push({ from, to });
  }
  return columns;
}

/**
 * Siden som spalter, hver med sine linjer i leserekkefølge.
 *
 * Ordene fordeles på spalte etter sitt eget midtpunkt, ikke etter blokka de
 * står i, og settes sammen til linjer på loddrett nærhet. Da spiller det ingen
 * rolle at OCR-en la to spalter i samme blokk.
 */
export function readPageColumns(xml: string): PageColumn[] {
  const words = parseAltoWords(xml);
  const ranges = detectColumns(words);
  if (ranges.length === 0) return [];

  const median = medianOf(words.map((word) => word.height)) || 20;
  // To ord hører til samme linje når grunnlinjene ligger nærmere hverandre enn
  // en drøy halv teksthøyde. Mer enn det, og en overskrift limes til brødteksten.
  const tolerance = Math.max(4, median * 0.6);

  return ranges.map((range) => {
    const inColumn = words
      .filter((word) => {
        const centre = word.x + word.width / 2;
        return centre >= range.from && centre < range.to;
      })
      .sort((a, b) => a.y - b.y || a.x - b.x);

    const lines: string[] = [];
    const positions: number[] = [];
    let current: AltoWord[] = [];
    const flush = () => {
      const text = joinLine(current);
      if (text !== "") {
        lines.push(text);
        positions.push(current[0]!.y);
      }
    };
    for (const word of inColumn) {
      const anchor = current[0];
      if (anchor && Math.abs(word.y - anchor.y) > tolerance) {
        flush();
        current = [];
      }
      current.push(word);
    }
    if (current.length > 0) flush();

    return { from: range.from, to: range.to, lines, positions };
  }).filter((column) => column.lines.length > 0);
}

/** Spaltene som sammenhengende tekst, én streng per spalte. */
export function readPageText(xml: string): string[] {
  return readPageColumns(xml).map((column) => joinLines(column.lines));
}

/**
 * Setter linjene i en spalte sammen til løpende tekst og reparerer orddelingen.
 *
 * `SUBS_CONTENT` dekker bare de delte ordene OCR-en selv merket. På side 76 står
 * «nestfor-» med bindestreken i `CONTENT` og uten `SUBS_TYPE`, så uten denne
 * reparasjonen finnes ordet «nestformann» ikke i teksten — og nettopp det ordet
 * avgjør hvilken rolle Einar Helseth hadde.
 *
 * Bare bindestrek fulgt av en liten bokstav limes. Årstallsspenn som «1918 —19»
 * skal stå som de er.
 */
export function joinLines(lines: string[]): string {
  let text = "";
  for (const line of lines) {
    if (/-$/.test(text) && /^[\p{Ll}]/u.test(line)) text = `${text.slice(0, -1)}${line}`;
    else text = text === "" ? line : `${text} ${line}`;
  }
  return text.replace(/\s+/g, " ").trim();
}

function joinLine(words: AltoWord[]): string {
  return [...words]
    .sort((a, b) => a.x - b.x)
    .map((word) => word.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function medianOf(values: number[]): number {
  const sorted = values.filter((value) => value > 0).sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function decodeXml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_all, code: string) => String.fromCodePoint(Number(code)));
}


/** En linje er «bare et årstall» når den ikke inneholder annet. */
const BARE_YEAR = /^(1[89]\d{2}|20\d{2})[.\s]*$/;

/**
 * Tabeller der årstallet og verdien havnet i hver sin spalte.
 *
 * Side 351 i Tango siden 1914 har trenerrekka 1955-2013 satt opp i to
 * kolonner, og prikkene mellom år og navn er brede nok til at spaltefinneren
 * leser dem som en renne. Da står årene alene i én spalte og navnene alene i
 * neste, og raden — som er hele opplysningen — finnes ikke lenger.
 *
 * Her settes de sammen igjen på loddrett nærhet, ikke på rekkefølge: den ene
 * spalten kan ha en overskrift den andre ikke har, og da forskyves alt.
 */
export function pairedRows(columns: PageColumn[]): string[] {
  const rows: string[] = [];

  for (const [index, column] of columns.entries()) {
    const years = column.lines.filter((line) => BARE_YEAR.test(line)).length;
    if (years < 3 || years < column.lines.length * 0.6) continue;

    const values = columns[index + 1];
    if (!values) continue;

    for (const [line, position] of column.lines.map((line, at) => [line, column.positions[at]!] as const)) {
      const year = BARE_YEAR.exec(line)?.[1];
      if (!year) continue;
      let best = -1;
      let distance = Infinity;
      for (const [at, other] of values.positions.entries()) {
        const gap = Math.abs(other - position);
        if (gap < distance) { distance = gap; best = at; }
      }
      // Mer enn en linjehøyde unna er ikke samme rad.
      if (best === -1 || distance > 40) continue;
      rows.push(`${year} ${values.lines[best]}`);
    }
  }

  return rows;
}