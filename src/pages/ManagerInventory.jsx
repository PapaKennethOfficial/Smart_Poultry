import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Search, Image as ImageIcon, CheckCircle, XCircle } from 'lucide-react'
import api from '../api/axios'
import Pagination from '../components/Pagination'
import TableFilter from '../components/TableFilter'

export default function ManagerInventory() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterStock, setFilterStock] = useState('all')
  const itemsPerPage = 10
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    unit: 'kg',
    stock: '',
    category: 'General',
    isActive: true
  })
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [saving, setSaving] = useState(false)

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const res = await api.get('/api/products/all')
      setProducts(res.data.products || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  const handleOpenModal = (product = null) => {
    if (product) {
      setEditingId(product.id)
      setFormData({
        name: product.name || '',
        description: product.description || '',
        price: product.price || '',
        unit: product.unit || 'kg',
        stock: product.stock || '',
        category: product.category || 'General',
        isActive: product.isActive ?? true
      })
      setImagePreview(product.imageUrl || null)
    } else {
      setEditingId(null)
      setFormData({
        name: '',
        description: '',
        price: '',
        unit: 'kg',
        stock: '',
        category: 'General',
        isActive: true
      })
      setImagePreview(null)
    }
    setImageFile(null)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingId(null)
    setImageFile(null)
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      let imageUrl = imagePreview

      // If a new file was selected, upload it first
      if (imageFile) {
        const formDataUpload = new FormData()
        formDataUpload.append('file', imageFile)
        const uploadRes = await api.post('/api/upload', formDataUpload, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        imageUrl = uploadRes.data.url
      }

      const payload = {
        name: formData.name,
        description: formData.description,
        price: Number(formData.price),
        unit: formData.unit,
        stock: Number(formData.stock),
        category: formData.category,
        isActive: formData.isActive,
        imageUrl: imageUrl
      }

      if (editingId) {
        await api.patch(`/api/products/${editingId}`, payload)
      } else {
        await api.post('/api/products', payload)
      }

      await fetchProducts()
      handleCloseModal()
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save product')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this product?')) return
    try {
      await api.delete(`/api/products/${id}`)
      await fetchProducts()
    } catch (err) {
      alert('Failed to delete product')
    }
  }

  const handleToggleStatus = async (product) => {
    try {
      await api.patch(`/api/products/${product.id}`, { isActive: !product.isActive })
      await fetchProducts()
    } catch (err) {
      alert('Failed to update status')
    }
  }

  const filteredProducts = products.filter(p => {
    // Search
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase())
    if (!matchesSearch) return false

    // Category Filter
    if (filterCategory !== 'all' && p.category !== filterCategory) return false

    // Stock Filter
    if (filterStock === 'out') {
      if (p.stock > 0) return false
    } else if (filterStock === 'low') {
      if (p.stock <= 0 || p.stock >= 10) return false
    } else if (filterStock === 'in') {
      if (p.stock < 10) return false
    }

    return true
  })

  // Get dynamic categories for filter dropdown
  const uniqueCategories = [...new Set(products.map(p => p.category).filter(Boolean))]

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [search, filterCategory, filterStock])

  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="page-title">Inventory Management</div>
          <div className="page-desc">Manage farm products, stock, and pricing</div>
        </div>
        <button className="btn-primary" onClick={() => handleOpenModal()} style={{ display: 'flex', gap: 8 }}>
          <Plus size={16} /> Add Product
        </button>
      </div>

      <TableFilter
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search products by name or category..."
        resultCount={filteredProducts.length}
        filters={[
          {
            key: 'category',
            label: 'All Categories',
            value: filterCategory,
            options: uniqueCategories.map(c => ({ label: c, value: c }))
          },
          {
            key: 'stock',
            label: 'All Stock',
            value: filterStock,
            options: [
              { label: 'In Stock (>10)', value: 'in' },
              { label: 'Low Stock (1-9)', value: 'low' },
              { label: 'Out of Stock (0)', value: 'out' }
            ]
          }
        ]}
        onFilterChange={(key, val) => {
          if (key === 'category') setFilterCategory(val)
          if (key === 'stock') setFilterStock(val)
        }}
      />

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-subtle)' }}>Loading products...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProducts.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-subtle)' }}>No products found.</td>
                  </tr>
                ) : (
                  paginatedProducts.map(product => (
                    <tr key={product.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {product.imageUrl ? (
                            <img src={product.imageUrl} alt={product.name} style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <ImageIcon size={20} color="var(--text-subtle)" />
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 600 }}>{product.name}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{product.unit}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.85rem', background: 'var(--bg)', padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)' }}>
                          {product.category}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--primary)' }}>
                        GHS {product.price?.toFixed(2)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {product.stock <= 0 ? (
                            <span style={{ color: 'var(--clr-danger-txt)', background: 'var(--clr-danger-bg)', padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600 }}>Out of Stock</span>
                          ) : product.stock < 10 ? (
                            <span style={{ color: 'var(--clr-warning-txt)', background: 'var(--clr-warning-bg)', padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600 }}>Low: {product.stock}</span>
                          ) : (
                            <span style={{ fontWeight: 600 }}>{product.stock}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <button 
                          onClick={() => handleToggleStatus(product)}
                          style={{ 
                            background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                            color: product.isActive ? 'var(--clr-success-txt)' : 'var(--text-subtle)',
                            fontSize: '0.85rem', fontWeight: 600
                          }}
                        >
                          {product.isActive ? <CheckCircle size={16} /> : <XCircle size={16} />}
                          {product.isActive ? 'Listed' : 'Unlisted'}
                        </button>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <button className="btn-outline" style={{ padding: 6 }} onClick={() => handleOpenModal(product)}>
                            <Edit2 size={16} />
                          </button>
                          <button className="btn-outline" style={{ padding: 6, color: 'var(--clr-danger-txt)', borderColor: 'var(--clr-danger-bg)' }} onClick={() => handleDelete(product.id)}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
        {!loading && filteredProducts.length > itemsPerPage && (
          <div style={{ padding: '0 16px' }}>
            <Pagination 
              currentPage={currentPage}
              totalItems={filteredProducts.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 500 }}>
            <h2 className="modal-title">{editingId ? 'Edit Product' : 'Add New Product'}</h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Product Name</label>
                  <input className="form-input" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Large Eggs Crate" />
                </div>
                <div style={{ width: 140 }}>
                  <label className="form-label">Category</label>
                  <select className="form-input" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                    <option value="Eggs">Eggs</option>
                    <option value="Poultry Meat">Poultry Meat</option>
                    <option value="Live Birds">Live Birds</option>
                    <option value="Farm Inputs">Farm Inputs</option>
                    <option value="General">General</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">Description</label>
                <textarea className="form-input" rows="2" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Brief description..." />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Price (GHS)</label>
                  <input type="number" step="0.01" className="form-input" required value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} placeholder="0.00" />
                </div>
                <div>
                  <label className="form-label">Stock Quantity</label>
                  <input type="number" className="form-input" required value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} placeholder="0" />
                </div>
                <div>
                  <label className="form-label">Unit</label>
                  <input type="text" className="form-input" required value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} placeholder="e.g. crate, kg" />
                </div>
              </div>

              <div>
                <label className="form-label">Product Image</label>
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
                  ) : (
                    <div style={{ width: 80, height: 80, background: 'var(--bg)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border)' }}>
                      <ImageIcon size={24} color="var(--text-subtle)" />
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'block', width: '100%', padding: '8px 0' }} />
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Upload a square image (e.g. 500x500px).</div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <input type="checkbox" id="isActive" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} style={{ width: 16, height: 16 }} />
                <label htmlFor="isActive" style={{ fontSize: '0.9rem', cursor: 'pointer' }}>Visible on Marketplace</label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
                <button type="button" className="btn-outline" onClick={handleCloseModal}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Product'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  )
}
