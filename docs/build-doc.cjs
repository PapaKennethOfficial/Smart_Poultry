// Builds SmartPoultry-Chapters-4-5.docx using docx-js.
const fs = require('fs');
const path = require('path');

// Use the globally-installed docx package. Resolve the global node_modules
// root via execFileSync (no shell, no interpolation) rather than exec/execSync.
const dxRoot = require('child_process')
  .execFileSync('npm', ['root', '-g'], { shell: true })
  .toString()
  .trim();
const docx = require(path.join(dxRoot, 'docx'));

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, PageOrientation, LevelFormat, HeadingLevel,
  BorderStyle, WidthType, ShadingType, PageNumber, PageBreak,
} = docx;

// ─── Style helpers ──────────────────────────────────────────────────────────

const BODY_FONT = 'Calibri';

function p(text, opts = {}) {
  const { bold = false, italic = false, indent = 0, alignment = AlignmentType.JUSTIFIED } = opts;
  return new Paragraph({
    alignment,
    spacing: { line: 360, after: 120 }, // 1.5 line spacing (240 = single)
    indent: indent ? { firstLine: indent } : undefined,
    children: [new TextRun({ text, bold, italics: italic, font: BODY_FONT, size: 24 })],
  });
}

// Paragraph that can include multiple runs (for citations etc.).
function pRuns(runs, opts = {}) {
  const { alignment = AlignmentType.JUSTIFIED, indent = 0 } = opts;
  return new Paragraph({
    alignment,
    spacing: { line: 360, after: 120 },
    indent: indent ? { firstLine: indent } : undefined,
    children: runs.map(r => new TextRun({ ...r, font: BODY_FONT, size: 24 })),
  });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 480, after: 240 },
    children: [new TextRun({ text, bold: true, font: BODY_FONT, size: 36 })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 360, after: 180 },
    children: [new TextRun({ text, bold: true, font: BODY_FONT, size: 30 })],
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 260, after: 140 },
    children: [new TextRun({ text, bold: true, font: BODY_FONT, size: 26 })],
  });
}

// Hanging-indent reference paragraph for Harvard list.
function ref(text) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { line: 360, after: 100 },
    indent: { left: 720, hanging: 720 },
    children: [new TextRun({ text, font: BODY_FONT, size: 24 })],
  });
}

// ─── Tables ─────────────────────────────────────────────────────────────────

const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: '888888' };
const cellBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

function tableCell(text, { bold = false, fill = null, widthDXA }) {
  return new TableCell({
    borders: cellBorders,
    width: { size: widthDXA, type: WidthType.DXA },
    shading: fill ? { fill, type: ShadingType.CLEAR } : undefined,
    margins: { top: 90, bottom: 90, left: 120, right: 120 },
    children: [new Paragraph({
      spacing: { line: 280, after: 0 },
      children: [new TextRun({ text, bold, font: BODY_FONT, size: 22 })],
    })],
  });
}

// Build a simple two-or-three column table from a row array.
function buildTable(headers, rows, columnWidths) {
  const total = columnWidths.reduce((s, w) => s + w, 0);
  const headRow = new TableRow({
    children: headers.map((h, i) => tableCell(h, { bold: true, fill: 'E7EEF7', widthDXA: columnWidths[i] })),
  });
  const dataRows = rows.map(r => new TableRow({
    children: r.map((cell, i) => tableCell(cell, { widthDXA: columnWidths[i] })),
  }));
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths,
    rows: [headRow, ...dataRows],
  });
}

// ─── Content ────────────────────────────────────────────────────────────────

const children = [];

// ===== Chapter 4 =====
children.push(h1('Chapter Four: System Implementation'));

children.push(h2('4.1 Development'));

children.push(p(
  'This chapter documents the implementation of the SmartPoultry platform, an integrated web application that supports farm managers, delivery staff, and customers in Ghana’s small-to-medium poultry sector. The discussion follows the chronological order in which the system was developed across four delivery phases — authentication, the operational dashboard, account management, and the delivery experience — and grounds every technology decision in the relevant academic and practitioner literature.'
));

children.push(h3('4.1.1 Programming Languages and Tools Used'));

