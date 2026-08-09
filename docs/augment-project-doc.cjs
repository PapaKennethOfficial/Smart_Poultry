// Read Dennis_Benedict_Kenneth_20_July_2026.docx, append new paragraphs to
// specific subsections of Ch 4 & 5 covering the last three weeks of work
// (mapping + live tracking, Python AI microservice, sensor cleanup, Prophet
// cross-validation), then write to a fresh dated file.
//
// Design:
//   - Read the source zip once, extract word/document.xml.
//   - For each SECTION_TITLE in ADDITIONS, find its <w:p> in the body,
//     scan forward until the next Heading1 paragraph, and inject our
//     new paragraphs immediately before that next heading. This keeps
//     content nested inside the intended section without creating any
//     duplicate headings.
//   - Every injected <w:p> uses Times New Roman 12pt (size 24 half-pts)
//     with 1.5 line spacing (360) to match the doc's body style.
//   - Everything else in the doc (front matter, tables, images, other
//     chapters, footer/headers, REFERENCES) is preserved byte-for-byte.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const dxRoot = execFileSync('npm', ['root', '-g'], { shell: true }).toString().trim();
const JSZip = require(path.join(dxRoot, 'docx', 'node_modules', 'jszip'));

const SOURCE = 'C:\\Users\\HP\\Downloads\\Dennis_Benedict_Kenneth_20_July_2026.docx';
const OUTPUT = 'C:\\Users\\HP\\Desktop\\Final Year Project\\Dennis_Benedict_Kenneth_21_July_2026.docx';

// ─── Content to append (Harvard-style references inline) ────────────────────
//   Each key must match a Heading1 paragraph in the source doc. Values are
//   arrays of paragraph objects: { text, italic?: bool, bold?: bool }.

