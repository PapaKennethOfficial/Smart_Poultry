// Combine 4 input .docx files into a single Times-New-Roman 12pt / 1.5-spaced docx.
// Approach: read each input via JSZip, pull the body block-by-block (paragraphs +
// tables in source order), and rebuild with docx-js using uniform styling.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// Resolve global npm root once (no shell interpolation, no user input).
const dxRoot = execFileSync('npm', ['root', '-g'], { shell: true }).toString().trim();
const docx = require(path.join(dxRoot, 'docx'));
const JSZip = require(path.join(dxRoot, 'docx', 'node_modules', 'jszip'));

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel,
  BorderStyle, WidthType, ShadingType, PageNumber, PageBreak,
} = docx;

const FONT = 'Times New Roman';
const SIZE = 24; // half-points (12pt)
const LINE = 360; // 1.5 line spacing (240 = single)

// ─── XML helpers ─────────────────────────────────────────────────────────────

const XML_ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };
function decodeXmlEntities(s) {
  return s
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&(amp|lt|gt|quot|apos);/g, (m) => XML_ENT[m]);
}

// Walk top-level <w:body> children in source order. Yields { type, xml } where
// type is 'p' | 'tbl'. We use a non-greedy regex that matches balanced opening/
// closing pairs; this is safe for w:p and w:tbl because Word never nests them.
function* iterateBodyBlocks(xml) {
  const bodyMatch = xml.match(/<w:body[^>]*>([\s\S]*?)<\/w:body>/);
  if (!bodyMatch) return;
  const body = bodyMatch[1];

  // Match either <w:p ...>...</w:p>, <w:p .../>, or <w:tbl ...>...</w:tbl>.
  // Self-closing <w:p/> appears as section-property paragraphs; ignore those.
  const re = /<w:p\b[^>]*\/>|<w:p\b[^>]*>[\s\S]*?<\/w:p>|<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    const chunk = m[0];
    if (chunk.startsWith('<w:tbl')) yield { type: 'tbl', xml: chunk };
    else if (!chunk.endsWith('/>')) yield { type: 'p', xml: chunk };
  }
}

// Inspect <w:pPr> for a heading style.
function getHeadingLevel(pXml) {
  const m = pXml.match(/<w:pStyle\s+w:val="(Heading[123])"/);
  if (!m) return null;
  return { Heading1: HeadingLevel.HEADING_1, Heading2: HeadingLevel.HEADING_2, Heading3: HeadingLevel.HEADING_3 }[m[1]];
}

// Is this paragraph a bulleted list item?
function isBulletPara(pXml) {
  return /<w:numPr\b/.test(pXml);
}

// Extract run-level text from a <w:p> block.
// Returns an array of { text, bold, italic } pieces.
function extractRuns(pXml) {
  const runs = [];
  // Match <w:r>...</w:r> (skip <w:r/> self-closes which carry no text).
  const runRe = /<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g;
  let rm;
  while ((rm = runRe.exec(pXml)) !== null) {
    const inner = rm[1];
    const rPrMatch = inner.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/);
    const rPr = rPrMatch ? rPrMatch[1] : '';
    const bold = /<w:b(\s*\/?>|\s[^>]*?\/?>)/.test(rPr) && !/<w:b\s+w:val="0"/.test(rPr);
    const italic = /<w:i(\s*\/?>|\s[^>]*?\/?>)/.test(rPr) && !/<w:i\s+w:val="0"/.test(rPr);

    // Collect every <w:t> and <w:tab/> in order.
    const partRe = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/?>/g;
    let pm;
    let text = '';
    while ((pm = partRe.exec(inner)) !== null) {
      if (pm[0].startsWith('<w:tab')) text += '\t';
      else text += decodeXmlEntities(pm[1]);
    }
    if (text) runs.push({ text, bold, italic });
  }
  return runs;
}

// Convert a paragraph XML block into a docx-js Paragraph (or null if empty +
// not a heading — keeps the output tight).
function buildParagraph(pXml) {
  const headingLevel = getHeadingLevel(pXml);
  const bullet = isBulletPara(pXml);
  const runs = extractRuns(pXml);
  const isEmpty = runs.every(r => !r.text || /^\s*$/.test(r.text));
  if (isEmpty && !headingLevel) return null;

  const children = runs.map(r => new TextRun({
    text: r.text || '',
    bold: r.bold || (headingLevel ? true : false),
    italics: r.italic || false,
    font: FONT,
    size: headingLevel === HeadingLevel.HEADING_1 ? 36
        : headingLevel === HeadingLevel.HEADING_2 ? 30
        : headingLevel === HeadingLevel.HEADING_3 ? 26
        : SIZE,
  }));

  const opts = {
    spacing: { line: LINE, after: 120 },
    children,
  };
  if (headingLevel) {
    opts.heading = headingLevel;
    opts.spacing = {
      before: headingLevel === HeadingLevel.HEADING_1 ? 480 :
              headingLevel === HeadingLevel.HEADING_2 ? 360 : 260,
      after:  headingLevel === HeadingLevel.HEADING_1 ? 240 :
              headingLevel === HeadingLevel.HEADING_2 ? 180 : 140,
      line: LINE,
    };
  } else if (bullet) {
    opts.bullet = { level: 0 };
  } else {
    opts.alignment = AlignmentType.JUSTIFIED;
  }
  return new Paragraph(opts);
}

