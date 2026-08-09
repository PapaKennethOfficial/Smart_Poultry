// Sanity-check the augmented doc: list every heading (with its ordinal position)
// and count the total number of body paragraphs so we can confirm the injected
// content is present and that nothing else was removed.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const dxRoot = execFileSync('npm', ['root', '-g'], { shell: true }).toString().trim();
const JSZip = require(path.join(dxRoot, 'docx', 'node_modules', 'jszip'));

const FILE = 'C:\\Users\\HP\\Desktop\\Final Year Project\\Dennis_Benedict_Kenneth_21_July_2026.docx';

(async () => {
  const zip = await JSZip.loadAsync(fs.readFileSync(FILE));
  const xml = await zip.file('word/document.xml').async('string');
  const body = xml.match(/<w:body[^>]*>([\s\S]*?)<\/w:body>/)[1];

  const re = /<w:p\b[^>]*\/>|<w:p\b[^>]*>[\s\S]*?<\/w:p>|<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>|<w:sectPr\b[^>]*\/>|<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/g;
  let m, i = 0, headings = [], pCount = 0;
  while ((m = re.exec(body)) !== null) {
    const block = m[0];
    if (block.startsWith('<w:p')) pCount++;
    const styleMatch = block.match(/<w:pStyle\s+w:val="(Heading[1-6])"/);
    if (styleMatch) {
      const text = (block.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [])
        .map(t => t.replace(/<[^>]+>/g, ''))
        .join('').trim();
      headings.push({ idx: i, style: styleMatch[1], text });
    }
    i++;
  }

  console.log(`Total body blocks: ${i}, paragraphs: ${pCount}, headings: ${headings.length}\n`);
  console.log('Ch 4 & 5 headings and REFERENCES:');
  for (const h of headings) {
    if (/^(chapter (four|five)|4\.|5\.|references)/i.test(h.text)) {
      console.log(`  [${h.idx.toString().padStart(3)}] ${h.style} — ${h.text}`);
    }
  }

  // Spot-check: count how many paragraphs contain our sentinel phrases.
  const sentinels = [
    'Mapping, Live Delivery Tracking, and Location Privacy',
    'AI Microservice for Demand Forecasting',
    'Removal: Hardware-Dependent Sensor UI',
    'Prophet Cross-Validation on a Substantial Dataset',
    'MAPE of 9.36 percent',
    'protobuf to versions between 6.33.1',
    'whitelist-based data sanitisation',
    'OSRM (Luxen and Vetter, 2011)',
    'Taylor, S. J. and Letham, B. (2018)',
  ];
  console.log('\nSentinel presence check:');
  for (const s of sentinels) {
    console.log(`  ${xml.includes(s) ? '✓' : '✗'}  ${s}`);
  }
})().catch(e => { console.error(e); process.exit(1); });