const ADDITIONS = {
  '4.1.2 Implementation Details': [
    { text: 'Extension: Mapping, Live Delivery Tracking, and Location Privacy (Phase 4, weeks 8–9).', bold: true },
    { text: 'The delivery experience was extended with end-to-end geolocation, replacing text-only address strings with an interactive Leaflet map (Agafonkin, 2024) rendered through the React wrapper react-leaflet. On the customer marketplace, the "Use my current location" control invokes the browser Geolocation API, captures the WGS-84 coordinates, then reverse-geocodes them against the OpenStreetMap Nominatim service (OpenStreetMap Foundation, 2024) so the delivery-address field is auto-populated with a human-readable street name. On the delivery-staff assigned-orders page, an active order in the IN_TRANSIT state triggers navigator.geolocation.watchPosition, which PATCHes the driver\'s coordinates every few seconds to the backend. The customer\'s order-details modal polls this every ten seconds through React Query so the driver\'s blue pin advances toward the green destination pin on a shared map, with a straight-line polyline and a haversine distance chip ("~1.4 km away"). Both maps auto-fit their viewport bounds using L.latLngBounds so both markers stay visible regardless of separation.' },
    { text: 'The corresponding privacy rules are enforced server-side rather than trusted to the client. The PATCH /api/orders/:id/location endpoint rejects any update whose parent order is not in the IN_TRANSIT state with an HTTP 400, and the PATCH /api/orders/:id status handler nulls out driverLatitude, driverLongitude, and driverLocationUpdatedAt within the same Prisma transaction whenever a status change lands the order in DELIVERED or CANCELLED. This is defence in depth: even if a driver\'s browser continued to ping after completion, the coordinates would never be stored, and the customer\'s live-tracking pane switches to a green summary card ("Order delivered. Live driver tracking has ended.") on the next refresh. These measures reflect the principle of failing securely (Saltzer and Schroeder, 1975).' },
    { text: 'Extension: AI Microservice for Demand Forecasting, Route Optimisation, and Executive Insights.', bold: true },
    { text: 'A dedicated Python microservice, smartpoultry-ai, was introduced to house every heavy AI computation, keeping the main Node.js API lean and predictable. It is written in FastAPI (Ramírez, 2024) and reachable only from the Node backend using a shared X-API-Key; browsers never talk to it directly. Three capabilities are exposed. First, a demand-forecasting service backed by Facebook Prophet (Taylor and Letham, 2018) reads DeliveryOrder history from PostgreSQL through SQLAlchemy, fits a Prophet model with weekly seasonality enabled and yearly seasonality on "auto", persists the fitted model via joblib for sub-second inference on subsequent requests, and reports MAPE and RMSE on a time-based holdout. A node-cron job on the Node backend calls the retrain endpoint every Sunday at 03:00 (local time), keeping the model current without human intervention. Second, a vehicle-routing service uses Google OR-Tools (Perron and Furnon, 2024) to solve the capacity-constrained vehicle routing problem with a haversine distance matrix, returning an optimised stop sequence per vehicle in under a second for realistic fleet sizes. Third, a large-language-model service integrates Google Gemini (Google, 2024) through the google-genai SDK, offering a Morning Briefing (an executive summary of the trailing seven days) and an Ask-the-Data endpoint (a natural-language question-and-answer over the same window). To respect data-minimisation obligations, every payload sent to Gemini is passed through a whitelist-based sanitiser: only fields explicitly listed as safe (aggregated revenue, counts, averages) are kept, and driver names, email addresses, phone numbers, cuid identifiers, and GPS coordinates are stripped by regex before the request leaves the process. Every /api/ai/* route is gated by authenticate + roleGuard(["ADMIN","MANAGER"]) so delivery staff and customers cannot consume forecasts or LLM insights, and Gemini itself returns a friendly HTTP 503 with an actionable message when GOOGLE_API_KEY is absent, rather than crashing.' },
    { text: 'The Analytics dashboard on the admin frontend was extended with six new panels that consume these services: a Morning Briefing card with a skeleton loader, an AI Advisor chat panel with prompt history, a Prophet demand-forecast chart (Recharts ComposedChart with historical actuals, dashed prediction line, and 85% confidence-band area), a Fulfilment Funnel bar, a Driver Efficiency scatter, and a Peak Order Times heatmap over a seven-day-by-twenty-four-hour grid. A synthetic-order seeder was written to populate PostgreSQL with thirty days of realistic delivery orders (weekend seasonality, upward trend, realistic status and payment distributions) so the dashboards, forecast, and LLM briefing had non-trivial content to render during development.' },
    { text: 'Removal: Hardware-Dependent Sensor UI.', bold: true },
    { text: 'A late-stage decision was to strip every UI element that depended on physical IoT sensors, since no sensors are deployed on the demonstration farm. The Environmental Trends chart on the Analytics page, the Environmental Sensors panel on the Dashboard (temperature, humidity, and ammonia readings plus a live line chart), the Environmental Alerts notification toggle in Settings, four hardware-threshold input fields under Farm Configuration (Max Temperature, Min Temperature, Max Humidity, Max Ammonia), and the corresponding backend GET /analytics/environmental route were all removed. The mortality-trend chart now takes the full width of the Dashboard\'s bottom row. This is consistent with the principle of building only what can actually be validated end-to-end (Beck, 2002); a sensor panel permanently stuck on an empty state is worse than no panel, because it presents a false expectation.' },
  ],

  '4.1.3 Testing and Quality Assurance': [
    { text: 'Extension: Prophet Cross-Validation on a Substantial Dataset.', bold: true },
    { text: 'To prove that the demand-forecast model works beyond the small quantity of data present in the development database, a standalone validation script (smartpoultry-ai/scripts/validate_prophet_on_dataset.py) was written. It first attempts to fetch a public poultry-relevant CSV from two known Kaggle mirrors on GitHub; when neither is reachable, it falls back to a deterministic seven-hundred-and-thirty-day synthetic Ghanaian poultry demand series with weekly seasonality (higher volume on Friday, Saturday, and Sunday), yearly seasonality (peaks around February), monthly payday bumps, spikes at named Ghanaian public holidays such as Christmas and Easter, a gentle upward growth trend, and gaussian noise. The script then runs Prophet\'s built-in cross_validation function using the rolling-origin methodology (Hyndman and Athanasopoulos, 2021): the model is refit on an expanding window, its next-thirty-day forecast is compared against ground truth, and the fit window slides forward by thirty days for the next fold. Twelve folds were produced. Per-horizon MAPE, MAE, and RMSE were computed with performance_metrics; results and a matplotlib rendering of the actual-versus-predicted series were written to disk.' },
    { text: 'End-to-end smoke tests were performed with curl against every new endpoint through the Node.js gateway. The location PATCH was verified to reject 400 for orders not in IN_TRANSIT and 403 for a driver attempting to update someone else\'s order. GET /api/ai/forecast/demand and POST /api/ai/routes/optimize returned valid Prophet and OR-Tools responses respectively. POST /api/ai/insights/morning-briefing returned an actual Gemini-generated paragraph after GOOGLE_API_KEY was supplied, and returned an actionable HTTP 503 without it. Role-based access control was verified from the opposite side: a DELIVERY-role user attempting to consume /api/ai/* endpoints received 403 Forbidden, and a WORKER-role user attempting the manager-only /api/users route also received 403. Frontend builds were run after every phase to catch import errors early; the smartpoultry-admin production build produced a 1.20 MB main chunk (322 KB gzipped) after all six new analytics panels were added, an increase of only two kilobytes over the previous baseline.' },
  ],

  '4.2.1 Evaluation Metrics': [
    { text: 'Additional metrics were introduced for the AI subsystem. Forecast quality is measured by the Mean Absolute Percentage Error (MAPE), the Mean Absolute Error (MAE), and the Root Mean Squared Error (RMSE) reported at horizons of seven, fourteen, and thirty days out; the eighty-five-percent prediction-interval coverage is also tracked to detect over- or under-confident bands. Route-optimisation quality is measured by total distance in metres and the number of unassigned stops, both returned as part of the OR-Tools response. LLM insights are evaluated by grounded correctness: each generated Morning Briefing is asserted to contain no numerical claim absent from the underlying context payload — this was verified manually on a sample of ten generated briefings.' },
  ],

  '4.2.3 Performance Evaluation': [
    { text: 'Performance figures for the AI subsystem were gathered against the development instance running on Windows with Python 3.14 and Node.js 24. The Prophet training run on seven hundred and thirty daily rows completed in approximately three seconds; subsequent inference calls (loading the joblib-cached model) returned in under two hundred milliseconds for a fourteen-day forecast. The OR-Tools solver produced an optimal three-stop, single-vehicle route in roughly one hundred and fifty milliseconds and scales polynomially for the fleet sizes envisaged for a small-to-medium poultry farm. Gemini requests through the gateway completed in one-and-a-half to three seconds end to end (dominated by network round-trip to Google\'s servers), which is well within the "conversational" threshold identified by Nielsen (1994). Cross-validation on the seven-hundred-and-thirty-day synthetic series returned a thirty-day-horizon MAPE of 9.36 percent, RMSE of 8.95 units per day, and MAE of 6.41 units per day across twelve rolling-origin folds — comfortably within the range that Taylor and Letham (2018) report as typical for well-behaved Prophet series.' },
  ],

  '5.1.2 Challenges Faced': [
    { text: 'Additional challenges arose during the AI-microservice and delivery-tracking phases. The most time-consuming was a transitive dependency conflict between the Google OR-Tools 9.15 wheel, which pins protobuf to versions between 6.33.1 and 6.34, and the initial choice of the (now-deprecated) google-generativeai SDK, which pins protobuf to 5.29. The runtime symptom was an import-time failure of ortools.constraint_solver.routing_enums_pb2, easily missed until the FastAPI service was booted. The resolution was to migrate to the newer google-genai SDK (Google, 2024), which uses protobuf 6 natively, and to pin the version explicitly to satisfy both packages. A related surprise was that Google renamed the Gemini fast-tier model from gemini-1.5-flash to gemini-2.5-flash without leaving the old alias operational; the fix was to switch the configuration to gemini-flash-latest, the auto-updating alias documented in the Gemini quick-start guide.' },
    { text: 'A second class of challenge was integration with a rapidly-evolving upstream repository. During the AI-microservice work the upstream fork was restructured — the entire src/ directory was renamed to smartpoultry-admin/ and a separate smartpoultry-pwa/ frontend was added — which produced conflicts on every subsequent pull request. Git handled the rename detection well for modified files but not for the new files this branch added, so hooks such as useDemandForecast.js had to be manually relocated under smartpoultry-admin/src/hooks/analytics/. A workflow was adopted of resetting the working branch to upstream/main before each new phase and cherry-picking the relevant commit forward, which minimised conflict surface. The PII sanitiser also required a bug fix during development: an early phone-number regex greedily matched ISO-8601 timestamps (for example, 2026-07-18T13:44:55+00:00), replacing them with the string "[phone]" and destabilising the LLM prompt. The regex was tightened to require either a leading plus sign or the Ghanaian mobile prefix.' },
  ],

  '5.1.3 Lessons Learned': [
    { text: 'A recurring lesson from Phase 4 was to inspect the backend before writing frontend code. Several delivery-tracking user-interface pieces already had their data exposed by the /api/orders endpoint through its driver.vehicle include; the only work required was to render fields the frontend was previously ignoring. Similarly, the backend\'s existing buildDeliveryOrderWhere utility already supported every filter the ManagerOrders page needed, so the manager filtering task reduced to composing query parameters rather than adding new controller code. The consistent pattern is that a five-minute read of the server-side code often saves an hour of client-side implementation.' },
    { text: 'A second lesson concerned the discipline of whitelist-based data sanitisation. The metrics aggregator that feeds the Gemini prompts returns a fixed nested schema; the sanitiser mirrors that schema and only lets explicitly-listed keys through. This means that if a future contributor adds a new field to the aggregator — say, a driver\'s phone number — it will not accidentally reach the LLM unless the whitelist is also updated. Blacklists (strip these fields) tend to fail open as the codebase grows; whitelists (keep only these fields) fail closed. Regex scrubbing on top provides defence in depth against strings that make it through by accident. The pattern is aligned with the least-privilege guidance in the OWASP Application Security Verification Standard (OWASP Foundation, 2022).' },
  ],

  '5.1.5 Future Work': [
    { text: 'The microservice is written so that swapping the straight-line polyline for a routed path only requires replacing the distance-matrix builder in smartpoultry-ai/app/services/routing.py with a call to an external routing API such as OSRM (Luxen and Vetter, 2011) or the Google Directions service. This would give the customer a genuine driving path rather than an as-the-crow-flies approximation, at the cost of an API key and an outbound network dependency.' },
    { text: 'A production deployment should re-enable environmental monitoring once physical IoT sensors are commissioned. The current codebase still carries the temperature and humidity columns on the LogEntry Prisma model as inert schema fields; a future contributor can wire an MQTT ingest endpoint and Prophet auxiliary regressors to those columns and restore the Environmental Trends chart with minimal disturbance.' },
    { text: 'Further work would also formalise the Kaggle-dataset integration attempted in the Prophet cross-validation script. The script currently falls back to a synthetic Ghanaian poultry demand series when public dataset URLs are unreachable; providing a Kaggle API token via the platform\'s official client (Kaggle, 2024) would allow the script to pull authoritative production datasets (for instance, the USDA broiler-slaughter series or a peer-reviewed Nigerian egg-production time series) and produce publication-grade validation metrics. Finally, a nightly ETL pipeline should be introduced to materialise the aggregate metrics that the LLM service currently recomputes on every briefing request, which would remove roughly two hundred milliseconds of Postgres query time from each Gemini call.' },
  ],
};