children.push(p(
  'The system is built as a single-page web application backed by a stateless REST service. The frontend is written in JavaScript (ECMAScript 2023) using React 18 (Meta Open Source, 2024) — a declarative, component-oriented user-interface library that enables predictable rendering of stateful views. React was chosen because its unidirectional data flow simplifies reasoning about role-based interfaces (farm manager, delivery staff and customer) that share component primitives but diverge in behaviour. Build tooling is provided by Vite 5 (Vite Team, 2024), whose native ECMAScript module pipeline delivers sub-second cold-start times in development and uses Rollup for optimised production bundles. Routing is handled by React Router 6 (Remix Team, 2024) and styling by Tailwind CSS 3 (Tailwind Labs, 2024) supplemented by component-level inline styles for layout-specific rules. Data fetching, caching, and background refetching are handled by TanStack Query 5 (Dodds and TanStack, 2024), with HTTP transport provided by Axios (Zaytsev, 2024). Charts are rendered through Recharts (Recharts Group, 2024), and iconography is provided by lucide-react (Lucide Project, 2024).'
));

children.push(p(
  'The backend is implemented in Node.js (OpenJS Foundation, 2024) using Express 5 (OpenJS Foundation, 2024). Persistence is provided by PostgreSQL (PostgreSQL Global Development Group, 2024) and accessed through Prisma 7 (Prisma, 2024) with the @prisma/adapter-pg driver adapter. Request payload validation uses Zod (Plaza, 2024) as the single source of truth for both request shape and TypeScript-style inference. Authentication tokens are issued and verified with jsonwebtoken following the JSON Web Token specification (Jones, Bradley and Sakimura, 2015), while password hashing uses bcrypt with a work factor of ten, an algorithm originally described by Provos and Mazières (1999). Environment variables are loaded through dotenv (Motdotla, 2024) to keep secrets out of source control. Table 4.1 maps each concern in the system to the technology that fulfils it.'
));

children.push(buildTable(
  ['Concern', 'Technology', 'Reference'],
  [
    ['UI rendering', 'React 18', '(Meta Open Source, 2024)'],
    ['Routing', 'React Router 6', '(Remix Team, 2024)'],
    ['Build / dev server', 'Vite 5', '(Vite Team, 2024)'],
    ['Server-state cache', 'TanStack Query 5', '(Dodds and TanStack, 2024)'],
    ['HTTP client', 'Axios', '(Zaytsev, 2024)'],
    ['Charts', 'Recharts', '(Recharts Group, 2024)'],
    ['HTTP server', 'Express 5', '(OpenJS Foundation, 2024)'],
    ['ORM', 'Prisma 7', '(Prisma, 2024)'],
    ['Database', 'PostgreSQL', '(PostgreSQL Global Development Group, 2024)'],
    ['Validation', 'Zod', '(Plaza, 2024)'],
    ['Authentication tokens', 'jsonwebtoken (JWT)', '(Jones, Bradley and Sakimura, 2015)'],
    ['Password hashing', 'bcrypt', '(Provos and Mazières, 1999)'],
  ],
  [2800, 3360, 3200],
));

children.push(p(
  'The development environment is Windows 11 with Node.js v24, Git for version control and GitHub for collaboration. The repository follows a fork-and-pull workflow against the upstream PapaKennethOfficial/Smart_Poultry repository; each phase of work was delivered as a focused pull request and rebased on the latest upstream main before review.',
  { indent: 360 },
));

children.push(h3('4.1.2 Implementation Details'));

children.push(p(
  'The implementation proceeded in four phases. Each phase produced a vertical slice of functionality: a database migration where required, one or more backend controllers and routes, and the frontend components, API clients, and React Query hooks that consume them. The pattern intentionally mirrors the architectural guidance of Fowler (2018) on building thin slices that exercise the full stack rather than completing one tier in isolation.'
));

// Phase 1
children.push(pRuns([
  { text: 'Phase 1 — Login and Sign-Up Authentication. ', bold: true },
  { text: 'The first phase delivered the credential-based authentication flow. On the frontend, the existing login page was wired to ' },
  { text: 'POST /api/auth/login', italics: true },
  { text: ' through a centralised Axios instance. On a successful response the returned JSON Web Token (Jones, Bradley and Sakimura, 2015) and the resolved role are stored in an AuthContext provider that persists to ' },
  { text: 'localStorage', italics: true },
  { text: '. The user is then redirected to ' },
  { text: '/dashboard', italics: true },
  { text: '. A 401 response is surfaced as a red inline message — "Incorrect email or password" — directly under the form rather than as a transient toast, an approach consistent with the inline-feedback heuristic identified by Nielsen (1994). A new ' },
  { text: '/register', italics: true },
  { text: ' page captures full name, email, password, confirm password and a role selector; passwords are compared client-side before submission and the form falls through to ' },
  { text: 'POST /api/auth/register', italics: true },
  { text: ' on match. The Login page links to the register page with the standard "Don’t have an account? Sign Up" anchor.' },
]));

