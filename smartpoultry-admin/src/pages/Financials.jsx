import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/axios';
import { useToast } from '../components/Toast';
import { Plus, X, Search, Loader2 } from 'lucide-react';
import Pagination from '../components/Pagination';

const PAGE_SIZE = 10;

function AddExpenseModal({ onClose, refetch }) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  const [formData, setFormData] = useState({
    amount: '',
    category: 'Feed',
    description: '',
    date: new Date().toISOString().split('T')[0],
  });

  const mutation = useMutation({
    mutationFn: (newExpense) => api.post('/api/expenses', newExpense),
    onSuccess: () => {
      showSuccess('Expense logged successfully');
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      refetch();
      onClose();
    },
    onError: (err) => {
      showError(err.response?.data?.error || 'Failed to log expense');
    }
  });

const isOther = formData.category === 'Other';

  const handleSubmit = (e) => {
    e.preventDefault();
    if (Number(formData.amount) <= 0) {
      showError('Amount must be greater than zero');
      return;
    }
    if (isOther && !formData.description.trim()) {
      showError('Please provide a description for the Other category');
      return;
    }
    mutation.mutate({
      ...formData,
      amount: Number(formData.amount)
    });
  };

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box" style={{ maxWidth: '500px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
          <div>
            <div className="modal-title">Record Farm Expense</div>
            <div className="modal-subtitle">Log operational spending</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8da58f' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Date</label>
            <input className="form-input" type="date" name="date" value={formData.date} onChange={handleChange} required />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Amount (GH₵)</label>
              <input className="form-input" type="number" step="any" name="amount" value={formData.amount} onChange={handleChange} required placeholder="e.g. 500" />
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-select" name="category" value={formData.category} onChange={handleChange} required>
                <option value="Feed">Feed</option>
                <option value="Medical">Medical / Vet</option>
                <option value="Maintenance">Maintenance / Equipment</option>
                <option value="Labor">Labor / Salaries</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Description (Optional)</label>
            <input className="form-input" type="text" name="description" value={formData.description} onChange={handleChange} placeholder="e.g. Bought 10 bags of grower mash" />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : 'Save Expense'}
            </button>
            <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RecordOfflineSaleModal({ onClose, refetch }) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  const [formData, setFormData] = useState({
    customerName: '',
    itemType: 'Eggs (Crates)',
    quantity: '',
    unitPrice: '',
    totalAmount: '',
    additionalNotes: '',
  });

  const mutation = useMutation({
    mutationFn: (newSale) => api.post('/api/orders/walk-in', newSale),
    onSuccess: () => {
      showSuccess('Walk-in sale recorded');
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      refetch();
      onClose();
    },
    onError: (err) => {
      showError(err.response?.data?.error || 'Failed to record sale');
    }
  });

  const handleQuantityPriceChange = (e) => {
    const { name, value } = e.target;
    const newFormData = { ...formData, [name]: value };
    
    // Auto calculate total
    const q = parseFloat(newFormData.quantity || 0);
    const p = parseFloat(newFormData.unitPrice || 0);
    if (q > 0 && p > 0) {
      newFormData.totalAmount = (q * p).toFixed(2);
    }
    setFormData(newFormData);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (Number(formData.totalAmount) <= 0) {
      showError('Total amount must be greater than zero');
      return;
    }
    
    // Construct detailed notes
    const constructedNotes = `${formData.quantity}x ${formData.itemType} @ GH₵${formData.unitPrice}/ea. Customer: ${formData.customerName || 'Walk-in'}. ${formData.additionalNotes ? 'Notes: ' + formData.additionalNotes : ''}`;
    
    mutation.mutate({
      amount: Number(formData.totalAmount),
      notes: constructedNotes
    });
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box" style={{ maxWidth: '550px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
          <div>
            <div className="modal-title">Record Walk-in Sale</div>
            <div className="modal-subtitle">Log cash sales at the farm gate</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8da58f' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Customer Name / Reference (Optional)</label>
            <input className="form-input" type="text" name="customerName" value={formData.customerName} onChange={(e) => setFormData({...formData, customerName: e.target.value})} placeholder="e.g. John from Market" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Item Sold</label>
              <select className="form-select" name="itemType" value={formData.itemType} onChange={(e) => setFormData({...formData, itemType: e.target.value})}>
                <option value="Eggs (Crates)">Eggs (Crates)</option>
                <option value="Eggs (Units)">Eggs (Units)</option>
                <option value="Live Birds (Broilers)">Live Birds (Broilers)</option>
                <option value="Live Birds (Spent Layers)">Live Birds (Spent Layers)</option>
                <option value="Manure (Bags)">Manure (Bags)</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Quantity</label>
              <input className="form-input" type="number" step="any" name="quantity" value={formData.quantity} onChange={handleQuantityPriceChange} required placeholder="e.g. 10" />
            </div>
            <div className="form-group">
              <label className="form-label">Unit Price</label>
              <input className="form-input" type="number" step="any" name="unitPrice" value={formData.unitPrice} onChange={handleQuantityPriceChange} required placeholder="GH₵" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Total Amount (GH₵)</label>
            <input className="form-input" type="number" step="any" name="totalAmount" value={formData.totalAmount} onChange={(e) => setFormData({...formData, totalAmount: e.target.value})} required style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#237227' }} />
          </div>

          <div className="form-group">
            <label className="form-label">Additional Notes</label>
            <input className="form-input" type="text" name="additionalNotes" value={formData.additionalNotes} onChange={(e) => setFormData({...formData, additionalNotes: e.target.value})} placeholder="Any extra details..." />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : 'Record Sale'}
            </button>
            <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Financials() {
  const [activeTab, setActiveTab] = useState('expenses');
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [page, setPage] = useState(1);

  // Fetch Expenses
  const { data: expensesData, isLoading: loadingExpenses, refetch: refetchExpenses } = useQuery({
    queryKey: ['expenses', page],
    queryFn: async () => {
      const res = await api.get(`/api/expenses?page=${page}&limit=${PAGE_SIZE}`);
      return res.data;
    },
    enabled: activeTab === 'expenses'
  });

  const expenses = expensesData?.data || [];
  
  // Quick summation for current page (In a real app, backend provides totals)
  let currentViewExpenses = 0;
  expenses.forEach(e => currentViewExpenses += e.amount);

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="page-title">Farm Financials</div>
            <div className="page-desc">Track operational expenses and offline sales</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-outline" onClick={() => setShowSaleModal(true)}>
              <Plus size={15} />
              Walk-in Sale
            </button>
            <button className="btn-primary" onClick={() => setShowExpenseModal(true)}>
              <Plus size={15} />
              Record Expense
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 18 }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: '15px 18px', border: '1px solid #dddabd' }}>
          <div style={{ fontSize: '0.68rem', color: '#8da58f', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>
            Current View Expenses
          </div>
          <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.35rem', fontWeight: 700, color: '#e53e3e', margin: '4px 0 2px' }}>
            GH₵ {currentViewExpenses.toLocaleString()}
          </div>
        </div>
      </div>

      <div className="chart-card">
        <div className="chart-header">
          <div>
            <div className="chart-title">Financial Records</div>
          </div>
          <div className="filter-tabs">
            <button className={`filter-tab${activeTab === 'expenses' ? ' active' : ''}`} onClick={() => { setActiveTab('expenses'); setPage(1); }}>
              Expenses
            </button>
          </div>
        </div>

        <div className="table-wrapper">
          {activeTab === 'expenses' && (
            loadingExpenses ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#8da58f' }}><Loader2 size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 10px' }} /> Loading expenses...</div>
            ) : expenses.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#8da58f' }}>No expenses recorded yet.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Logged By</th>
                    <th>Amount (GH₵)</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map(exp => (
                    <tr key={exp.id}>
                      <td style={{ color: '#5e7a61' }}>{new Date(exp.date).toLocaleDateString()}</td>
                      <td><span className="badge badge-gray">{exp.category}</span></td>
                      <td>{exp.description || '-'}</td>
                      <td>{exp.loggedBy?.name || '-'}</td>
                      <td style={{ fontWeight: 600, color: '#e53e3e' }}>{exp.amount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>

        {activeTab === 'expenses' && expensesData?.meta && (
          <div style={{ padding: '0 16px' }}>
            <Pagination currentPage={page} totalItems={expensesData.meta.total} itemsPerPage={PAGE_SIZE} onPageChange={setPage} />
          </div>
        )}
      </div>

      {showExpenseModal && <AddExpenseModal onClose={() => setShowExpenseModal(false)} refetch={refetchExpenses} />}
      {showSaleModal && <RecordOfflineSaleModal onClose={() => setShowSaleModal(false)} refetch={() => {}} />}
    </div>
  );
}
