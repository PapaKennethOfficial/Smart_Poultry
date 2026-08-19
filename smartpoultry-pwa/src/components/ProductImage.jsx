import { useState } from 'react'
import { Egg } from 'lucide-react'

/**
 * Product image with a fixed aspect ratio and a branded fallback.
 *
 * Why this exists: managers can already upload product photos — the admin
 * inventory screen has the whole flow and `Product.imageUrl` is populated — but
 * the customer marketplace never rendered them. A shop with no pictures does
 * not read as a shop.
 *
 * Two rules make a product grid look composed rather than improvised:
 *   1. Every tile is the SAME aspect ratio, whatever the source image is.
 *      Mixed ratios are what make a grid feel broken.
 *   2. A missing image gets a deliberate placeholder, never a blank box or a
 *      browser's broken-image glyph.
 */
export default function ProductImage({
  src,
  alt = '',
  ratio = '3 / 2',   // shorter than square: the photo supports the card, it does not dominate it
  radius = 'var(--r-md)',
  className = '',
}) {
  // `failed` covers a URL that exists but 404s — a deleted upload, say.
  const [failed, setFailed] = useState(false)
  const showFallback = !src || failed

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: ratio,
        borderRadius: radius,
        overflow: 'hidden',
        background: showFallback
          ? 'linear-gradient(135deg, rgba(132,190,136,0.16), rgba(255,170,0,0.10))'
          : 'var(--border-light, #eceacc)',
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
      }}
    >
      {showFallback ? (
        <div style={{ display: 'grid', placeItems: 'center', gap: 6, color: 'var(--text-subtle, #8da58f)' }}>
          <Egg size={22} strokeWidth={1.5} />
          <span style={{ fontSize: '0.58rem', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600 }}>
            No photo
          </span>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            transition: 'transform var(--dur-2, 240ms) var(--ease, ease)',
          }}
        />
      )}
    </div>
  )
}
