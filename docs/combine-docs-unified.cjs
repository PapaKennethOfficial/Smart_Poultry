// Combine the four source .docx files into a SINGLE Chapter 4 + SINGLE Chapter 5,
// merging content from every source under the same canonical headings.
// Styling: Times New Roman, 12pt body, 1.5 line spacing, A4.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const dxRoot = execFileSync('npm', ['root', '-g'], { shell: true }).toString().trim();
const docx = require(path.join(dxRoot, 'docx'));
const JSZip = require(path.join(dxRoot, 'docx', 'node_modules', 'jszip'));

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel,
  BorderStyle, WidthType, ShadingType, PageNumber, PageBreak,
} = docx;

const FONT = 'Times New Roman';
const SIZE = 24;   // 12pt
const LINE = 360;  // 1.5

// ─── XML helpers ─────────────────────────────────────────────────────────────

const XML_ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };
function decodeXml(s) {
  return s
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&(amp|lt|gt|quot|apos);/g, (m) => XML_ENT[m]);
}

function* iterateBodyBlocks(xml) {
  const bodyMatch = xml.match(/<w:body[^>]*>([\s\S]*?)<\/w:body>/);
  if (!bodyMatch) return;
  const re = /<w:p\b[^>]*\/>|<w:p\b[^>]*>[\s\S]*?<\/w:p>|<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>/g;
  let m;
  while ((m = re.exec(bodyMatch[1])) !== null) {
    const chunk = m[0];
    if (chunk.startsWith('<w:tbl')) yield { type: 'tbl', xml: chunk };
    else if (!chunk.endsWith('/>')) yield { type: 'p', xml: chunk };
  }
}

function getHeadingStyleLevel(pXml) {
  const m = pXml.match(/<w:pStyle\s+w:val="(Heading[123])"/);
  if (!m) return null;
  return { Heading1: 1, Heading2: 2, Heading3: 3 }[m[1]];
}

function isBulletPara(pXml) {
  return /<w:numPr\b/.test(pXml);
}

function extractRuns(pXml) {
  const runs = [];
  const runRe = /<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g;
  let rm;
  while ((rm = runRe.exec(pXml)) !== null) {
    const inner = rm[1];
    const rPrMatch = inner.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/);
    const rPr = rPrMatch ? rPrMatch[1] : '';
    const bold = /<w:b(\s*\/?>|\s[^>]*?\/?>)/.test(rPr) && !/<w:b\s+w:val="0"/.test(rPr);
    const italic = /<w:i(\s*\/?>|\s[^>]*?\/?>)/.test(rPr) && !/<w:i\s+w:val="0"/.test(rPr);
    const partRe = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/?>/g;
    let pm, text = '';
    while ((pm = partRe.exec(inner)) !== null) {
      if (pm[0].startsWith('<w:tab')) text += '\t';
      else text += decodeXml(pm[1]);
    }
    if (text) runs.push({ text, bold, italic });
  }
  return runs;
}

function paraText(pXml) {
  return extractRuns(pXml).map(r => r.text).join('').trim();
}

// ─── Heading classification ─────────────────────────────────────────────────
// Identify whether a paragraph is a heading and which canonical section it
// represents. We accept either an explicit HeadingN style or recognisable
// text patterns ("Chapter Four", "4.1 ...", "4.1.1 ...").

const NUM_WORDS = { four: 4, five: 5 };
function parseChapterRoman(text) {
  const m = text.match(/^chapter\s+(four|five|4|5)\b/i);
  if (!m) return null;
  const v = m[1].toLowerCase();
  return NUM_WORDS[v] ?? parseInt(v, 10);
}

