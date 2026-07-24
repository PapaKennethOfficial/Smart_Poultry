import { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'

export default function InstallPWA() {
  const [supportsPWA, setSupportsPWA] = useState(false)
  const [promptInstall, setPromptInstall] = useState(null)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }

    const handler = (e) => {
      e.preventDefault()
      setSupportsPWA(true)
      setPromptInstall(e)
    }

    window.addEventListener('beforeinstallprompt', handler)

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true)
      setSupportsPWA(false)
    })

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const onClick = async (evt) => {
    evt.preventDefault()
    if (!promptInstall) {
      return
    }
    promptInstall.prompt()
    const { outcome } = await promptInstall.userChoice
    if (outcome === 'accepted') {
      setSupportsPWA(false)
    }
  }

  if (!supportsPWA || isInstalled) {
    return null
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 70,
      left: 16,
      right: 16,
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '16px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      zIndex: 9999
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, background: 'var(--primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
      }}>
        <Download size={20} color="#fff" />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-heading)' }}>Install SmartPoultry</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: 2 }}>Add to your home screen for a better experience.</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button 
          onClick={onClick} 
          style={{ 
            background: 'var(--primary)', color: '#fff', border: 'none', 
            padding: '6px 16px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
            cursor: 'pointer' 
          }}
        >
          Install
        </button>
        <button 
          onClick={() => setSupportsPWA(false)} 
          style={{ 
            background: 'transparent', color: 'var(--text-subtle)', border: 'none', 
            fontSize: '0.7rem', cursor: 'pointer' 
          }}
        >
          Not Now
        </button>
      </div>
    </div>
  )
}
