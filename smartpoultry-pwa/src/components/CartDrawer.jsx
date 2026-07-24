import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ShoppingCart, ShoppingBag, MapPin, X, Minus, Plus, CheckCircle2, Search, Crosshair } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useCart } from '../context/CartContext';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';

const PAYMENT_OPTIONS = [
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  { value: 'PAY_ON_DELIVERY', label: 'Payment on Delivery' },
];

const GOOGLE_MAPS_LIBRARIES = ['places'];

// Default center — Accra, Ghana
const DEFAULT_CENTER = { lat: 5.6037, lng: -0.1870 };

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

// ─── Places Autocomplete Input ─────────────────────────────────────────────────
function PlacesAutocomplete({ value, onChange, onSelect, isLoaded }) {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);

  useEffect(() => {
    if (!isLoaded || !inputRef.current || autocompleteRef.current) return;

    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: 'gh' },
      fields: ['formatted_address', 'geometry'],
    });

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (!place.geometry) return;

      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      const addr = place.formatted_address || '';

      onSelect({ latitude: lat, longitude: lng, address: addr });
    });

    autocompleteRef.current = autocomplete;
  }, [isLoaded, onSelect]);

  return (
    <div style={{ position: 'relative' }}>
      <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)', pointerEvents: 'none' }} />
      <input
        ref={inputRef}
        type="text"
        className="form-input"
        style={{ paddingLeft: 34 }}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Search address or place name..."
      />
    </div>
  );
}

// ─── Location Map Preview ──────────────────────────────────────────────────────
function LocationMapPreview({ coords, onMarkerDragEnd, isLoaded }) {
  const [map, setMap] = useState(null);
  const center = coords
    ? { lat: coords.latitude, lng: coords.longitude }
    : DEFAULT_CENTER;

  const onLoad = useCallback((mapInstance) => {
    setMap(mapInstance);
  }, []);

  // Re-center map when coords change
  useEffect(() => {
    if (map && coords) {
      map.panTo({ lat: coords.latitude, lng: coords.longitude });
    }
  }, [map, coords]);

  if (!isLoaded) {
    return (
      <div style={{
        height: 180, background: 'var(--bg)', borderRadius: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '1px solid var(--border-light)', fontSize: '0.8rem', color: 'var(--text-subtle)',
      }}>
        Loading map...
      </div>
    );
  }

  return (
    <div style={{ height: 180, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-light)' }}>
      <GoogleMap
        mapContainerStyle={{ height: '100%', width: '100%' }}
        center={center}
        zoom={coords ? 16 : 12}
        onLoad={onLoad}
        options={{
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'greedy',
        }}
      >
        {coords && (
          <Marker
            position={{ lat: coords.latitude, lng: coords.longitude }}
            draggable
            onDragEnd={(e) => {
              const lat = e.latLng.lat();
              const lng = e.latLng.lng();
              onMarkerDragEnd(lat, lng);
            }}
            icon={{
              path: window.google.maps.SymbolPath.CIRCLE,
              fillColor: '#237227',
              fillOpacity: 1,
              strokeColor: '#fff',
              strokeWeight: 2.5,
              scale: 12,
            }}
          />
        )}
      </GoogleMap>
    </div>
  );
}

// ─── Main CartDrawer Component ─────────────────────────────────────────────────
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

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

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

        const readable = await reverseGeocodeGoogle(latitude, longitude);
        if (readable) setAddress(readable);
        setLocating(false);
      },
      () => {
        setLocating(false);
        alert('Could not get your current location. Please allow location access or enter your address.');
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const handleMarkerDragEnd = async (lat, lng) => {
    setCoords({ latitude: lat, longitude: lng });
    const readable = await reverseGeocodeGoogle(lat, lng);
    if (readable) setAddress(readable);
  };

  const handlePlaceSelect = useCallback(({ latitude, longitude, address: addr }) => {
    setCoords({ latitude, longitude });
    setAddress(addr);
  }, []);

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

                  {/* ── Delivery Location Section ────────────────────────── */}
                  <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <MapPin size={14} color="var(--primary)" />
                      Delivery Location *
                    </label>

                    {/* Google Places Autocomplete */}
                    <PlacesAutocomplete
                      value={address}
                      onChange={setAddress}
                      onSelect={handlePlaceSelect}
                      isLoaded={isLoaded}
                    />
                  </div>

                  <div className="form-group">
                    <button
                      type="button"
                      className="btn-outline"
                      style={{
                        width: '100%',
                        justifyContent: 'center',
                        gap: 8,
                        padding: '10px 16px',
                        borderRadius: 8,
                      }}
                      onClick={useCurrentLocation}
                      disabled={locating}
                    >
                      <Crosshair size={14} />
                      {locating
                        ? 'Getting accurate location...'
                        : coords
                          ? '✓ Location attached — tap to refresh'
                          : 'Use my current location'}
                    </button>
                  </div>

                  {/* Interactive Map Preview */}
                  {coords && (
                    <div className="form-group">
                      <LocationMapPreview
                        coords={coords}
                        onMarkerDragEnd={handleMarkerDragEnd}
                        isLoaded={isLoaded}
                      />
                      <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        marginTop: 6, fontSize: '0.72rem', color: 'var(--text-subtle)',
                      }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#237227' }} />
                          Delivery pin — drag to adjust
                        </span>
                        <span>
                          {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
                        </span>
                      </div>
                    </div>
                  )}

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
