import React, { useState } from 'react';
import { ShoppingCart, ShoppingBag, MapPin, X, Minus, Plus, CheckCircle2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useCart } from '../context/CartContext';

const PAYMENT_OPTIONS = [
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  { value: 'PAY_ON_DELIVERY', label: 'Payment on Delivery' },
];

function formatApiError(err, fallback) {
  const data = err.response?.data;
  if (!data) return fallback;
  
  // Handle Zod validation errors: { errors: { field: [messages] } }
  if (data.errors) {
    const messages = Object.entries(data.errors)
      .flatMap(([field, values]) => (values || []).map(message => `${field.replaceAll('_', ' ')}: ${message}`));
    if (messages.length) return messages.join(' ');
  }
  
  // Handle both { message: "..." } and { error: "..." } response shapes
  return data.message || data.error || fallback;
}

export default function CartDrawer() {
  const navigate = useNavigate();
  const { cartItems, cartTotal, addToCart, removeFromCart, clearCart, isCartOpen, setIsCartOpen } = useCart();
  
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [address, setAddress] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('PAY_ON_DELIVERY');
  const [notes, setNotes] = useState('');
  const [coords, setCoords] = useState(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (cartItems.length === 0) return alert('Your cart is empty!');
    
    setSubmitting(true);
    try {
      const orderPromises = cartItems.map(item => {
        return api.post('/api/orders', {
          productId: item.product.id,
          quantity: item.quantity,
          deliveryDate: new Date(deliveryDate).toISOString(),
          address,
          contactNumber,
          paymentMethod,
          notes,
          deliveryLatitude: coords?.latitude,
          deliveryLongitude: coords?.longitude,
        });
      });
      
      const results = await Promise.all(orderPromises);
      
      setOrderSuccess(results[0].data.order.orderId);
      clearCart();
      setDeliveryDate(new Date().toISOString().split('T')[0]);
      setAddress('');
      setContactNumber('');
      setPaymentMethod('PAY_ON_DELIVERY');
      setNotes('');
      setCoords(null);
    } catch (err) {
      alert('Checkout failed: ' + formatApiError(err, err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const reverseGeocodeGoogle = async (latitude, longitude) => {
    try {
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      if (!apiKey) return null;
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === 'OK' && data.results.length > 0) {
        return data.results[0].formatted_address;
      }
      return null;
    } catch {
      return null;
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Location is not supported by this browser.');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const latitude = pos.coords.latitude;
        const longitude = pos.coords.longitude;
        setCoords({ latitude, longitude });

        if (!address.trim()) {
          const readable = await reverseGeocodeGoogle(latitude, longitude);
          if (readable) setAddress(readable);
        }
        setLocating(false);
      },
      () => {
        setLocating(false);
        alert('Could not get your current location. Please allow location access or enter your address.');
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  if (orderSuccess) {
    return (
      <div className={`cart-overlay ${isCartOpen ? 'open' : ''}`} onClick={() => { setIsCartOpen(false); setOrderSuccess(null); }}>
        <div className={`cart-drawer ${isCartOpen ? 'open' : ''}`} onClick={e => e.stopPropagation()} style={{ padding: '40px 20px', textAlign: 'center' }}>
          <CheckCircle2 size={56} color="var(--primary)" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '1.5rem', marginBottom: 8 }}>Order Placed!</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>Your order has been received and will be processed soon.</p>
          <div style={{ background: 'var(--bg)', padding: 16, borderRadius: 8, marginBottom: 24, fontSize: '0.85rem' }}>
            Reference ID: <strong>{orderSuccess}</strong>
          </div>
          <button className="btn-primary" style={{ width: '100%', padding: '14px', justifyContent: 'center', fontSize: '1rem' }} onClick={() => { setIsCartOpen(false); setOrderSuccess(null); navigate('/customer/orders'); }}>
            View My Orders
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`cart-overlay ${isCartOpen ? 'open' : ''}`} onClick={() => setIsCartOpen(false)}>
      <div className={`cart-drawer ${isCartOpen ? 'open' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="cart-drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
            <ShoppingCart size={18} color="var(--primary)" /> Your Cart
          </div>
          <button className="close-btn" onClick={() => setIsCartOpen(false)}>
            <X size={20} />
          </button>
        </div>
        
        <div className="cart-drawer-body">
          {cartItems.length === 0 ? (
            <div className="empty-cart">
              <ShoppingBag size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
              <div>Your cart is empty<br/>Add some products to get started</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {cartItems.map(item => (
                  <div key={item.product.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-heading)' }}>{item.product.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>GHS {item.product.price} / {item.product.unit}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>GHS {(item.product.price * item.quantity).toFixed(2)}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg)', borderRadius: 6, padding: 2 }}>
                        <button type="button" onClick={() => removeFromCart(item.product.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}><Minus size={14}/></button>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, minWidth: 16, textAlign: 'center' }}>{item.quantity}</span>
                        <button type="button" onClick={() => addToCart(item.product)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}><Plus size={14}/></button>
                      </div>
                    </div>
                  </div>
                ))}

                <div style={{ marginTop: 20, paddingTop: 16, borderTop: '2px dashed var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Subtotal</div>
                    <div style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--text-heading)' }}>GHS {cartTotal.toFixed(2)}</div>
                  </div>
                </div>

                <form id="checkout-form" onSubmit={handleCheckout}>
                  <div className="form-group">
                    <label className="form-label">Delivery Date *</label>
                    <input required type="date" className="form-input" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Delivery Address *</label>
                    <textarea required className="form-input" rows={2} value={address} onChange={e => setAddress(e.target.value)} placeholder="Full street address" />
                  </div>
                  <div className="form-group">
                    <button type="button" className="btn-outline" style={{ width: '100%', justifyContent: 'center' }} onClick={useCurrentLocation} disabled={locating}>
                      <MapPin size={14} />
                      {locating ? 'Getting accurate location...' : coords ? 'Location attached' : 'Use my current location'}
                    </button>
                    {coords && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', marginTop: 6, textAlign: 'center' }}>
                        {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
                      </div>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Contact Number *</label>
                    <input required type="tel" className="form-input" value={contactNumber} onChange={e => setContactNumber(e.target.value)} placeholder="+233 XX XXX XXXX" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Payment Option *</label>
                    <select required className="form-select" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                      {PAYMENT_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Notes (Optional)</label>
                    <textarea className="form-input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Delivery instructions" />
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>

        {cartItems.length > 0 && (
          <div className="cart-drawer-footer">
            <button type="submit" form="checkout-form" className="btn-primary" style={{ width: '100%', padding: '14px', fontSize: '1rem', justifyContent: 'center' }} disabled={submitting}>
              {submitting ? 'Processing...' : `Checkout (GHS ${cartTotal.toFixed(2)})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