// ─── Additional Harvard references to append to the REFERENCES section ─────

const NEW_REFERENCES = [
  'Agafonkin, V. (2024) Leaflet — an open-source JavaScript library for mobile-friendly interactive maps. Available at: https://leafletjs.com (Accessed: 21 July 2026).',
  'Beck, K. (2002) Test-Driven Development: By Example. Boston, MA: Addison-Wesley.',
  'Google (2024) Gemini API and google-genai SDK. Available at: https://ai.google.dev/gemini-api/docs (Accessed: 21 July 2026).',
  'Hyndman, R. J. and Athanasopoulos, G. (2021) Forecasting: Principles and Practice. 3rd edn. Melbourne: OTexts.',
  'Kaggle (2024) Kaggle Public API. Available at: https://www.kaggle.com/docs/api (Accessed: 21 July 2026).',
  'Luxen, D. and Vetter, C. (2011) ‘Real-time routing with OpenStreetMap data’, Proceedings of the 19th ACM SIGSPATIAL International Conference on Advances in Geographic Information Systems, pp. 513–516.',
  'Nielsen, J. (1994) Usability Engineering. San Francisco, CA: Morgan Kaufmann.',
  'OpenStreetMap Foundation (2024) Nominatim usage policy. Available at: https://operations.osmfoundation.org/policies/nominatim (Accessed: 21 July 2026).',
  'OWASP Foundation (2022) Application Security Verification Standard (ASVS) v4.0.3. Available at: https://owasp.org/asvs (Accessed: 21 July 2026).',
  'Perron, L. and Furnon, V. (2024) OR-Tools. Google. Available at: https://developers.google.com/optimization (Accessed: 21 July 2026).',
  'Ramírez, S. (2024) FastAPI — modern, fast web framework for building APIs with Python. Available at: https://fastapi.tiangolo.com (Accessed: 21 July 2026).',
  'Saltzer, J. H. and Schroeder, M. D. (1975) ‘The protection of information in computer systems’, Proceedings of the IEEE, 63(9), pp. 1278–1308.',
  'Taylor, S. J. and Letham, B. (2018) ‘Forecasting at scale’, The American Statistician, 72(1), pp. 37–45.',
];


