import { Link } from 'react-router-dom';
import { Leaf, Truck, ShoppingBag, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';

/*
 * Welcome — the public landing page for the customer/driver PWA.
 *
 * Two things this page used to get wrong:
 *
 *  1. It advertised a "For Managers" command centre. Nobody arriving at this
 *     app can reach that — it lives in the separate admin console — so the
 *     card was a promise the page could not keep. It is gone.
 *
 *  2. Nothing on it led to sign-up. Both the nav and the hero pointed at
 *     /login, so a brand-new visitor had to land on the sign-in card and hunt
 *     for the small "Sign Up" link underneath it. The audience cards are now
 *     links that land on /register with the right role already selected.
 *
 * Each action appears once: sign-in in the nav, sign-up through the hero call
 * to action and the two audience cards. Repeating either one gave the page
 * competing calls to action where it needs a single obvious next step.
 *
 * Styling moved to the .welcome-* classes in index.css. Inline style objects
 * cannot express :hover or :focus-visible, so the `transition` properties this
 * file used to declare could never fire.
 */

const AUDIENCES = [
  {
    key: 'customer',
    icon: ShoppingBag,
    accent: 'var(--sage)',
    title: 'For Customers',
    blurb:
      'Access our live marketplace. Browse fresh farm produce, place secure orders, and track your deliveries in real-time.',
    points: ['Live inventory sync', 'Secure checkout process', 'Real-time GPS tracking'],
    action: 'Create a customer account',
    to: '/register?role=customer',
  },
  {
    key: 'delivery',
    icon: Truck,
    accent: 'var(--accent)',
    title: 'For Logistics',
    blurb:
      'Streamline your delivery routes. Manage assigned orders, log vehicle status, and update customers on the go.',
    points: ['Optimized routing', 'Digital vehicle logbooks', 'One-tap status updates'],
    action: 'Register as a driver',
    to: '/register?role=delivery',
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
          <Link to="/login" className="welcome-btn welcome-btn--ghost">Sign In</Link>
        </div>
      </nav>

      <header className="welcome-hero">
        <span className="welcome-eyebrow">The future of agri-logistics</span>

        <h1 className="welcome-title">
          Fresh poultry,<br />
          <em>delivered smart.</em>
        </h1>

        <p className="welcome-lede">
          Experience the premier AI-driven ecosystem bridging the gap between local farms
          and your doorstep. Secure, transparent, and built for scale.
        </p>

        <div className="welcome-cta-row">
          <Link to="/register" className="welcome-btn welcome-btn--hero">
            Get Started
            <ArrowRight className="welcome-btn-arrow" size={18} strokeWidth={2.5} />
          </Link>
        </div>
      </header>

      <section className="welcome-section">
        <h2 className="u-visually-hidden">Choose how you want to join</h2>

        <div className="welcome-grid welcome-grid--pair">
          {AUDIENCES.map(({ key, icon: Icon, accent, title, blurb, points, action, to }) => (
            <Link key={key} to={to} className="welcome-card" style={{ '--card-accent': accent }}>
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
              <span className="welcome-card-action">
                {action} <ArrowRight size={15} strokeWidth={2.5} />
              </span>
            </Link>
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
