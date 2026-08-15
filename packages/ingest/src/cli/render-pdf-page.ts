import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { repoRoot } from "@aafkstats/schema/load";
import { fetchBytes } from "../http.js";

const require = createRequire(import.meta.url);
const pdfJsWasmUrl = `${resolve(dirname(require.resolve("pdfjs-dist/legacy/build/pdf.mjs")), "../../wasm")}/`;

const PDF_URLS: Record<number, string> = {
  1970: "https://www.fotball.no/globalassets/krets/sunnmore/om-kretsen/arsrapporter/arsrapport-1970.pdf",
  1971: "https://www.fotball.no/globalassets/krets/sunnmore/om-kretsen/arsrapporter/arsrapport-1971.pdf",
  1972: "https://www.fotball.no/globalassets/krets/sunnmore/om-kretsen/arsrapporter/arsrapport-1972.pdf",
  1973: "https://www.fotball.no/globalassets/krets/sunnmore/om-kretsen/arsrapporter/arsrapport-1973.pdf",
  1974: "https://www.fotball.no/globalassets/krets/sunnmore/om-kretsen/arsrapporter/arsrapport-1974.pdf",
  1975: "https://www.fotball.no/globalassets/krets/sunnmore/om-kretsen/arsrapporter/arsrapport-1975.pdf",
  1976: "https://www.fotball.no/globalassets/krets/sunnmore/om-kretsen/arsrapporter/arsrapport-1976.pdf",
  1977: "https://www.fotball.no/globalassets/krets/sunnmore/om-kretsen/arsrapporter/arsrapport-1977.pdf",
  1978: "https://www.fotball.no/globalassets/krets/sunnmore/om-kretsen/arsrapporter/arsrapport-1978.pdf",
  1979: "https://www.fotball.no/globalassets/krets/sunnmore/om-kretsen/arsrapporter/arsrapport-1979.pdf",
};

async function main(): Promise<void> {
  const year = Number(process.argv[2]);
  const pageNum = Number(process.argv[3]);
  if (!year || !pageNum) throw new Error("Bruk: tsx render-pdf-page.ts <år> <side>");

  const bytes = await fetchBytes(PDF_URLS[year]!);
  const loadingTask = getDocument({ data: bytes.slice(), verbosity: 0, wasmUrl: pdfJsWasmUrl });
  const doc = await loadingTask.promise;
  const page = await doc.getPage(pageNum);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext("2d");
  await page.render({ canvas, canvasContext: context as never, viewport }).promise;
  
  const root = repoRoot();
  const outPath = resolve(root, `tmp/${year}_p${pageNum}.png`);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, canvas.toBuffer("image/png"));
  page.cleanup();
  await loadingTask.destroy();
  console.log(`Rendered ${year} page ${pageNum} -> ${outPath}`);
}

main().catch(console.error);