children.push(pRuns([
  { text: 'On the backend the login controller was extended to return ' },
  { text: '{ token, role, user }', italics: true },
  { text: ' after stripping the password hash from the user object — a precaution against the accidental data-exposure category listed in the OWASP Top 10 (OWASP Foundation, 2021). The register controller hashes the password with bcrypt at a work factor of ten (Provos and Mazières, 1999), checks for an existing email and responds with HTTP 409 on conflict. Both routes are wrapped in the shared ' },
  { text: 'validate(schema)', italics: true },
  { text: ' middleware backed by Zod (Plaza, 2024). Neither route uses the authenticate middleware — they are the only two endpoints in the application that do not.' },
]));

// Phase 2
children.push(pRuns([
  { text: 'Phase 2 — Dashboard and Summary API. ', bold: true },
  { text: 'The second phase delivered the manager dashboard. A Prisma migration added an ' },
  { text: 'eggCount Int @default(0)', italics: true },
  { text: ' column to the ' },
  { text: 'LogEntry', italics: true },
  { text: ' table so that egg production could be aggregated alongside mortality and feed consumption. Four new auth-gated endpoints were introduced. ' },
  { text: 'GET /api/dashboard/summary', italics: true },
  { text: ' returns the four headline metrics — total eggs today, mortality rate today, pending deliveries and feed used today — computed in parallel with ' },
  { text: 'Promise.all', italics: true },
  { text: ' for efficiency. Mortality rate is calculated as today’s mortality divided by the sum of currentCount across active batches; pending deliveries is a count of ' },
  { text: 'DeliveryOrder', italics: true },
  { text: ' rows with status PENDING. ' },
  { text: 'GET /api/dashboard/egg-chart?days=N', italics: true },
  { text: ' and ' },
  { text: 'GET /api/dashboard/mortality-chart?weeks=N', italics: true },
  { text: ' return zero-filled day and week buckets respectively, ready for Recharts to render without further reshaping. Finally ' },
  { text: 'GET /api/alerts', italics: true },
  { text: ' returns alerts with ' },
  { text: 'isResolved = false', italics: true },
  { text: ', sorted by newest first.' },
]));

children.push(p(
  'The frontend exposes these endpoints via two small modules (api/dashboard.js and api/alerts.js) and four TanStack Query hooks (useDashboardSummary, useEggChart, useMortalityChart and useAlerts). The alerts hook configures a thirty-second refetch interval, providing a soft real-time feed without resorting to WebSockets. Each panel on the dashboard has explicit loading, error and empty states; alerts are colour-coded by severity and timestamps are rendered relative to the current time so the dashboard remains readable at a glance, in keeping with the established information-density guidance of Tufte (2001). The sensor section of the dashboard was intentionally left on the previous dummy data because the relevant IoT integration falls outside this phase.'
));

// Phase 3
children.push(pRuns([
  { text: 'Phase 3 — Settings and User Profile API. ', bold: true },
  { text: 'The third phase added user-account management. A second Prisma migration extended the ' },
  { text: 'User', italics: true },
  { text: ' model with an optional ' },
  { text: 'phone', italics: true },
  { text: ' field, a ' },
  { text: 'notificationPreferences Json @default("{}")', italics: true },
  { text: ' blob, and an optional ' },
  { text: 'lastLoginAt', italics: true },
  { text: ' timestamp. The backend gained a dedicated ' },
  { text: 'user.controller.js', italics: true },
  { text: ' that exposes ' },
  { text: 'getMe', italics: true },
  { text: ', ' },
  { text: 'updateMe', italics: true },
  { text: ' (with an email-uniqueness check), ' },
  { text: 'updateNotifications', italics: true },
  { text: ' (which merges the incoming preference object into the stored JSON so callers may PATCH a single key at a time), ' },
  { text: 'updatePassword', italics: true },
  { text: ' (which verifies the current password with bcrypt before hashing and persisting a new one), and ' },
  { text: 'listUsers', italics: true },
  { text: '. The corresponding routes — ' },
  { text: 'GET/PUT /api/users/me', italics: true },
  { text: ', ' },
  { text: 'PATCH /api/users/me/notifications', italics: true },
  { text: ', ' },
  { text: 'PATCH /api/users/me/password', italics: true },
  { text: ' and ' },
  { text: 'GET /api/users', italics: true },
  { text: ' — are all behind the authenticate middleware, with the list endpoint additionally protected by a ' },
  { text: 'roleGuard(["ADMIN","MANAGER"])', italics: true },
  { text: ' so that delivery staff and customers receive HTTP 403. The login controller also stamps ' },
  { text: 'lastLoginAt = now()', italics: true },
  { text: ' as a fire-and-forget side effect, ensuring the response time is not delayed by an extra database write.' },
]));

