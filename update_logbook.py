import codecs
import re

with codecs.open('smartpoultry-admin/src/pages/Logbook.jsx', 'r', 'utf-8') as f:
    content = f.read()

# Add eggUnit state
state_replacement = '''
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    batchId: '',
    feedConsumption: '',
    eggsCount: '',
    eggUnit: 'units', // 'units' or 'crates'
'''
content = re.sub(r'  const \[formData, setFormData\] = useState\(\{.*?feedConsumption: \'\',\n    eggsCount: \'\',', state_replacement.strip(), content, flags=re.DOTALL)

# Update payload to multiply by 30 if crates
payload_replacement = '''
      feedConsumption: Number(formData.feedConsumption || 0),
      eggsCount: hasEggs ? (formData.eggUnit === 'crates' ? Number(formData.eggsCount || 0) * 30 : Number(formData.eggsCount || 0)) : 0,
      birdsBought: Number(formData.birdsBought || 0),
'''
content = re.sub(r'      feedConsumption: Number\(formData\.feedConsumption \|\| 0\),\n      eggsCount: hasEggs \? Number\(formData\.eggsCount \|\| 0\) : 0,\n      birdsBought: Number\(formData\.birdsBought \|\| 0\),', payload_replacement.strip(), content)


# Update Egg Count UI
egg_ui_replacement = '''
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Egg Collection</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input className="form-input" type="number" step="any" name="eggsCount" value={formData.eggsCount} onChange={handleChange} placeholder={formData.eggUnit === 'crates' ? "e.g. 40 crates" : "e.g. 1200 eggs"} style={{ flex: 1 }} />
                    <select className="form-select" name="eggUnit" value={formData.eggUnit} onChange={handleChange} style={{ width: '100px' }}>
                      <option value="units">Eggs</option>
                      <option value="crates">Crates</option>
                    </select>
                  </div>
                  {formData.eggUnit === 'crates' && formData.eggsCount > 0 && (
                     <div style={{ fontSize: '0.75rem', color: '#5e7a61', marginTop: 4 }}>
                       = {Number(formData.eggsCount) * 30} individual eggs
                     </div>
                  )}
                  {errors.eggsCount && <div style={{ color: 'red', fontSize: '0.75rem', marginTop: '4px' }}>{errors.eggsCount}</div>}
                </div>
'''
content = re.sub(r'                <div className=\"form-group\" style=\{\{ marginBottom: 0 \}\}>\s*<label className=\"form-label\">Egg Count</label>\s*<input className=\"form-input\" type=\"number\" name=\"eggsCount\" value=\{formData\.eggsCount\} onChange=\{handleChange\} placeholder=\"e\.g\. 1200\" />\s*\{errors\.eggsCount && <div style=\{\{ color: \'red\', fontSize: \'0\.75rem\', marginTop: \'4px\' \}\}>\{errors\.eggsCount\}</div>\}\s*</div>', egg_ui_replacement.strip(), content, flags=re.DOTALL)


with codecs.open('smartpoultry-admin/src/pages/Logbook.jsx', 'w', 'utf-8') as f:
    f.write(content)
