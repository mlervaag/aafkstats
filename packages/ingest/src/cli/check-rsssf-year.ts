import { fetchText } from "../http.js";

async function main() {
  const year = process.argv[2] || "1970";
  console.log(`=== RSSSF ${year} ===`);
  for (const page of ["Second", "Third", "Cup", "First", "Premier"]) {
    try {
      const url = `http://www.rsssf.no/${year}/${page}.html`;
      const html = await fetchText(url);
      if (html.includes("404 Not Found") || html.length < 100) continue;
      console.log(`\n--- ${url} (${html.length} chars) ---`);
      // Find sections mentioning Aalesund / AaFK
      const lines = html.split("\n");
      const hits = lines.filter(l => /aalesund|aafk|ålesund/i.test(l));
      if (hits.length > 0) {
        console.log(`Hits for AaFK in ${page}:`);
        for (const h of hits) console.log(`  ${h.trim()}`);
      } else {
        console.log(`No direct string match for AaFK in ${page}, first 500 chars:`);
        console.log(html.slice(0, 300).replace(/\s+/g, " "));
      }
    } catch {
      // not found
    }
  }
}

main().catch(console.error);