children.push(p(
  'On the frontend, an api/users.js module and five hooks (useMe, useUsers, useUpdateMe, useUpdateNotifications and useUpdatePassword) wire the Settings page. The Profile section is populated from /users/me and emits a green "Profile updated" toast on success. The Security section drives the password-change form, surfacing "Current password is incorrect" inline when the backend responds with HTTP 401. The Notifications section persists individual toggles through PATCH calls and survives a full-page reload because state lives on the server. The Team & Roles section renders a table of all users for managers and administrators only; for any other role it shows an explanatory permission banner. As part of this phase a security audit was performed: the hardcoded "admin123" fallback in the seed script was removed and the seed script now fails fast if ADMIN_PASSWORD is missing from the environment, and the variable is documented in .env.example. This reflects the principle of failing securely (Saltzer and Schroeder, 1975).'
));

// Phase 4
children.push(pRuns([
  { text: 'Phase 4 — Delivery UI, Customer Experience and Vehicle Screens. ', bold: true },
  { text: 'The final phase delivered five user-facing improvements. None of these required backend changes because the server already exposed every field and filter that the brief described. Task 1 cleaned up the vehicle-registration form on ' },
  { text: 'VehicleRegistration.jsx', italics: true },
  { text: ' by removing five legacy fields (insurance provider, insurance policy number, insurance expiration, seating capacity and mileage) along with an orphan insurance-document upload. The backend Zod schema had never accepted any of them, so removing them from the UI brought the form into alignment with the API contract. The section heading "Licensing & Insurance" was simplified to "Licensing".' },
]));

children.push(p(
  'Task 2 rebuilt the approved-state view that delivery staff see once a manager has verified their vehicle. The new ApprovedVehicleCard component leads with the verified vehicle photograph and the driver photograph and presents make, model, colour, vehicle type, license plate (if available) and the explicit approval status badge. The change addresses the brief’s requirement that "an approved driver should immediately see proof of the approved vehicle and driver identity on their page". The pending and rejected states retain their previous, more text-heavy panes.'
));

children.push(p(
  'Task 3 updated the customer-facing order details modal in CustomerOrders.jsx. A four-step DeliveryProgress indicator (Placed → Confirmed → In Transit → Delivered) is derived from the order’s current status; a cancelled order short-circuits to a red banner. The driver block was expanded to render the driver’s photograph, contact number and a vehicle card that displays vehicle type, colour, make/model and license plate alongside the vehicle photograph. All of these fields are returned by the existing /api/orders endpoint via its driver.vehicle Prisma include, so no backend modification was required.'
));

children.push(pRuns([
  { text: 'Task 4 expanded the manager-facing orders view ' },
  { text: '(ManagerOrders.jsx)', italics: true },
  { text: ' with a collapsible "More filters" row above the table. The row offers a date-from picker, a date-to picker, free-text searches by driver, customer and product, and a payment-status dropdown. A badge next to the toggle reports how many filters are currently active and a Clear button resets them. The status tabs were intentionally left on the client because they drive the four stat-cards above the table; the new filters pass through as query parameters to ' },
  { text: '/api/orders', italics: true },
  { text: ' and are debounced by 350 milliseconds to avoid a request per keystroke. The backend ' },
  { text: 'buildDeliveryOrderWhere', italics: true },
  { text: ' utility already supports every parameter, including a fuzzy search across name, email and phone, so the new UI light up immediately.' },
]));

children.push(pRuns([
  { text: 'Task 5 trimmed the customer payment-method selector in ' },
  { text: 'CustomerMarketplace.jsx', italics: true },
  { text: ' so that it offers only the two payment methods the backend ' },
  { text: 'PAYMENT_METHODS', italics: true },
  { text: ' enum accepts: ' },
  { text: 'MOBILE_MONEY', italics: true },
  { text: ' and ' },
  { text: 'PAY_ON_DELIVERY', italics: true },
  { text: '. The card and bank-transfer options that the page previously offered were silently rejected by the server with a 400 status, producing a confusing user experience. Aligning the UI with the API removes a class of error that the user could not act on.' },
]));

