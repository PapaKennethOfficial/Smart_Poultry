// Splice the unified Chapter 4 + Chapter 5 content INTO the main project docx,
// replacing the existing Chapter 4 stubs. Preserves the main doc's:
//   - styles, theme, numbering, fonts
//   - all embedded images
//   - per-section headers and footers (incl. page numbering)
// and inherits the main doc's heading styles by stripping direct formatting
// (size / rFonts / spacing) from the spliced content.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const dxRoot = execFileSync('npm', ['root', '-g'], { shell: true }).toString().trim();
const JSZip = require(path.join(dxRoot, 'docx', 'node_modules', 'jszip'));

const MAIN    = 'C:\\Users\\HP\\Desktop\\Final Year Project\\Dennis_Benedict_Kenneth_1st_May_2026.docx';
const UNIFIED = 'C:\\Users\\HP\\Desktop\\Final Year Project\\Smart_Poultry\\docs\\SmartPoultry-Chapters-4-5-UNIFIED.docx';
const OUTPUT  = 'C:\\Users\\HP\\Desktop\\Final Year Project\\Dennis_Benedict_Kenneth_15_JUNE_2026.docx';

// ─── Helpers ────────────────────────────────────────────────────────────────

function paraText(blockXml) {
  return (blockXml.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [])
    .map(t => t.replace(/<[^>]+>/g, ''))
    .join('')
    .trim();
}

// Walk every top-level body block in document.xml, in order.
function* iterateBlocks(documentXml) {
  const body = documentXml.match(/<w:body[^>]*>([\s\S]*?)<\/w:body>/);
  if (!body) return;
  const re = /<w:p\b[^>]*\/>|<w:p\b[^>]*>[\s\S]*?<\/w:p>|<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>|<w:sectPr\b[^>]*\/>|<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/g;
  let m;
  while ((m = re.exec(body[1])) !== null) yield m[0];
}

// Strip direct formatting that would override the destination doc's styles.
// We KEEP bold, italic, colour, language tags. We DROP rFonts, size, paragraph
// spacing/indent, and line rules — those are the things that make the spliced
// content look "different" from the rest of the main doc.
function stripDirectFormatting(xml) {
  return xml
    // Run-level direct sizes
    .replace(/<w:sz\s+[^>]*\/>/g, '')
    .replace(/<w:szCs\s+[^>]*\/>/g, '')
    // Run-level direct font
    .replace(/<w:rFonts\s+[^>]*\/>/g, '')
    // Paragraph spacing / indent — let the destination style govern
    .replace(/<w:spacing\s+[^>]*\/>/g, '')
    // Drop empty <w:rPr></w:rPr> shells left behind after stripping
    .replace(/<w:rPr>\s*<\/w:rPr>/g, '');
}

// ─── Main ───────────────────────────────────────────────────────────────────

(async () => {
  console.log('reading main project doc ...');
  const mainBuf = fs.readFileSync(MAIN);
  const mainZip = await JSZip.loadAsync(mainBuf);
  const mainXml = await mainZip.file('word/document.xml').async('string');

  console.log('reading unified chapters 4 & 5 ...');
  const unifiedBuf = fs.readFileSync(UNIFIED);
  const unifiedZip = await JSZip.loadAsync(unifiedBuf);
  const unifiedXml = await unifiedZip.file('word/document.xml').async('string');

  // 1. Find boundaries in the main doc.
  // We want the substring from the start of the actual "Chapter Four..."
  // HEADING paragraph through (but NOT including) the start of the actual
  // "REFERENCES" HEADING paragraph. The Table of Contents contains the same
  // text but uses TOC styles, not HeadingN — so we filter on Heading1.
  const isHeading1 = (block) => /<w:pStyle\s+w:val="Heading1"/.test(block);
  const mainBlocks = [...iterateBlocks(mainXml)];
  let ch4Start = -1, refsStart = -1;
  for (let i = 0; i < mainBlocks.length; i++) {
    const block = mainBlocks[i];
    if (!isHeading1(block)) continue;
    const t = paraText(block);
    if (ch4Start === -1 && /^Chapter Four: System Implementation\b/i.test(t)) {
      ch4Start = mainXml.indexOf(block);
    } else if (ch4Start !== -1 && refsStart === -1 && /^REFERENCES\b/i.test(t)) {
      refsStart = mainXml.indexOf(block);
      break;
    }
  }
  if (ch4Start === -1) throw new Error('Could not find "Chapter Four: System Implementation" in main doc.');
  if (refsStart === -1) throw new Error('Could not find "REFERENCES" heading in main doc after Chapter Four.');
  console.log(`main doc: splice region [${ch4Start} .. ${refsStart}] (${(refsStart - ch4Start).toLocaleString()} chars)`);

  // 2. Extract the body blocks from unified that we want to splice in.
  // We take Chapter Four heading onward, up to BUT NOT INCLUDING the
  // "References" heading. The main doc keeps its own REFERENCES section.
  const unifiedBlocks = [...iterateBlocks(unifiedXml)];
  const toSplice = [];
  let started = false;
  for (const b of unifiedBlocks) {
    const t = paraText(b);
    if (!started) {
      if (/^Chapter Four: System Implementation\b/i.test(t)) {
        started = true;
      }
    }
    if (!started) continue;
    if (/^References?\b/i.test(t)) break;          // stop just before References
    if (b.startsWith('<w:sectPr')) continue;       // skip section properties
    toSplice.push(b);
  }
  console.log(`unified doc: ${toSplice.length} blocks to splice`);

  // 3. Strip direct formatting and join.
  const cleaned = stripDirectFormatting(toSplice.join(''));

  // 4. Build the new document.xml.
  const newXml = mainXml.substring(0, ch4Start) + cleaned + mainXml.substring(refsStart);
  console.log(`main doc size: ${mainXml.length.toLocaleString()} -> ${newXml.length.toLocaleString()} chars`);

  // 5. Write back to a fresh copy of the zip.
  mainZip.file('word/document.xml', newXml);
  // Update the core property title if present
  if (mainZip.file('docProps/core.xml')) {
    let core = await mainZip.file('docProps/core.xml').async('string');
    core = core.replace(/<dc:title>[\s\S]*?<\/dc:title>/, '<dc:title>SmartPoultry — Final Project (15 June 2026)</dc:title>');
    mainZip.file('docProps/core.xml', core);
  }
  const outBuf = await mainZip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
  fs.writeFileSync(OUTPUT, outBuf);
  console.log(`\nwrote ${OUTPUT} (${outBuf.length.toLocaleString()} bytes)`);
})().catch(e => { console.error(e); process.exit(1); });