function classifyHeading(pXml) {
  const styleLevel = getHeadingStyleLevel(pXml);
  const text = paraText(pXml);
  if (!text) return null;

  // Chapter heading — H1
  const chap = parseChapterRoman(text);
  if (chap === 4 || chap === 5) {
    return { level: 1, kind: 'chapter', chapter: chap, key: `${chap}`, text };
  }

  // References (treat as its own H1 section at the end)
  if (/^references?\b/i.test(text) && text.length < 40) {
    return { level: 1, kind: 'references', key: 'references', text };
  }

  // Section number patterns — 4.1, 5.2 (H2) or 4.1.1, 5.1.3 (H3)
  const m3 = text.match(/^([45])\.(\d+)\.(\d+)\b/);
  if (m3) {
    const key = `${m3[1]}.${m3[2]}.${m3[3]}`;
    return { level: 3, kind: 'subsection', key, text };
  }
  const m2 = text.match(/^([45])\.(\d+)\b/);
  if (m2) {
    const key = `${m2[1]}.${m2[2]}`;
    return { level: 2, kind: 'section', key, text };
  }

  // Fall back to style level for headings without a number prefix (e.g. plain
  // "Conclusion" / "Discussion"). These are unkeyed — we don't bucket them.
  if (styleLevel) {
    return { level: styleLevel, kind: 'styled', key: null, text };
  }
  return null;
}

// ─── Body block → docx-js Paragraph / Table ─────────────────────────────────

function buildParagraphFromXml(pXml) {
  const bullet = isBulletPara(pXml);
  const runs = extractRuns(pXml);
  const isEmpty = runs.every(r => !r.text || /^\s*$/.test(r.text));
  if (isEmpty) return null;
  const children = runs.map(r => new TextRun({
    text: r.text || '',
    bold: r.bold || false,
    italics: r.italic || false,
    font: FONT,
    size: SIZE,
  }));
  const opts = {
    spacing: { line: LINE, after: 120 },
    children,
  };
  if (bullet) {
    opts.bullet = { level: 0 };
  } else {
    opts.alignment = AlignmentType.JUSTIFIED;
  }
  return new Paragraph(opts);
}

function extractCellText(tcXml) {
  const lines = [];
  const pRe = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
  let pm;
  while ((pm = pRe.exec(tcXml)) !== null) {
    const t = extractRuns(pm[0]).map(r => r.text).join('').trim();
    if (t) lines.push(t);
  }
  return lines.join('\n');
}

function buildTableFromXml(tblXml) {
  const rowsXml = [...tblXml.matchAll(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g)].map(m => m[0]);
  if (rowsXml.length === 0) return null;
  const colCount = Math.max(...rowsXml.map(tr => (tr.match(/<w:tc\b/g) || []).length));
  if (colCount === 0) return null;

  const TOTAL = 9026; // A4 content width in DXA
  const colWidth = Math.floor(TOTAL / colCount);
  const columnWidths = Array.from({ length: colCount }, () => colWidth);
  columnWidths[colCount - 1] += TOTAL - columnWidths.reduce((a, b) => a + b, 0);
  const thin = { style: BorderStyle.SINGLE, size: 1, color: '888888' };
  const borders = { top: thin, bottom: thin, left: thin, right: thin };

  const rows = rowsXml.map((trXml, rowIdx) => {
    const cellsXml = [...trXml.matchAll(/<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/g)].map(m => m[0]);
    const isHeader = rowIdx === 0;
    const cells = cellsXml.slice(0, colCount).map((tcXml, i) => {
      const text = extractCellText(tcXml) || ' ';
      return new TableCell({
        borders,
        width: { size: columnWidths[i], type: WidthType.DXA },
        shading: isHeader ? { fill: 'E7EEF7', type: ShadingType.CLEAR } : undefined,
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: text.split('\n').map(line => new Paragraph({
          spacing: { line: 280, after: 0 },
          children: [new TextRun({ text: line, bold: isHeader, font: FONT, size: 22 })],
        })),
      });
    });
    while (cells.length < colCount) {
      cells.push(new TableCell({
        borders,
        width: { size: columnWidths[cells.length], type: WidthType.DXA },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({ children: [new TextRun({ text: ' ', font: FONT, size: 22 })] })],
      }));
    }
    return new TableRow({ children: cells });
  });

  return new Table({ width: { size: TOTAL, type: WidthType.DXA }, columnWidths, rows });
}

// ─── Read + bucket source files ─────────────────────────────────────────────

async function loadXml(filePath) {
  const buf = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(buf);
  return zip.file('word/document.xml').async('string');
}

