import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useSettings } from './SettingsContext';
import { getDB } from '@/lib/database';
import type { OrderLine, Promotion, OrderType, Order } from '@/lib/database';

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface CartItem extends OrderLine {}

export interface OrderDraft {
  id: string;
  name: string;
  type: OrderType;
  cart: CartItem[];
  appliedPromo: Promotion | null;
  createdAt: number;
  deliveryAddress?: string;
  deliveryPhone?: string;
  deliveryCustomerName?: string;
}

interface CartContextType {
  orderDrafts: OrderDraft[];
  activeOrderId: string | null;
  setActiveOrderId: (id: string | null) => void;
  pendingCartItem: CartItem | null;
  setPendingCartItem: (item: CartItem | null) => void;
  subtotal: number;
  discount: number;
  total: number;
  appliedPromo: Promotion | null;
  currentOrder: Order | null;
  createNewDraft: (name?: string, type?: OrderType, deliveryInfo?: { address: string; phone: string; customerName: string }) => OrderDraft;
  createDraftWithType: (type: OrderType, item?: CartItem, deliveryInfo?: { address: string; phone: string; customerName: string }) => OrderDraft;
  updateDraftType: (draftId: string, type: OrderType, deliveryInfo?: { address: string; phone: string; customerName: string }) => void;
  deleteDraft: (draftId: string) => void;
  addToCart: (item: CartItem) => void;
  updateCartItem: (itemId: string, updates: Partial<CartItem>) => void;
  removeFromCart: (itemId: string) => void;
  clearCart: (draftId?: string) => void;
  applyPromoCode: (code: string) => Promise<{ success: boolean; message: string }>;
  removePromo: () => void;
  generateOrderNumber: () => Promise<string>;
  createOrder: () => Promise<Order>;
  removeEmptyDraftAfterPayment: () => void;
}