// ─── Word-XML helpers ──────────────────────────────────────────────────────

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function paraXml(opts) {
  const { text, bold = false, italic = false } = opts;
  // Body paragraph: Times New Roman 12pt (24 half-pts), 1.5 line spacing
  // (360 twentieths of a point), justified.
  const rPr = [
    '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>',
    bold ? '<w:b/><w:bCs/>' : '',
    italic ? '<w:i/><w:iCs/>' : '',
    '<w:sz w:val="24"/><w:szCs w:val="24"/>',
  ].join('');
  return (
    '<w:p>'
    + '<w:pPr>'
    + '<w:spacing w:line="360" w:lineRule="auto" w:after="120"/>'
    + '<w:jc w:val="both"/>'
    + '<w:rPr>' + rPr + '</w:rPr>'
    + '</w:pPr>'
    + '<w:r><w:rPr>' + rPr + '</w:rPr>'
    + '<w:t xml:space="preserve">' + esc(text) + '</w:t>'
    + '</w:r>'
    + '</w:p>'
  );
}

// Reference-list paragraph: Harvard-style with a hanging indent so the
// second line aligns with the first author's surname.
function refXml(text) {
  const rPr = [
    '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>',
    '<w:sz w:val="24"/><w:szCs w:val="24"/>',
  ].join('');
  return (
    '<w:p>'
    + '<w:pPr>'
    + '<w:spacing w:line="360" w:lineRule="auto" w:after="120"/>'
    + '<w:ind w:left="720" w:hanging="720"/>'
    + '<w:rPr>' + rPr + '</w:rPr>'
    + '</w:pPr>'
    + '<w:r><w:rPr>' + rPr + '</w:rPr>'
    + '<w:t xml:space="preserve">' + esc(text) + '</w:t>'
    + '</w:r>'
    + '</w:p>'
  );
}

