import codecs
import re

with codecs.open('smartpoultry-admin/src/pages/Financials.jsx', 'r', 'utf-8') as f:
    content = f.read()

expense_replacement = '''
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
'''
content = re.sub(r'  const handleSubmit = \(e\) => \{.*?\n    mutation\.mutate\(\{.*?\}\);\n  \};\n', expense_replacement.strip() + '\n', content, flags=re.DOTALL)

expense_ui = '''          <div className=\"form-group\">
            <label className=\"form-label\">Description {isOther && <span style={{color: 'red'}}>*</span>}</label>
            {isOther ? (
              <textarea className=\"form-input\" style={{minHeight: '80px', padding: '10px'}} name=\"description\" value={formData.description} onChange={handleChange} placeholder=\"Please specify the expense details...\" required={isOther} />
            ) : (
              <input className=\"form-input\" type=\"text\" name=\"description\" value={formData.description} onChange={handleChange} placeholder=\"e.g. Bought 10 bags of grower mash\" />
            )}
          </div>'''
content = re.sub(r'          <div className=\"form-group\">\s*<label className=\"form-label\">Description</label>\s*<input className=\"form-input\" type=\"text\" name=\"description\" value=\{formData\.description\} onChange=\{handleChange\} placeholder=\"e\.g\. Bought 10 bags of grower mash\" />\s*</div>', expense_ui, content)

walkin_modal = '''function RecordOfflineSaleModal({ onClose, refetch }) {
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
    const constructedNotes = ${formData.quantity}x  @ GH₵/ea. Customer: . ;
    
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
}'''

content = re.sub(r'function RecordOfflineSaleModal.*?(?=\nexport default function Financials)', walkin_modal + '\n', content, flags=re.DOTALL)

with codecs.open('smartpoultry-admin/src/pages/Financials.jsx', 'w', 'utf-8') as f:
    f.write(content)
