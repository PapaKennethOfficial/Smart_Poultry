import codecs
import re

with codecs.open('smartpoultry-admin/src/pages/Logbook.jsx', 'r', 'utf-8') as f:
    content = f.read()

target = '''                      <td>
                        <span className={adge }>
                          {batchName}
                        </span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{entry.feedConsumption}</td>'''

replacement = '''                      <td>
                        <span className={adge }>
                          {batchName}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600 }}>{entry.loggedBy?.name || 'Unknown'}</div>
                        <div style={{ color: '#8da58f', fontSize: '0.7rem' }}>Sys: {new Date(entry.createdAt).toLocaleString()}</div>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{entry.feedConsumption}</td>'''

content = content.replace(target, replacement)

with codecs.open('smartpoultry-admin/src/pages/Logbook.jsx', 'w', 'utf-8') as f:
    f.write(content)