const CartContext = createContext<CartContextType | null>(null);

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { t, currency } = useSettings();

  const [orderDrafts, setOrderDrafts] = useState<OrderDraft[]>([]);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [pendingCartItem, setPendingCartItem] = useState<CartItem | null>(null);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);

  // Computed totals from active draft
  const activeDraft = orderDrafts.find(d => d.id === activeOrderId) || orderDrafts[0] || null;

  const subtotal = (activeDraft?.cart || []).reduce((sum, item) => {
    const itemTotal = item.unitPrice * item.quantity;
    const modsTotal = item.modifiers.reduce((m, mod) => m + mod.priceAdjustment, 0) * item.quantity;
    return sum + itemTotal + modsTotal;
  }, 0);

  const discount = activeDraft?.appliedPromo
    ? activeDraft.appliedPromo.type === 'percent'
      ? subtotal * (activeDraft.appliedPromo.value / 100)
      : activeDraft.appliedPromo.type === 'fixed'
        ? activeDraft.appliedPromo.value
        : 0
    : 0;

  const total = Math.max(0, subtotal - discount);
  const appliedPromo = activeDraft?.appliedPromo || null;

  const addToCart = useCallback((item: CartItem) => {
    setOrderDrafts(prev => {
      if (prev.length === 0) {
        setPendingCartItem(item);
        return prev;
      }
      const activeId = activeOrderId ?? prev[0]?.id ?? null;
      if (!activeId) return prev;
      return prev.map(d => d.id === activeId
        ? { ...d, cart: [...d.cart, { ...item, id: generateUUID() }] }
        : d
      );
    });
  }, [activeOrderId]);

  const createNewDraft = useCallback((name?: string, type: OrderType = 'dine-in', deliveryInfo?: { address: string; phone: string; customerName: string }): OrderDraft => {
    const maxNum = orderDrafts.reduce((max, d) => {
      const m = d.name.match(/Commande (\d+)/);
      return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    const newDraft: OrderDraft = {
      id: generateUUID(),
      name: name || `Commande ${maxNum + 1}`,
      type,
      cart: [],
      appliedPromo: null,
      createdAt: Date.now(),
      ...(type === 'delivery' && deliveryInfo && {
        deliveryAddress: deliveryInfo.address,
        deliveryPhone: deliveryInfo.phone,
        deliveryCustomerName: deliveryInfo.customerName,
      }),
    };
    setOrderDrafts(prev => [...prev, newDraft]);
    setActiveOrderId(newDraft.id);
    return newDraft;
  }, [orderDrafts]);

  const createDraftWithType = useCallback((type: OrderType, item?: CartItem, deliveryInfo?: { address: string; phone: string; customerName: string }): OrderDraft => {
    const maxNum = orderDrafts.reduce((max, d) => {
      const m = d.name.match(/Commande (\d+)/);
      return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    const newDraft: OrderDraft = {
      id: generateUUID(),
      name: `Commande ${maxNum + 1}`,
      type,
      cart: item ? [{ ...item, id: generateUUID() }] : [],
      appliedPromo: null,
      createdAt: Date.now(),
      ...(type === 'delivery' && deliveryInfo && {
        deliveryAddress: deliveryInfo.address,
        deliveryPhone: deliveryInfo.phone,
        deliveryCustomerName: deliveryInfo.customerName,
      }),
    };
    setOrderDrafts(prev => [...prev, newDraft]);
    setActiveOrderId(newDraft.id);
    setPendingCartItem(null);
    return newDraft;
  }, [orderDrafts]);

  const updateDraftType = useCallback((draftId: string, type: OrderType, deliveryInfo?: { address: string; phone: string; customerName: string }) => {
    setOrderDrafts(prev => prev.map(draft => {
      if (draft.id !== draftId) return draft;
      const updates: Partial<OrderDraft> = { type };
      if (type === 'delivery' && deliveryInfo) {
        updates.deliveryAddress = deliveryInfo.address;
        updates.deliveryPhone = deliveryInfo.phone;
        updates.deliveryCustomerName = deliveryInfo.customerName;
      } else if (type !== 'delivery') {
        updates.deliveryAddress = undefined;
        updates.deliveryPhone = undefined;
        updates.deliveryCustomerName = undefined;
      }
      return { ...draft, ...updates };
    }));
  }, []);

  const deleteDraft = useCallback((draftId: string) => {
    setOrderDrafts(prev => {
      const next = prev.filter(d => d.id !== draftId);
      if (activeOrderId === draftId) {
        setActiveOrderId(next.length > 0 ? next[0].id : null);
      }
      return next;
    });
  }, [activeOrderId]);

  const updateCartItem = useCallback((itemId: string, updates: Partial<CartItem>) => {
    setOrderDrafts(prev => prev.map(draft => {
      if (draft.id !== activeOrderId) return draft;
      return { ...draft, cart: draft.cart.map(item => item.id === itemId ? { ...item, ...updates } : item) };
    }));
  }, [activeOrderId]);

  const removeFromCart = useCallback((itemId: string) => {
    setOrderDrafts(prev => prev.map(draft => {
      if (draft.id !== activeOrderId) return draft;
      return { ...draft, cart: draft.cart.filter(item => item.id !== itemId) };
    }));
  }, [activeOrderId]);

  const clearCart = useCallback((draftId?: string) => {
    const id = draftId ?? activeOrderId;
    if (!id) return;
    setOrderDrafts(prev => prev.map(d => d.id === id ? { ...d, cart: [], appliedPromo: null } : d));
  }, [activeOrderId]);

  const applyPromoCode = useCallback(async (code: string): Promise<{ success: boolean; message: string }> => {
    const db = await getDB();
    const promos = await db.getAll('promotions');
    const promo = promos.find(p => p.code.toUpperCase() === code.toUpperCase());

    if (!promo || !promo.active) {
      return { success: false, message: t('promo.invalid') };
    }

    const now = new Date();
    if (now < new Date(promo.startDate) || now > new Date(promo.endDate)) {
      return { success: false, message: t('promo.expired') };
    }

    if (promo.minOrderTotal && subtotal < promo.minOrderTotal) {
      return { success: false, message: `Minimum ${promo.minOrderTotal} ${currency} required` };
    }

    setOrderDrafts(prev => prev.map(d => d.id === activeOrderId ? { ...d, appliedPromo: promo } : d));
    return { success: true, message: t('promo.applied') };
  }, [subtotal, currency, t, activeOrderId]);

  const removePromo = useCallback(() => {
    setOrderDrafts(prev => prev.map(d => d.id === activeOrderId ? { ...d, appliedPromo: null } : d));
  }, [activeOrderId]);

  const generateOrderNumber = useCallback(async (): Promise<string> => {
    const db = await getDB();
    const counterId = 'counter-global';
    const today = new Date().toISOString().split('T')[0];
    let counter = await db.get('numberingCounters', counterId);
    if (!counter) counter = { id: counterId, date: today, counter: 0 };
    if (counter.date !== today) { counter.date = today; counter.counter = 0; }
    counter.counter += 1;
    await db.put('numberingCounters', counter);
    return `#${counter.counter.toString().padStart(3, '0')}`;
  }, []);

  const createOrder = useCallback(async (): Promise<Order> => {
    const orderNumber = await generateOrderNumber();
    const now = new Date();
    const draft = orderDrafts.find(d => d.id === activeOrderId) || orderDrafts[0];
    const lines = draft?.cart || [];
    const draftPromo = draft?.appliedPromo || null;

    const order: Order = {
      id: generateUUID(),
      orderNumber,
      status: 'draft',
      type: draft?.type || 'dine-in',
      lines: [...lines],
      subtotal,
      discount,
      promoCode: draftPromo?.code,
      promoName: draftPromo?.name,
      total,
      createdBy: user?.id,
      createdAt: now,
      updatedAt: now,
      ...(draft?.type === 'delivery' && {
        deliveryAddress: draft.deliveryAddress,
        deliveryPhone: draft.deliveryPhone,
        deliveryCustomerName: draft.deliveryCustomerName,
      }),
    };

    const db = await getDB();
    await db.put('orders', order);

    setOrderDrafts(prev => {
      const next = prev.filter(d => d.id !== draft?.id);
      if (activeOrderId === draft?.id) {
        setActiveOrderId(next.length > 0 ? next[0].id : null);
      }
      return next;
    });

    setCurrentOrder(order);
    return order;
  }, [orderDrafts, activeOrderId, subtotal, discount, total, generateOrderNumber, user]);

  const removeEmptyDraftAfterPayment = useCallback(() => {
    setOrderDrafts(prev => {
      const remaining = prev.filter(d => d.cart.length > 0 || d.id !== activeOrderId);
      if (remaining.length < prev.length && activeOrderId) {
        setActiveOrderId(remaining.length > 0 ? remaining[0].id : null);
      }
      return remaining;
    });
  }, [activeOrderId]);

  return (
    <CartContext.Provider value={{
      orderDrafts, activeOrderId, setActiveOrderId,
      pendingCartItem, setPendingCartItem,
      subtotal, discount, total, appliedPromo, currentOrder,
      createNewDraft, createDraftWithType, updateDraftType, deleteDraft,
      addToCart, updateCartItem, removeFromCart, clearCart,
      applyPromoCode, removePromo,
      generateOrderNumber, createOrder, removeEmptyDraftAfterPayment,
    }}>
      {children}
    </CartContext.Provider>
  );
}