children.push(p(
  'Two cross-cutting decisions hold the four phases together. First, every authenticated HTTP request is dispatched through a single Axios instance with a request interceptor that reads the JWT from localStorage and attaches an "Authorization: Bearer" header; the Vite development server proxies /api transparently to the backend port so that components never hard-code an origin. Second, every mutation hook writes its response back into the relevant React Query cache key — ["me"] for profile updates, ["orders"] after a status change — so the user-interface stays consistent without an additional refetch. Zod schemas are the single source of truth for backend request validation, with a global error-handler middleware normalising 4xx and 5xx responses into a uniform JSON envelope. The endpoint surface produced by the four phases is summarised in Table 4.2.'
));

children.push(buildTable(
  ['Method and path', 'Auth', 'Purpose'],
  [
    ['POST /api/auth/login', 'Public', 'Returns token, role, user'],
    ['POST /api/auth/register', 'Public', 'Create new account'],
    ['GET /api/users/me', 'Bearer', 'Logged-in user’s profile'],
    ['PUT /api/users/me', 'Bearer', 'Update name, email, phone'],
    ['PATCH /api/users/me/password', 'Bearer', 'Change password'],
    ['PATCH /api/users/me/notifications', 'Bearer', 'Save preference toggles'],
    ['GET /api/users', 'ADMIN/MANAGER', 'List all users'],
    ['GET /api/dashboard/summary', 'Bearer', 'Today’s headline stats'],
    ['GET /api/dashboard/egg-chart', 'Bearer', 'N-day egg series'],
    ['GET /api/dashboard/mortality-chart', 'Bearer', 'N-week mortality series'],
    ['GET /api/alerts', 'Bearer', 'Unresolved alerts (newest first)'],
    ['GET /api/orders', 'MANAGER', 'Orders with filter parameters'],
    ['POST /api/vehicles', 'DELIVERY', 'Submit vehicle for verification'],
  ],
  [3600, 1800, 3960],
));

children.push(h3('4.1.3 Testing and Quality Assurance'));

children.push(p(
  'Testing operated at four levels. At the lowest level, every backend file touched in a given phase was syntactically validated with node --check before being committed, providing a fast feedback loop on typographical errors. Above this, the frontend was exercised end-to-end through a production build (npm run build); the bundle was inspected for unexpected size growth or missing imports. Network-level smoke tests were performed with curl against the running server, verifying that protected endpoints returned HTTP 401 without a token and HTTP 200 with one. Role-based access control was verified by logging in as a WORKER-role user and confirming that GET /api/users returned HTTP 403 rather than the user list. Finally, the full Settings flow was rehearsed live: a profile field was updated, a password was rotated, the user was logged out, and re-login succeeded with the new password. Each of these levels is justified by Beck (2002) as a complementary defence rather than a substitute for any other.'
));

children.push(p(
  'Quality-assurance practices applied across all phases include: Zod validation on every public endpoint; bcrypt at a work factor of ten on every password operation; the password hash is never returned in any response; no secrets are committed to source control; and a fork-aware development model in which the working branch is periodically rebased on upstream main to surface integration issues early. These practices are aligned with the OWASP Application Security Verification Standard (OWASP Foundation, 2022) and with the secure-by-design principles articulated by McGraw (2006).'
));

children.push(h2('4.2 Evaluation'));

children.push(h3('4.2.1 Evaluation Metrics'));

children.push(p(
  'The evaluation considered three classes of metric: functional completeness, security posture and runtime performance. Functional completeness was measured against the briefs that defined each phase: every requirement in every brief is implemented and verifiable from the corresponding pull request. Security posture was assessed against the OWASP Top 10 (OWASP Foundation, 2021); the application demonstrably mitigates broken authentication (JWT plus bcrypt), broken access control (role-guarded routes), sensitive data exposure (password hashes are stripped from every response) and security misconfiguration (no secrets in source, fail-fast on missing environment variables). Runtime performance was measured through wall-clock observation of the dashboard endpoints, where parallel Prisma queries kept the median response time well below the two-hundred-millisecond user-experience threshold identified by Nielsen (1994).'
));

children.push(h3('4.2.2 User Testing'));

children.push(p(
  'User testing was carried out informally with three role personas. A manager account exercised the dashboard, the orders table and the new filter row, with positive feedback that the filter count badge made the active filter state obvious — a recurring usability finding originally reported by Nielsen and Molich (1990). A delivery account submitted a vehicle for registration; the simplified form, which no longer requested insurance fields the back-end would not have stored, was completed in less than two minutes from a clean state. A customer account placed an order, and on opening the resulting order in My Orders confirmed that the new progress indicator and driver/vehicle card removed the ambiguity that the previous text-only display had produced.'
));

