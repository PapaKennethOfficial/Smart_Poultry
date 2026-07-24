import { createContext, useContext, useState } from 'react';

const CartContext = createContext();

export function CartProvider({ children }) {
  // cart is now { productId: { product, quantity } }
  const [cart, setCart] = useState({}); 
  const [isCartOpen, setIsCartOpen] = useState(false);

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev[product.id];
      return {
        ...prev,
        [product.id]: {
          product,
          quantity: existing ? existing.quantity + 1 : 1
        }
      };
    });
  };

  const removeFromCart = (productId) => {
    setCart(prev => {
      const existing = prev[productId];
      if (!existing) return prev;
      
      const newCart = { ...prev };
      if (existing.quantity > 1) {
        newCart[productId] = { ...existing, quantity: existing.quantity - 1 };
      } else {
        delete newCart[productId];
      }
      return newCart;
    });
  };

  const clearCart = () => {
    setCart({});
  };

  const toggleCart = () => setIsCartOpen(!isCartOpen);

  // Derived state
  const cartItems = Object.values(cart);
  const cartCount = cartItems.length;
  const cartTotal = cartItems.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

  return (
    <CartContext.Provider value={{
      cart,
      cartItems,
      cartCount,
      cartTotal,
      addToCart,
      removeFromCart,
      clearCart,
      isCartOpen,
      setIsCartOpen,
      toggleCart
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
