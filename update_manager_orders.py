import codecs
import re

with codecs.open('smartpoultry-admin/src/pages/ManagerOrders.jsx', 'r', 'utf-8') as f:
    content = f.read()

stats_replacement = '''
  const total = orders.length
  const pending = orders.filter(o => o.status === 'PENDING').length
  const inTransit = orders.filter(o => o.status === 'IN_TRANSIT').length
  const delivered = orders.filter(o => o.status === 'DELIVERED').length
  const walkInSales = orders.filter(o => o.paymentMethod === 'CASH_AT_FARM').length
'''
content = re.sub(r'  const total = orders\.length.*?const delivered = orders\.filter\(o => o\.status === \'DELIVERED\'\)\.length', stats_replacement.strip(), content, flags=re.DOTALL)

grid_replacement = '''
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard label="Total Orders" value={total} icon={ShoppingBag} iconColor="#84be88" accent="#84be88" />
        <StatCard label="Pending" value={pending} icon={Clock} iconColor="#f59e0b" accent="#f59e0b" />
        <StatCard label="In Transit" value={inTransit} icon={Truck} iconColor="#3b82f6" accent="#3b82f6" />
        <StatCard label="Delivered" value={delivered} icon={CheckCircle2} iconColor="#237227" accent="#237227" />
        <StatCard label="Walk-in Sales" value={walkInSales} icon={ShoppingBag} iconColor="#e53e3e" accent="#e53e3e" />
      </div>
'''
content = re.sub(r'      <div style=\{\{ display: \'grid\', gridTemplateColumns: \'repeat\(4, 1fr\)\', gap: 14, marginBottom: 24 \}\}>.*?</div>\n', grid_replacement.strip() + '\n\n', content, flags=re.DOTALL)

get_order_title_replacement = '''
  const getOrderTitle = (o) => {
    if (o.paymentMethod === 'CASH_AT_FARM') {
      const match = o.notes?.match(/x (.*?) @/);
      return match ? match[1] : (o.notes?.split('. ')[0] || 'Walk-in Sale');
    }
    if (o.items && o.items.length > 0) {
      if (o.items.length === 1) return o.items[0].product?.name || 'Unknown Product';
      return ${o.items[0].product?.name || 'Item'} +  more;
    }
    return o.product?.name || 'Unknown Product';
  }

  const getCustomerName = (o) => {
    if (o.paymentMethod === 'CASH_AT_FARM') {
      const match = o.notes?.match(/Customer: (.*?)\./);
      return match ? match[1] : 'Walk-in Customer';
    }
    return o.customer?.name || 'Unknown Customer';
  }
  
  const getCustomerContact = (o) => {
    if (o.paymentMethod === 'CASH_AT_FARM') {
      return 'Walk-in (No Phone)';
    }
    return o.contactNumber || o.customer?.phone || o.customer?.email || 'N/A';
  }
'''
content = re.sub(r'  const getOrderTitle = \(o\) => \{.*?\n  \}', get_order_title_replacement.strip(), content, flags=re.DOTALL)

content = content.replace('o.customer?.name', 'getCustomerName(o)')
content = content.replace('{o.contactNumber || o.customer?.phone || o.customer?.email}', '{getCustomerContact(o)}')
content = content.replace('selectedOrder.customer?.name', 'getCustomerName(selectedOrder)')
content = content.replace('{selectedOrder.contactNumber || selectedOrder.customer?.phone || \'N/A\'}', '{getCustomerContact(selectedOrder)}')

with codecs.open('smartpoultry-admin/src/pages/ManagerOrders.jsx', 'w', 'utf-8') as f:
    f.write(content)