// Bucket every body block under a section key derived from the most recent
// classified heading. Returns a Map: sectionKey -> array of docx-js blocks.
// Special keys: "4", "5", "references", "<chapter>.<section>", "<chapter>.<section>.<sub>".
async function bucketFromFile(filePath) {
  const xml = await loadXml(filePath);
  const buckets = new Map();
  // Track the most recent heading at each level so a deep-only key still inherits
  // its chapter/section context if needed.
  let currentChapter = null;       // "4" | "5" | "references"
  let currentSection = null;       // "4.1" | ...
  let currentSubsection = null;    // "4.1.1" | ...
  // The most specific bucket key currently active for body content.
  let activeKey = '_preamble';

  function bucket(key) {
    if (!buckets.has(key)) buckets.set(key, []);
    return buckets.get(key);
  }

  for (const it of iterateBodyBlocks(xml)) {
    if (it.type === 'p') {
      const classified = classifyHeading(it.xml);
      if (classified) {
        if (classified.kind === 'chapter') {
          currentChapter = classified.key;
          currentSection = null;
          currentSubsection = null;
          activeKey = currentChapter;
        } else if (classified.kind === 'references') {
          currentChapter = 'references';
          currentSection = null;
          currentSubsection = null;
          activeKey = 'references';
        } else if (classified.level === 2) {
          currentSection = classified.key;
          currentSubsection = null;
          activeKey = currentSection;
          // Derive chapter from key if it wasn't already set.
          if (!currentChapter) currentChapter = classified.key.split('.')[0];
        } else if (classified.level === 3) {
          currentSubsection = classified.key;
          activeKey = currentSubsection;
          if (!currentSection) currentSection = classified.key.split('.').slice(0, 2).join('.');
          if (!currentChapter) currentChapter = classified.key.split('.')[0];
        }
        // Headings themselves are NOT added to the bucket — we synthesise them
        // canonically in the output. This avoids duplicate heading text when
        // multiple sources share the same section.
        continue;
      }
      const para = buildParagraphFromXml(it.xml);
      if (para) bucket(activeKey).push(para);
    } else if (it.type === 'tbl') {
      const tbl = buildTableFromXml(it.xml);
      if (tbl) bucket(activeKey).push(tbl);
    }
  }
  return buckets;
}

// Merge multiple bucket maps so that key X gets [...src1.X, ...src2.X, ...].
function mergeBuckets(maps) {
  const merged = new Map();
  for (const map of maps) {
    for (const [key, blocks] of map.entries()) {
      if (!merged.has(key)) merged.set(key, []);
      merged.get(key).push(...blocks);
    }
  }
  return merged;
}

// ─── Build the unified document ─────────────────────────────────────────────

function h(level, text) {
  const HEAD = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3 };
  const size = { 1: 36, 2: 30, 3: 26 }[level];
  return new Paragraph({
    heading: HEAD[level],
    spacing: {
      before: level === 1 ? 480 : level === 2 ? 360 : 260,
      after:  level === 1 ? 240 : level === 2 ? 180 : 140,
      line: LINE,
    },
    children: [new TextRun({ text, bold: true, font: FONT, size })],
  });
}

// Canonical heading order — the spine of the unified document.
const PLAN = [
  { level: 1, title: 'Chapter Four: System Implementation', key: '4' },
  { level: 2, title: '4.1 Development',                     key: '4.1' },
  { level: 3, title: '4.1.1 Programming Languages and Tools Used', key: '4.1.1' },
  { level: 3, title: '4.1.2 Implementation Details',        key: '4.1.2' },
  { level: 3, title: '4.1.3 Testing and Quality Assurance', key: '4.1.3' },
  { level: 2, title: '4.2 Evaluation',                      key: '4.2' },
  { level: 3, title: '4.2.1 Evaluation Metrics',            key: '4.2.1' },
  { level: 3, title: '4.2.2 User Testing',                  key: '4.2.2' },
  { level: 3, title: '4.2.3 Performance Evaluation',        key: '4.2.3' },
  { level: 2, title: '4.3 Conclusion',                      key: '4.3' },
  { level: 1, title: 'Chapter Five: Conclusion and Recommendations', key: '5' },
  { level: 2, title: '5.1 Discussion',                      key: '5.1' },
  { level: 3, title: '5.1.1 Comparison with Existing Systems', key: '5.1.1' },
  { level: 3, title: '5.1.2 Challenges Faced',              key: '5.1.2' },
  { level: 3, title: '5.1.3 Lessons Learned',               key: '5.1.3' },
  { level: 3, title: '5.1.4 Contributions to the Field',    key: '5.1.4' },
  { level: 3, title: '5.1.5 Future Work',                   key: '5.1.5' },
  { level: 2, title: '5.2 Conclusion',                      key: '5.2' },
  { level: 1, title: 'References',                          key: 'references' },
];