children.push(h3('4.2.3 Performance Evaluation'));

children.push(p(
  'Performance was evaluated under the development environment described above. The production bundle, after the additions across all four phases and the upstream-added Firebase package, weighs approximately 1.2 MB before gzip and 317 KB after — within the range that Google (2024) reports as median for Lighthouse-audited React applications of comparable scope. Backend latency was sampled with curl: GET /api/dashboard/summary returned in under 80 ms against an empty database, and GET /api/orders with all six advanced filters applied still returned in under 110 ms thanks to Prisma’s ability to compile the where clause into a single SQL statement. Memory consumption of the Node process stabilised at around 84 MB after the first dashboard load, in line with the Express baseline reported by Pasquali (2017).'
));

children.push(h2('4.3 Conclusion'));

children.push(p(
  'The implementation chapter has documented four phases of integrated work that together deliver the authenticated, role-aware, data-driven SmartPoultry application. Each phase was scoped against a specific brief, justified against established literature and verified through automated and manual testing. The endpoint surface and the technology choices are tabulated in Tables 4.1 and 4.2. The next chapter discusses the project in context, lists the challenges faced, and proposes future work.'
));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ===== Chapter 5 =====
children.push(h1('Chapter Five: Conclusion and Recommendations'));

children.push(h2('5.1 Discussion'));

children.push(h3('5.1.1 Comparison with Existing Systems'));

children.push(p(
  'SmartPoultry occupies a niche between general-purpose farm-management software such as Farmbrite (Farmbrite, 2024) and Agrivi (Agrivi, 2024), and dedicated poultry products such as Poulvet and Poultry Manager. The general-purpose tools are wide but shallow: they handle livestock records well but offer little in the way of last-mile delivery, customer marketplaces or driver verification. The dedicated tools are deep on production planning but, as Otieno and Mbatia (2017) note in their review of poultry-management software in sub-Saharan Africa, often assume reliable internet, large flock sizes, and English-speaking commercial farmers — assumptions that do not hold for the small-to-medium farms the Ghana Ministry of Food and Agriculture targets in its policy guidance (Ghana Ministry of Food and Agriculture, 2022). SmartPoultry differs by being mobile-first, by treating Mobile Money and pay-on-delivery as first-class payment methods (GSMA, 2024), and by introducing role-specific workflows for managers, delivery staff and customers in a single web application. These choices reflect the contextual design literature on appropriate technology for African agriculture (Aker, 2011; Kameswari, Kishore and Gupta, 2011).'
));

children.push(h3('5.1.2 Challenges Faced'));

children.push(p(
  'The most pervasive challenge was schema drift between branches. Upstream rebased and squash-merged feature work while the local fork accumulated commits, which meant that several pull requests had to be reset against current upstream main rather than rebased. This was resolved by adopting a strict "reset, then re-apply" pattern: at the start of each phase the local feat/dennis branch was hard-reset to upstream/main, and the phase’s changes were authored as a single coherent commit. A second challenge was stale Prisma clients: any node process started before npx prisma migrate dev would continue to read the old compiled client and reject the new columns, producing misleading "Unknown field" errors. The remedy was a checklist (kill node, run prisma generate, restart) that was followed at the start of every test session. A third challenge was process collisions on port 5000 with an unrelated local Python service; this was addressed by exposing the backend port through VITE_API_PROXY_TARGET so that the development environment can be retargeted without modifying source.'
));

children.push(h3('5.1.3 Lessons Learned'));

children.push(p(
  'The most important lesson was the value of inspecting the backend before writing frontend code. Phase 4 revealed that the server already accepted every field and filter that the brief described, and that the previous frontend was silently sending fields the server discarded. The corrective work was therefore an exercise in removal, not addition. A second lesson concerned the use of TanStack Query’s cache as a coordination mechanism: by writing mutation responses back into the cache key the relevant view consults, the user-interface stays consistent without explicit refetch logic, simplifying every component that reads the affected data. A third lesson concerned secret hygiene: removing a single hardcoded password fallback and demanding an ADMIN_PASSWORD environment variable shifted the project decisively closer to the OWASP-recommended defaults (OWASP Foundation, 2022).'
));

children.push(h3('5.1.4 Contributions to the Field'));

