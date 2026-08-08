import { parseArgs } from "node:util";
import { join } from "node:path";
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { stringify } from "yaml";
import { repoRoot } from "@aafkstats/schema/load";

const args = parseArgs({
  options: {
    write: { type: "boolean" },
    query: { type: "string" },
  },
});

const q = args.values.query || '"Aalesunds fotballklubb"';
const size = 50;

async function run() {
  console.log(`Søker Nasjonalbiblioteket etter: ${q}`);
  
  let page = 0;
  let total = 0;
  let fetched = 0;
  const publications = [];

  do {
    const res = await fetch(`https://api.nb.no/catalog/v1/items?q=${encodeURIComponent(q)}&page=${page}&size=${size}`);
    if (!res.ok) throw new Error(`NB API error: ${res.statusText}`);
    const data = await res.json() as any;
    total = data.page.totalElements;

    for (const item of data._embedded?.items || []) {
      const metadata = item.metadata;
      
      let type = "other";
      const mediaType = metadata.mediaTypes?.[0];
      if (mediaType === "bok") type = "book";
      else if (mediaType === "tidsskrift") type = "magazine";
      else if (mediaType === "avis") continue; // Skipper aviser
      
      const urn = metadata.identifiers?.urn;
      if (!urn) continue;
      
      const yearStr = metadata.originInfo?.issued;
      let year = null;
      if (yearStr) {
        const match = yearStr.match(/^(\d{4})/);
        if (match) year = parseInt(match[1], 10);
      }
      
      const title = metadata.title;
      // Slugs for ID
      let idTitle = title.toLowerCase().replace(/[^a-z0-9æøå]+/g, "-").replace(/(^-|-$)/g, "");
      idTitle = idTitle.replace(/æ/g, "ae").replace(/ø/g, "o").replace(/å/g, "a");
      if (idTitle.length > 30) idTitle = idTitle.substring(0, 30).replace(/-$/, "");
      const id = `${idTitle}-${year || "ukjent"}-${item.id.substring(0, 4)}`;

      let publisher = metadata.originInfo?.publisher;
      if (Array.isArray(publisher)) publisher = publisher[0];
      if (typeof publisher !== 'string') publisher = null;

      const pubLower = (publisher || "").toLowerCase();
      const titleLower = (title || "").toLowerCase();
      
      const isRelevant = 
        pubLower.includes("aalesunds fotballklubb") || 
        pubLower.includes("aalesunds fk") || 
        pubLower.includes("aafk") || 
        titleLower.includes("aalesunds fotballklubb") || 
        titleLower.includes("aalesunds fk") || 
        titleLower.includes("aafk") ||
        titleLower.includes("aalesund fk");

      if (!isRelevant) {
        console.log(`[Forkastet] Ikke relevant: "${title}" (Utgiver: ${publisher || 'Ingen'})`);
        continue;
      }

      const pub = {
        id,
        title,
        type,
        publisher,
        year,
        coverUrl: item._links?.thumbnail_large?.href || null,
        accessUrl: `https://www.nb.no/items/${urn}`,
        sources: [
          {
            sourceId: "nasjonalbiblioteket",
            url: `https://www.nb.no/items/${urn}`
          }
        ]
      };
      
      // Fjern null-verdier (YAML foretrekker at de utelates framfor at de er 'null')
      Object.keys(pub).forEach(k => {
        if ((pub as any)[k] === null) {
          delete (pub as any)[k];
        }
      });
      
      publications.push(pub);
    }
    
    fetched += data._embedded?.items?.length || 0;
    page++;
  } while (fetched < total && page < 10);

  console.log(`Fant ${publications.length} publikasjoner (ekskludert aviser).`);

  if (args.values.write) {
    const outDir = join(repoRoot(), "data", "publications");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    
    for (const pub of publications) {
      const file = join(outDir, `${pub.id}.yaml`);
      if (!existsSync(file)) {
        writeFileSync(file, stringify(pub));
        console.log(`Skrev ${file}`);
      } else {
        console.log(`Hoppet over (finnes allerede): ${file}`);
      }
    }
  } else {
    console.log("Kjørt uten --write. Funnet data:");
    console.log(publications.map(p => `- ${p.year}: ${p.title} (${p.type})`).join("\n"));
  }
}

run().catch(console.error);
