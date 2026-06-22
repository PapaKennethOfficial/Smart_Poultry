import { Search, Filter, X } from 'lucide-react'

/**
 * TableFilter — reusable search + dropdown filter bar for data tables.
 *
 * Props:
 *   searchValue      – current search string
 *   onSearchChange   – (value) => void
 *   searchPlaceholder– placeholder text for search input
 *   filters          – array of { key, label, value, options: [{ label, value }] }
 *   onFilterChange   – (key, value) => void
 *   resultCount      – total filtered results (optional, shown as badge)
 */
export default function TableFilter({
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search…',
  filters = [],
  onFilterChange,
  resultCount,
}) {
  const hasActiveFilters = searchValue || filters.some(f => f.value && f.value !== 'all')

  return (
    <div className="table-filter-bar">
      {/* Search */}
      <div className="table-filter-search">
        <Search size={15} className="table-filter-search-icon" />
        <input
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="table-filter-input"
        />
        {searchValue && (
          <button
            className="table-filter-clear"
            onClick={() => onSearchChange('')}
            title="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Dropdown filters */}
      {filters.map((f) => (
        <div key={f.key} className="table-filter-dropdown-wrap">
          <select
            value={f.value || 'all'}
            onChange={(e) => onFilterChange(f.key, e.target.value)}
            className="table-filter-select"
          >
            <option value="all">{f.label}</option>
            {f.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      ))}

      {/* Result count badge */}
      {resultCount !== undefined && (
        <div className="table-filter-count">
          {resultCount} result{resultCount !== 1 ? 's' : ''}
        </div>
      )}

      {/* Clear all button */}
      {hasActiveFilters && (
        <button
          className="table-filter-reset"
          onClick={() => {
            onSearchChange('')
            filters.forEach(f => onFilterChange(f.key, 'all'))
          }}
        >
          <X size={13} /> Clear
        </button>
      )}
    </div>
  )
}
