import { Link } from 'react-router-dom';
import { Leaf, Truck, ShoppingBag, ArrowRight, BarChart, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function Welcome() {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#071508',
      color: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Inter, sans-serif',
      position: 'relative',
      overflowX: 'hidden'
    }}>
      {/* Background glowing orbs for glassmorphism effect - Reduced blur for performance */}
      <div style={{
        position: 'absolute', top: '-10%', left: '-10%', width: '40vw', height: '40vw', minWidth: '300px', minHeight: '300px',
        background: 'radial-gradient(circle, rgba(132, 190, 136, 0.15) 0%, rgba(0,0,0,0) 70%)',
        filter: 'blur(40px)', zIndex: 0
      }} />
      <div style={{
        position: 'absolute', bottom: '-10%', right: '-10%', width: '50vw', height: '50vw', minWidth: '350px', minHeight: '350px',
        background: 'radial-gradient(circle, rgba(255, 170, 0, 0.1) 0%, rgba(0,0,0,0) 70%)',
        filter: 'blur(50px)', zIndex: 0
      }} />

      {/* Navigation Bar */}
      <nav style={{
        position: 'relative', zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '24px 5%',
        borderBottom: '1px solid rgba(255,255,255,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'linear-gradient(135deg, rgba(35, 114, 39, 0.8), rgba(132, 190, 136, 0.8))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 16px rgba(35, 114, 39, 0.2)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <Leaf color="#fff" size={20} strokeWidth={2.5} />
          </div>
          <span style={{
            fontFamily: 'Space Grotesk, sans-serif',
            fontWeight: 700, fontSize: '1.25rem',
            letterSpacing: '-0.02em',
            color: 'rgba(255,255,255,0.95)'
          }}>
            SmartPoultry
          </span>
        </div>
        
        <Link to="/login" style={{ textDecoration: 'none' }}>
          <button style={{
            backgroundColor: 'rgba(255,255,255,0.1)',
            color: '#fff', border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '20px', padding: '8px 20px', fontSize: '0.9rem',
            fontWeight: 500, cursor: 'pointer', backdropFilter: 'blur(10px)',
            transition: 'background 0.2s'
          }}>
            Sign In
          </button>
        </Link>
      </nav>

      {/* Hero Section */}
      <header style={{
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
        padding: 'clamp(40px, 10vw, 80px) 5% clamp(30px, 8vw, 60px)',
        maxWidth: '800px', margin: '0 auto'
      }}>
        <div style={{
          display: 'inline-block',
          padding: '6px 14px', borderRadius: '20px',
          background: 'rgba(132, 190, 136, 0.1)',
          border: '1px solid rgba(132, 190, 136, 0.2)',
          color: '#84be88', fontSize: '0.8rem', fontWeight: 600,
          letterSpacing: '0.05em', marginBottom: '24px'
        }}>
          THE FUTURE OF AGRI-LOGISTICS
        </div>
        
        <h1 style={{
          fontFamily: 'Space Grotesk, sans-serif',
          fontWeight: 600, fontSize: 'clamp(2rem, 6vw, 3.5rem)',
          lineHeight: 1.1, letterSpacing: '-0.03em',
          marginBottom: '20px'
        }}>
          Fresh poultry,<br />
          <span style={{ color: '#84be88', fontStyle: 'italic' }}>delivered smart.</span>
        </h1>
        
        <p style={{
          fontSize: 'clamp(0.95rem, 3vw, 1.05rem)', color: 'rgba(255,255,255,0.7)',
          lineHeight: 1.6, maxWidth: '600px', fontWeight: 300,
          marginBottom: '32px'
        }}>
          Experience the premier AI-driven ecosystem bridging the gap between local farms and your doorstep. Secure, transparent, and built for scale.
        </p>

        <Link to="/login" style={{ textDecoration: 'none' }}>
          <button style={{
            backgroundColor: '#fff', color: '#071508',
            border: 'none', borderRadius: '16px', padding: '16px 32px',
            fontSize: '1.05rem', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: '10px',
            cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif',
            boxShadow: '0 8px 24px rgba(255,255,255,0.15)',
            transition: 'transform 0.2s'
          }}>
            Access Portal <ArrowRight size={18} strokeWidth={2.5} />
          </button>
        </Link>
      </header>

      {/* Features Grid */}
      <section style={{
        position: 'relative', zIndex: 1,
        padding: '20px 5% 40px',
        maxWidth: '1200px', margin: '0 auto', width: '100%'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '20px'
        }}>
          {/* Customer Card */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '20px', padding: '24px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)'
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: '12px',
              background: 'rgba(132, 190, 136, 0.15)',
              border: '1px solid rgba(132, 190, 136, 0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '16px'
            }}>
              <ShoppingBag color="#84be88" size={22} strokeWidth={1.5} />
            </div>
            <h3 style={{
              fontFamily: 'Space Grotesk, sans-serif',
              fontWeight: 600, fontSize: '1.4rem', marginBottom: '12px', color: '#fff'
            }}>For Customers</h3>
            <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, fontWeight: 300, marginBottom: '24px' }}>
              Access our live marketplace. Browse fresh farm produce, place secure orders, and track your deliveries in real-time.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {['Live inventory sync', 'Secure checkout process', 'Real-time GPS tracking'].map((item, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)' }}>
                  <CheckCircle2 size={16} color="#84be88" /> {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Delivery Card */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '20px', padding: '24px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)'
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: '12px',
              background: 'rgba(255, 170, 0, 0.15)',
              border: '1px solid rgba(255, 170, 0, 0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '16px'
            }}>
              <Truck color="#FFAA00" size={22} strokeWidth={1.5} />
            </div>
            <h3 style={{
              fontFamily: 'Space Grotesk, sans-serif',
              fontWeight: 600, fontSize: '1.4rem', marginBottom: '12px', color: '#fff'
            }}>For Logistics</h3>
            <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, fontWeight: 300, marginBottom: '24px' }}>
              Streamline your delivery routes. Manage assigned orders, log vehicle status, and update customers on the go.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {['Optimized routing', 'Digital vehicle logbooks', 'One-tap status updates'].map((item, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)' }}>
                  <CheckCircle2 size={16} color="#FFAA00" /> {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Admin Card */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '20px', padding: '24px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)'
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: '12px',
              background: 'rgba(139, 92, 246, 0.15)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '16px'
            }}>
              <BarChart color="#8b5cf6" size={22} strokeWidth={1.5} />
            </div>
            <h3 style={{
              fontFamily: 'Space Grotesk, sans-serif',
              fontWeight: 600, fontSize: '1.4rem', marginBottom: '12px', color: '#fff'
            }}>For Managers</h3>
            <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, fontWeight: 300, marginBottom: '24px' }}>
              Command center for operations. Monitor farm inventory, oversee all active dispatch units, and analyze fleet performance.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {['Advanced analytics dashboard', 'Centralized inventory control', 'Fleet compliance & verification'].map((item, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)' }}>
                  <CheckCircle2 size={16} color="#8b5cf6" /> {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        marginTop: 'auto',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        padding: '20px 5% 8px',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        position: 'relative', zIndex: 1
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>
          <ShieldCheck size={16} /> Secure Platform © {new Date().getFullYear()} SmartPoultry AI
        </div>
      </footer>
    </div>
  )
}
