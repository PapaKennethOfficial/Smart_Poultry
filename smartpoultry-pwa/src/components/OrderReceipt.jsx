import React, { useMemo } from 'react'

/**
 * Order receipt — on screen, and on paper.
 *
 * Printing used to rely on the classic `visibility: hidden` on `body *` trick
 * with `position: absolute` on the receipt. That breaks here because the
 * receipt renders INSIDE a modal: `position: absolute` anchors to the nearest
 * positioned ancestor (the modal), not the page, and the fixed overlay put the
 * content outside the printable area — so the sheet came out blank.
 *
 * Printing now builds a self-contained document in a hidden iframe. That is
 * immune to every ancestor style — transforms, overflow, fixed positioning,
 * stacking contexts — because the receipt is the only thing in that document.
 */

const money = (v) =>
  v === null || v === undefined || Number.isNaN(Number(v))
    ? '—'
    : `GHS ${Number(v).toFixed(2)}`

const shortDate = (d) => {
  if (!d) return '—'
  const parsed = new Date(d)
  return Number.isNaN(parsed.getTime())
    ? '—'
    : parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const clean = (v, fallback = '—') =>
  v ? String(v).replaceAll('_', ' ') : fallback

/** Escape anything that reaches the print document as HTML. */
const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

export default function OrderReceipt({ order }) {
  // An order may carry a single `product` or a list of `items` — handle both,
  // because a multi-item order previously printed a blank product name.
  const lines = useMemo(() => {
    if (!order) return []
    if (Array.isArray(order.items) && order.items.length) {
      return order.items.map((it) => ({
        name: it.product?.name || 'Item',
        qty: it.quantity ?? 1,
        price: it.price ?? null,
        total: (it.price ?? 0) * (it.quantity ?? 1),
      }))
    }
    return [{
      name: order.product?.name || 'Item',
      qty: order.quantity ?? 1,
      price: null,
      total: order.amount ?? 0,
    }]
  }, [order])

  if (!order) return null

  const rows = [
    ['Order ID', order.orderId],
    ['Date', shortDate(order.createdAt)],
    order.customer?.name && ['Customer', order.customer.name],
    order.customer?.phone && ['Phone', order.customer.phone],
    ['Delivery address', order.address || '—'],
    ['Delivery date', shortDate(order.deliveryDate)],
    ['Payment method', clean(order.paymentMethod, 'N/A')],
    ['Payment status', clean(order.paymentStatus, 'PENDING')],
  ].filter(Boolean)

  const handlePrint = () => {
    const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Receipt ${esc(order.orderId)}</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #111; margin: 0; font-size: 12px; line-height: 1.5;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .head { display: flex; justify-content: space-between;
          align-items: flex-start; border-bottom: 2px solid #237227;
          padding-bottom: 10px; margin-bottom: 16px; }
  .brand { font-size: 20px; font-weight: 700; color: #237227; letter-spacing: -0.02em; }
  .sub { color: #666; font-size: 11px; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; }
  .meta td { padding: 4px 0; vertical-align: top; }
  .meta td:first-child { color: #666; width: 42%; }
  .meta td:last-child { text-align: right; font-weight: 600; }
  .items { margin-top: 18px; }
  .items th { text-align: left; font-size: 10px; text-transform: uppercase;
              letter-spacing: 0.06em; color: #666; border-bottom: 1px solid #ddd;
              padding: 6px 0; }
  .items td { padding: 7px 0; border-bottom: 1px solid #f0f0f0;
              font-variant-numeric: tabular-nums; }
  .items .num { text-align: right; }
  .total { margin-top: 14px; display: flex; justify-content: space-between;
           border-top: 2px solid #111; padding-top: 10px;
           font-size: 15px; font-weight: 700; }
  .foot { margin-top: 26px; text-align: center; color: #888; font-size: 10px;
          border-top: 1px solid #eee; padding-top: 10px; }
</style></head>
<body>
  <div class="head">
    <div>
      <div class="brand">SmartPoultry</div>
      <div class="sub">Official Receipt</div>
    </div>
    <div class="sub" style="text-align:right">
      <div><strong>${esc(order.orderId)}</strong></div>
      <div>${esc(shortDate(order.createdAt))}</div>
    </div>
  </div>

  <table class="meta"><tbody>
    ${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}
  </tbody></table>

  <table class="items"><thead>
    <tr><th>Item</th><th class="num">Qty</th><th class="num">Amount</th></tr>
  </thead><tbody>
    ${lines.map((l) => `<tr>
      <td>${esc(l.name)}</td>
      <td class="num">${esc(l.qty)}</td>
      <td class="num">${esc(money(l.total))}</td>
    </tr>`).join('')}
  </tbody></table>

  <div class="total"><span>Total</span><span>${esc(money(order.amount))}</span></div>
  <div class="foot">Thank you for your order — SmartPoultry</div>
</body></html>`

    const frame = document.createElement('iframe')
    frame.setAttribute('aria-hidden', 'true')
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
    document.body.appendChild(frame)

    const doc = frame.contentWindow.document
    doc.open()
    doc.write(html)
    doc.close()

    const go = () => {
      try {
        frame.contentWindow.focus()
        frame.contentWindow.print()
      } finally {
        // Give the print dialog time to take its snapshot before teardown.
        setTimeout(() => frame.remove(), 1000)
      }
    }
    // Wait for the iframe document to settle; onload does not always fire for
    // a document written this way, so fall back to a short timeout.
    if (doc.readyState === 'complete') setTimeout(go, 60)
    else frame.onload = go
  }

  return (
    <div className="receipt-container" style={{
      background: '#fff', padding: 18, borderRadius: 'var(--r-md)',
      border: '1px solid var(--border, #dddabd)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--primary, #237227)' }}>SmartPoultry</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle, #8da58f)' }}>Official Receipt</div>
        </div>
        <button type="button" onClick={handlePrint} className="btn-outline" style={{ fontSize: '0.78rem', padding: '7px 13px' }}>
          Print receipt
        </button>
      </div>

      <div style={{ borderTop: '1px solid var(--border-light, #eceacc)', paddingTop: 12 }}>
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: '0.82rem', marginBottom: 6 }}>
            <span style={{ color: 'var(--text-subtle, #8da58f)' }}>{k}</span>
            <span style={{ fontWeight: 600, textAlign: 'right', maxWidth: '60%' }}>{v}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, borderTop: '1px solid var(--border-light, #eceacc)', paddingTop: 12 }}>
        {lines.map((l, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 6 }}>
            <span>{l.name} <span style={{ color: 'var(--text-subtle, #8da58f)' }}>× {l.qty}</span></span>
            <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{money(l.total)}</span>
          </div>
        ))}
      </div>

      <div style={{
        marginTop: 12, borderTop: '2px solid var(--text-heading, #0d1f0e)', paddingTop: 10,
        display: 'flex', justifyContent: 'space-between', fontWeight: 700,
      }}>
        <span>Total</span>
        <span style={{ color: 'var(--primary, #237227)', fontVariantNumeric: 'tabular-nums' }}>{money(order.amount)}</span>
      </div>
    </div>
  )
}