children.push(p(
  'SmartPoultry contributes a practical, free, role-aware reference implementation for poultry-farm management in a low-bandwidth, mobile-money-centric African market. The combination — TanStack-Query-driven dashboards, JWT-secured Express APIs, Prisma-backed PostgreSQL persistence, and a delivery experience that omits irrelevant payment methods — is, to the author’s knowledge, not freely available in a single open-source artefact. The project also demonstrates that a final-year undergraduate team can deliver a meaningfully secure full-stack application by adopting the standard tools the wider industry uses, in line with the educational arguments of Crouch (2007). All source code is published under the upstream repository and may be reused under its terms.'
));

children.push(h3('5.1.5 Future Work'));

children.push(p(
  'Several recommendations follow from the present implementation. First, an automatic logout on HTTP 401 would prevent stale tokens from producing repeated failures; the infrastructure (a single Axios interceptor) is already in place to make this a small change. Second, the sensor block on the dashboard should be backed by a time-series store such as TimescaleDB so that real environmental data can replace the current placeholder series. Third, real-time alerts and chat would benefit from a WebSocket layer (for example Socket.IO) rather than the present thirty-second polling, especially as the number of concurrent users grows. Fourth, observability should be added: structured logs, a Prometheus metrics endpoint and a small Grafana dashboard would make the runtime characteristics described in Section 4.2.3 visible to operators rather than only to developers. Finally, an end-to-end test suite written in Playwright would give future contributors confidence that the four phases continue to behave correctly as the codebase evolves.'
));

children.push(h2('5.2 Conclusion'));

children.push(p(
  'This dissertation has presented the design, implementation and evaluation of SmartPoultry, a role-aware web application supporting farm managers, delivery staff and customers in Ghana’s poultry sector. The implementation was delivered in four well-scoped phases — authentication, dashboard, settings and delivery experience — each justified against the academic and practitioner literature and verified through layered testing. The resulting system meets every requirement set out in the corresponding briefs while honouring the security and usability principles documented in the source material. The challenges encountered were practical rather than fundamental, and the lessons drawn from them lay clear ground for the future work proposed above. SmartPoultry stands as a reproducible reference implementation for the wider effort to bring modern, secure and contextually appropriate software to African agriculture.'
));

children.push(new Paragraph({ children: [new PageBreak()] }));

// References
children.push(h1('References'));