// ─── Table extraction ───────────────────────────────────────────────────────

function extractCellText(tcXml) {
  // Concatenate text from every paragraph inside the cell.
  const pieces = [];
  const pRe = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
  let pm;
  while ((pm = pRe.exec(tcXml)) !== null) {
    const runs = extractRuns(pm[0]);
    const t = runs.map(r => r.text).join('');
    if (t) pieces.push(t);
  }
  return pieces.join('\n');
}

function buildTable(tblXml) {
  const rowsXml = [...tblXml.matchAll(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g)].map(m => m[0]);
  if (rowsXml.length === 0) return null;

  // Number of columns = max <w:tc> count in any row.
  const colCount = Math.max(
    ...rowsXml.map(tr => (tr.match(/<w:tc\b/g) || []).length)
  );
  if (colCount === 0) return null;

  // Distribute content width (US Letter content = 9360; A4 content = 9026) evenly.
  // We use A4 content width to match the page size below.
  const TOTAL = 9026;
  const colWidth = Math.floor(TOTAL / colCount);
  const columnWidths = Array.from({ length: colCount }, () => colWidth);
  // Top up the last column with any remainder so the sum matches the table width exactly.
  columnWidths[colCount - 1] += TOTAL - columnWidths.reduce((a, b) => a + b, 0);

  const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: '888888' };
  const borders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

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
    // Pad missing columns (rare) so docx-js doesn't complain.
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

  return new Table({
    width: { size: TOTAL, type: WidthType.DXA },
    columnWidths,
    rows,
  });
}

// ─── Read input documents ───────────────────────────────────────────────────

async function loadDoc(filePath) {
  const buf = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file('word/document.xml').async('string');
  return xml;
}

async function blocksFromDoc(filePath) {
  const xml = await loadDoc(filePath);
  const blocks = [];
  for (const it of iterateBodyBlocks(xml)) {
    if (it.type === 'p') {
      const para = buildParagraph(it.xml);
      if (para) blocks.push(para);
    } else if (it.type === 'tbl') {
      const tbl = buildTable(it.xml);
      if (tbl) blocks.push(tbl);
    }
  }
  return blocks;
}

// ─── Main ───────────────────────────────────────────────────────────────────

const INPUT_FILES = [
  'C:\\Users\\HP\\Downloads\\Chapter Four.docx',
  'C:\\Users\\HP\\Downloads\\Chapter Fou1.docx',
  'C:\\Users\\HP\\Downloads\\Chapter Four and 5.docx',
  'C:\\Users\\HP\\Desktop\\Final Year Project\\Smart_Poultry\\docs\\SmartPoultry-Chapters-4-5.docx',
];

(async () => {
  const allChildren = [];
  for (let i = 0; i < INPUT_FILES.length; i++) {
    const f = INPUT_FILES[i];
    process.stdout.write(`reading ${path.basename(f)} ... `);
    const blocks = await blocksFromDoc(f);
    process.stdout.write(`${blocks.length} blocks\n`);

    // Insert a centred separator label + page break BEFORE every file after the first
    if (i > 0) {
      allChildren.push(new Paragraph({ children: [new PageBreak()] }));
    }
    // Label header for each source file (helps the user identify origins).
    allChildren.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 240, after: 240, line: LINE },
      children: [new TextRun({
        text: `— Source document: ${path.basename(f)} —`,
        italics: true,
        font: FONT,
        size: 22,
        color: '666666',
      })],
    }));
    allChildren.push(...blocks);
  }

  const doc = new Document({
    creator: 'Akpalolo Dennis Etornam',
    title: 'SmartPoultry — Combined Chapters 4 & 5',
    description: 'Combined documentation from all session outputs',
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
        levels: [{
          level: 0,
          format: 'bullet',
          text: '•',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      }],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 }, // A4 in DXA
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      headers: {
        default: new Header({ children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: 'SmartPoultry — Combined Chapters 4 & 5', italics: true, font: FONT, size: 20 })],
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
      children: allChildren,
    }],
  });

  const outPath = path.resolve(__dirname, 'SmartPoultry-Chapters-4-5-COMBINED.docx');
  const buf = await Packer.toBuffer(doc);
  fs.writeFileSync(outPath, buf);
  console.log(`wrote ${outPath} (${buf.length} bytes, ${allChildren.length} blocks)`);
})().catch(e => { console.error(e); process.exit(1); });