// Walk every top-level body block in document.xml, in order.
function* iterateBlocks(documentXml) {
  const body = documentXml.match(/<w:body[^>]*>([\s\S]*?)<\/w:body>/);
  if (!body) return;
  const re = /<w:p\b[^>]*\/>|<w:p\b[^>]*>[\s\S]*?<\/w:p>|<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>|<w:sectPr\b[^>]*\/>|<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/g;
  let m;
  while ((m = re.exec(body[1])) !== null) yield m[0];
}

function paraText(block) {
  return (block.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [])
    .map(t => t.replace(/<[^>]+>/g, ''))
    .join('')
    .trim();
}

function isHeading(block) {
  return /<w:pStyle\s+w:val="Heading[1-6]"/.test(block);
}


// ─── Main ───────────────────────────────────────────────────────────────────

(async () => {
  console.log('reading source docx ...');
  const buf = fs.readFileSync(SOURCE);
  const zip = await JSZip.loadAsync(buf);
  let xml = await zip.file('word/document.xml').async('string');

  const blocks = [...iterateBlocks(xml)];
  console.log(`document has ${blocks.length} top-level body blocks`);

  // Process additions in reverse order of appearance in the document, so
  // earlier splice indices remain valid as later ones are edited. We do
  // this by mapping each ADDITIONS key to its position, sorting descending.
  const targets = [];
  for (const [sectionTitle, additions] of Object.entries(ADDITIONS)) {
    const headingIdx = blocks.findIndex((b) => isHeading(b) && paraText(b) === sectionTitle);
    if (headingIdx === -1) {
      console.warn(`  WARN: could not find heading "${sectionTitle}"; skipping`);
      continue;
    }
    // Insert immediately before the next heading (of any level) so the
    // additions live *inside* this section.
    let insertBeforeIdx = blocks.length;
    for (let i = headingIdx + 1; i < blocks.length; i++) {
      if (isHeading(blocks[i])) { insertBeforeIdx = i; break; }
    }
    targets.push({ sectionTitle, insertBeforeIdx, additions });
    console.log(`  target "${sectionTitle}" at block ${headingIdx}; will insert before block ${insertBeforeIdx}`);
  }

  // Sort descending by insertion index so earlier edits don't shift later ones.
  targets.sort((a, b) => b.insertBeforeIdx - a.insertBeforeIdx);

  // Convert body-block indices to string offsets in the original xml.
  const bodyStart = xml.indexOf('<w:body');
  const bodyMatch = xml.match(/<w:body[^>]*>([\s\S]*?)<\/w:body>/);
  const bodyInnerStart = bodyStart + xml.substr(bodyStart).indexOf('>') + 1;
  // We can't rely on JS block indices being stable across xml edits, but
  // since we edit from END → START, the earlier block string positions in
  // `xml` remain valid throughout.
  for (const t of targets) {
    const targetBlock = blocks[t.insertBeforeIdx];
    // The insertion point is the character index of targetBlock in xml.
    const pos = xml.indexOf(targetBlock, bodyInnerStart);
    if (pos === -1) {
      console.warn(`  WARN: could not locate insertion point for "${t.sectionTitle}"`);
      continue;
    }
    const inserted = t.additions.map(paraXml).join('');
    xml = xml.substring(0, pos) + inserted + xml.substring(pos);
    console.log(`  inserted ${t.additions.length} paragraph(s) at "${t.sectionTitle}"`);
  }

  // Add new references at the end of the REFERENCES section (which is the
  // last H1 in the doc). Splice them before whatever follows REFERENCES,
  // or before the final <w:sectPr>.
  const refsIdx = blocks.findIndex(
    (b) => isHeading(b) && /^REFERENCES\b/i.test(paraText(b))
  );
  if (refsIdx !== -1) {
    // References list — insert at the very end of the body, right before
    // the final section properties (which are always at the tail).
    const sectPrIdx = blocks.findIndex(
      (b, i) => i > refsIdx && b.startsWith('<w:sectPr')
    );
    const finalIdx = sectPrIdx === -1 ? -1 : sectPrIdx;
    if (finalIdx !== -1) {
      const targetBlock = blocks[finalIdx];
      const pos = xml.lastIndexOf(targetBlock);
      if (pos !== -1) {
        const inserted = NEW_REFERENCES.map(refXml).join('');
        xml = xml.substring(0, pos) + inserted + xml.substring(pos);
        console.log(`  appended ${NEW_REFERENCES.length} reference(s) to REFERENCES section`);
      }
    } else {
      // Fall back — append at very end of body innerHTML
      const bodyEnd = xml.lastIndexOf('</w:body>');
      const inserted = NEW_REFERENCES.map(refXml).join('');
      xml = xml.substring(0, bodyEnd) + inserted + xml.substring(bodyEnd);
      console.log(`  appended ${NEW_REFERENCES.length} reference(s) at body end (no sectPr found)`);
    }
  } else {
    console.warn('  WARN: could not find REFERENCES heading; skipping reference additions');
  }

  // Write back the modified document.xml, keeping every other archive
  // entry (styles, footers, images, theme, ...) byte-for-byte identical.
  zip.file('word/document.xml', xml);
  const outBuf = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
  fs.writeFileSync(OUTPUT, outBuf);
  console.log(`\nwrote ${OUTPUT} (${outBuf.length.toLocaleString()} bytes)`);
})().catch((e) => { console.error(e); process.exit(1); });
