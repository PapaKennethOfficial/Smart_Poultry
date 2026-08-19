import { Link } from 'react-router-dom';
import { Leaf, Truck, Boxes, BarChart, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';

/*
 * Welcome — the public landing page for the manager/admin console.
 *
 * This used to be a byte-for-byte copy of the customer PWA's landing page,
 * which meant it advertised a customer marketplace and a driver app that
 * nobody signing in here can reach. The three cards now describe what this
 * console actually does instead.
 *
 * The landing page offers one action: sign in. Manager accounts are still
 * created at /admin/register, but that route is no longer advertised here —
 * an operations console is not something the public signs itself up for.
 *
 * The cards are plain <div>s on purpose: everything they describe sits behind
 * authentication, so making them look clickable would only lead to a redirect.
 *
 * Styling moved to the .welcome-* classes in index.css. Inline style objects
 * cannot express :hover or :focus-visible, so the `transition` properties this
 * file used to declare could never fire.
 */

const CAPABILITIES = [
  {
    key: 'farm',
    icon: Boxes,
    accent: 'var(--sage)',
    title: 'Farm Operations',
    blurb:
      'Centralized inventory control. Record daily logbook entries, track batches through their cycle, and keep product stock in step with what the farm actually holds.',
    points: ['Daily farm logbook', 'Batch and mortality tracking', 'Live product inventory'],
  },
  {
    key: 'dispatch',
    icon: Truck,
    accent: 'var(--accent)',
    title: 'Dispatch & Fleet',
    blurb:
      'Oversee every active dispatch unit. Assign drivers to orders, verify vehicle documents, and follow deliveries on the map as they move.',
    points: ['Driver assignment', 'Vehicle compliance & verification', 'Live delivery tracking'],
  },
  {
    key: 'analytics',
    icon: BarChart,
    // Not --primary: #237227 sits at roughly 2:1 against this dark card, too
    // dim to read as an icon. The page's own text colour is already in the
    // system and holds up, so no new hue is introduced.
    accent: 'rgba(255, 255, 255, 0.88)',
    title: 'Analytics & Forecasting',
    blurb:
      'Advanced analytics dashboard. Read demand and yield forecasts, feed conversion, fulfilment funnels and driver performance — with printable reports.',
    points: ['Demand & yield forecasts', 'Feed conversion and anomalies', 'Exportable PDF reports'],
  },
];

export default function Welcome() {
  return (
    <div className="welcome-page">
      <div className="welcome-orb welcome-orb--sage" aria-hidden="true" />
      <div className="welcome-orb welcome-orb--accent" aria-hidden="true" />

      <nav className="welcome-nav">
        <Link to="/" className="welcome-brand">
          <span className="welcome-mark">
            <Leaf color="#fff" size={20} strokeWidth={2.5} />
          </span>
          <span className="welcome-wordmark">SmartPoultry</span>
        </Link>

        <div className="welcome-nav-actions">
          <Link to="/admin/login" className="welcome-btn welcome-btn--ghost">Sign In</Link>
        </div>
      </nav>

      <header className="welcome-hero">
        <span className="welcome-eyebrow">Operations, dispatch &amp; analytics</span>

        <h1 className="welcome-title">
          Run the farm,<br />
          <em>end to end.</em>
        </h1>

        <p className="welcome-lede">
          One command centre for flock records, marketplace inventory, dispatch and
          forecasting — the operational half of the SmartPoultry platform.
        </p>

        <div className="welcome-cta-row">
          <Link to="/admin/login" className="welcome-btn welcome-btn--hero">
            Access Portal
            <ArrowRight className="welcome-btn-arrow" size={18} strokeWidth={2.5} />
          </Link>
        </div>
      </header>

      <section className="welcome-section">
        <h2 className="u-visually-hidden">What the console does</h2>

        <div className="welcome-grid">
          {CAPABILITIES.map(({ key, icon: Icon, accent, title, blurb, points }) => (
            <div key={key} className="welcome-card" style={{ '--card-accent': accent }}>
              <span className="welcome-card-icon">
                <Icon size={22} strokeWidth={1.5} />
              </span>
              <h3>{title}</h3>
              <p>{blurb}</p>
              <ul className="welcome-card-list">
                {points.map((point) => (
                  <li key={point}>
                    <CheckCircle2 size={16} /> {point}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <footer className="welcome-footer">
        <ShieldCheck size={16} aria-hidden="true" />
        <span>Secure Platform © {new Date().getFullYear()} SmartPoultry AI</span>
      </footer>
    </div>
  );
}