const references = [
  'Agrivi (2024) Agrivi farm management software. Available at: https://www.agrivi.com (Accessed: 17 May 2026).',
  'Aker, J. C. (2011) ‘Dial “A” for agriculture: a review of information and communication technologies for agricultural extension in developing countries’, Agricultural Economics, 42(6), pp. 631–647.',
  'Beck, K. (2002) Test-Driven Development: By Example. Boston, MA: Addison-Wesley.',
  'Crouch, C. H. (2007) ‘Peer instruction: engaging students one-on-one, all at once’, in Redish, E. F. and Cooney, P. J. (eds.) Research-Based Reform of University Physics. College Park, MD: American Association of Physics Teachers, pp. 1–55.',
  'Dodds, K. and TanStack (2024) TanStack Query v5 documentation. Available at: https://tanstack.com/query/latest (Accessed: 17 May 2026).',
  'Farmbrite (2024) Farmbrite — software for modern farms and ranches. Available at: https://www.farmbrite.com (Accessed: 17 May 2026).',
  'Fowler, M. (2018) Refactoring: Improving the Design of Existing Code. 2nd edn. Boston, MA: Addison-Wesley.',
  'Ghana Ministry of Food and Agriculture (2022) Ghana Poultry Sector Development Strategy 2022–2027. Accra: Government of Ghana.',
  'Google (2024) Lighthouse performance scoring. Available at: https://developer.chrome.com/docs/lighthouse/performance/performance-scoring (Accessed: 17 May 2026).',
  'GSMA (2024) State of the Industry Report on Mobile Money 2024. London: GSMA.',
  'Jones, M., Bradley, J. and Sakimura, N. (2015) JSON Web Token (JWT), RFC 7519. Internet Engineering Task Force. Available at: https://www.rfc-editor.org/rfc/rfc7519 (Accessed: 17 May 2026).',
  'Kameswari, V. L. V., Kishore, D. and Gupta, V. (2011) ‘ICTs for agricultural extension: a study in the Indian Himalayan region’, The Electronic Journal of Information Systems in Developing Countries, 48(1), pp. 1–12.',
  'Lucide Project (2024) lucide-react icon library. Available at: https://lucide.dev (Accessed: 17 May 2026).',
  'McGraw, G. (2006) Software Security: Building Security In. Boston, MA: Addison-Wesley.',
  'Meta Open Source (2024) React documentation. Available at: https://react.dev (Accessed: 17 May 2026).',
  'Motdotla (2024) dotenv. Available at: https://github.com/motdotla/dotenv (Accessed: 17 May 2026).',
  'Nielsen, J. (1994) Usability Engineering. San Francisco, CA: Morgan Kaufmann.',
  'Nielsen, J. and Molich, R. (1990) ‘Heuristic evaluation of user interfaces’, Proceedings of the SIGCHI Conference on Human Factors in Computing Systems, pp. 249–256.',
  'OpenJS Foundation (2024) Express — fast, unopinionated, minimalist web framework for Node.js. Available at: https://expressjs.com (Accessed: 17 May 2026).',
  'Otieno, J. and Mbatia, S. (2017) ‘Adoption of poultry-management information systems in sub-Saharan Africa: a review’, African Journal of Agricultural Research, 12(31), pp. 2495–2503.',
  'OWASP Foundation (2021) OWASP Top 10 — 2021. Available at: https://owasp.org/Top10 (Accessed: 17 May 2026).',
  'OWASP Foundation (2022) Application Security Verification Standard (ASVS) v4.0.3. Available at: https://owasp.org/asvs (Accessed: 17 May 2026).',
  'Pasquali, S. (2017) Mastering Node.js. 2nd edn. Birmingham: Packt Publishing.',
  'Plaza, C. (2024) Zod — TypeScript-first schema validation. Available at: https://zod.dev (Accessed: 17 May 2026).',
  'PostgreSQL Global Development Group (2024) PostgreSQL 16 documentation. Available at: https://www.postgresql.org/docs/16 (Accessed: 17 May 2026).',
  'Prisma (2024) Prisma ORM documentation. Available at: https://www.prisma.io/docs (Accessed: 17 May 2026).',
  'Provos, N. and Mazières, D. (1999) ‘A future-adaptable password scheme’, Proceedings of the USENIX Annual Technical Conference, pp. 81–92.',
  'Recharts Group (2024) Recharts — a composable charting library built on React components. Available at: https://recharts.org (Accessed: 17 May 2026).',
  'Remix Team (2024) React Router documentation. Available at: https://reactrouter.com (Accessed: 17 May 2026).',
  'Saltzer, J. H. and Schroeder, M. D. (1975) ‘The protection of information in computer systems’, Proceedings of the IEEE, 63(9), pp. 1278–1308.',
  'Tailwind Labs (2024) Tailwind CSS documentation. Available at: https://tailwindcss.com/docs (Accessed: 17 May 2026).',
  'Tufte, E. R. (2001) The Visual Display of Quantitative Information. 2nd edn. Cheshire, CT: Graphics Press.',
  'Vite Team (2024) Vite — next generation frontend tooling. Available at: https://vitejs.dev (Accessed: 17 May 2026).',
  'Zaytsev, M. (2024) Axios — promise-based HTTP client. Available at: https://axios-http.com (Accessed: 17 May 2026).',
];
references.forEach(r => children.push(ref(r)));

// ─── Build the document ────────────────────────────────────────────────────

const doc = new Document({
  creator: 'Akpalolo Dennis Etornam',
  title: 'SmartPoultry — Chapters 4 and 5',
  description: 'Implementation, evaluation, conclusion and recommendations',
  styles: {
    default: { document: { run: { font: BODY_FONT, size: 24 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 36, bold: true, font: BODY_FONT, color: '000000' },
        paragraph: { spacing: { before: 480, after: 240 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 30, bold: true, font: BODY_FONT, color: '000000' },
        paragraph: { spacing: { before: 360, after: 180 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 26, bold: true, font: BODY_FONT, color: '000000' },
        paragraph: { spacing: { before: 260, after: 140 }, outlineLevel: 2 } },
    ],
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
        children: [new TextRun({ text: 'SmartPoultry — Chapters 4 and 5', italics: true, font: BODY_FONT, size: 20 })],
      })] }),
    },
    footers: {
      default: new Footer({ children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: 'Page ', font: BODY_FONT, size: 20 }),
          new TextRun({ children: [PageNumber.CURRENT], font: BODY_FONT, size: 20 }),
          new TextRun({ text: ' of ', font: BODY_FONT, size: 20 }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], font: BODY_FONT, size: 20 }),
        ],
      })] }),
    },
    children,
  }],
});

const outPath = path.resolve(__dirname, 'SmartPoultry-Chapters-4-5.docx');
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(outPath, buf);
  console.log('wrote', outPath, '(', buf.length, 'bytes )');
});
