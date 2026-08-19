import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function Pagination({ currentPage, totalItems, itemsPerPage, onPageChange }) {
  const totalPages = Math.ceil(totalItems / itemsPerPage)

  // Nothing to say about an empty list.
  if (!totalItems) return null

  // With a single page we still show the "Showing 1 to N of N" line, just
  // without the page buttons. Hiding the whole bar made short lists look
  // like pagination was missing rather than unnecessary.
  const singlePage = totalPages <= 1

  // Calculate page range to show
  let startPage = Math.max(1, currentPage - 2)
  let endPage = Math.min(totalPages, startPage + 4)
  
  if (endPage - startPage < 4) {
    startPage = Math.max(1, endPage - 4)
  }

  const pages = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i)

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderTop: '1px solid var(--border-light)', marginTop: 16 }}>
      <div style={{ fontSize: '0.85rem', color: 'var(--text-subtle)' }}>
        Showing <span style={{ fontWeight: 600 }}>{Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)}</span> to <span style={{ fontWeight: 600 }}>{Math.min(currentPage * itemsPerPage, totalItems)}</span> of <span style={{ fontWeight: 600 }}>{totalItems}</span> entries
      </div>
      
      {singlePage ? null : (
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          style={{
            padding: '6px',
            borderRadius: 6,
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            color: currentPage === 1 ? 'var(--border)' : 'var(--text-body)',
            cursor: currentPage === 1 ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <ChevronLeft size={16} />
        </button>

        {pages.map(page => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            style={{
              minWidth: 32,
              padding: '4px 8px',
              borderRadius: 6,
              background: currentPage === page ? 'var(--primary)' : 'var(--bg)',
              color: currentPage === page ? 'white' : 'var(--text-body)',
              border: `1px solid ${currentPage === page ? 'var(--primary)' : 'var(--border)'}`,
              fontSize: '0.85rem',
              fontWeight: currentPage === page ? 600 : 400,
              cursor: 'pointer'
            }}
          >
            {page}
          </button>
        ))}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          style={{
            padding: '6px',
            borderRadius: 6,
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            color: currentPage === totalPages ? 'var(--border)' : 'var(--text-body)',
            cursor: currentPage === totalPages ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <ChevronRight size={16} />
        </button>
      </div>
      )}
    </div>
  )
}