const INPUTS = [
  'C:\\Users\\HP\\Downloads\\Chapter Four.docx',
  'C:\\Users\\HP\\Downloads\\Chapter Fou1.docx',
  'C:\\Users\\HP\\Downloads\\Chapter Four and 5.docx',
  'C:\\Users\\HP\\Desktop\\Final Year Project\\Smart_Poultry\\docs\\SmartPoultry-Chapters-4-5.docx',
];

(async () => {
  const maps = [];
  for (const f of INPUTS) {
    process.stdout.write(`reading ${path.basename(f)} ... `);
    const m = await bucketFromFile(f);
    process.stdout.write(`${m.size} buckets\n`);
    maps.push(m);
  }
  const merged = mergeBuckets(maps);

  // Diagnostic — bucket sizes after merge.
  console.log('---merged bucket sizes---');
  [...merged.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([k, v]) => console.log(`  ${k.padEnd(14)}  ${v.length} blocks`));

  // Build the spine.
  const children = [];
  for (const entry of PLAN) {
    children.push(h(entry.level, entry.title));
    const blocks = merged.get(entry.key) || [];
    children.push(...blocks);
  }

  // Anything that was preamble or unkeyed → tucked into an appendix so it isn't lost.
  const preamble = merged.get('_preamble') || [];
  if (preamble.length > 0) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(h(1, 'Appendix: Unclassified material'));
    children.push(new Paragraph({
      spacing: { line: LINE, after: 120 },
      alignment: AlignmentType.JUSTIFIED,
      children: [new TextRun({
        text: 'The following content from the source documents did not appear under a numbered chapter or section heading and has been preserved here so nothing is lost.',
        italics: true, font: FONT, size: SIZE, color: '666666',
      })],
    }));
    children.push(...preamble);
  }

  const doc = new Document({
    creator: 'Akpalolo Dennis Etornam',
    title: 'SmartPoultry — Combined Chapters 4 & 5 (unified)',
    description: 'Unified Chapter 4 and Chapter 5 merged from all source documents',
    styles: {
      default: { document: { run: { font: FONT, size: SIZE } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 36, bold: true, font: FONT, color: '000000' },
          paragraph: { spacing: { before: 480, after: 240, line: LINE }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 30, bold: true, font: FONT, color: '000000' },
          paragraph: { spacing: { before: 360, after: 180, line: LINE }, outlineLevel: 1 } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 26, bold: true, font: FONT, color: '000000' },
          paragraph: { spacing: { before: 260, after: 140, line: LINE }, outlineLevel: 2 } },
      ],
    },
    numbering: {
      config: [{
        reference: 'bullets',
        levels: [{ level: 0, format: 'bullet', text: '•', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
      }],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },           // A4
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      headers: {
        default: new Header({ children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: 'SmartPoultry — Chapters 4 & 5 (unified)', italics: true, font: FONT, size: 20 })],
        })] }),
      },
      footers: {
        default: new Footer({ children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: 'Page ', font: FONT, size: 20 }),
            new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 20 }),
            new TextRun({ text: ' of ', font: FONT, size: 20 }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 20 }),
          ],
        })] }),
      },
      children,
    }],
  });

  const outPath = path.resolve(__dirname, 'SmartPoultry-Chapters-4-5-UNIFIED.docx');
  const buf = await Packer.toBuffer(doc);
  fs.writeFileSync(outPath, buf);
  console.log(`\nwrote ${outPath} (${buf.length} bytes, ${children.length} blocks)`);
})().catch(e => { console.error(e); process.exit(1); });
