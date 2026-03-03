export type OrderStatus = 'draft' | 'sentToKitchen' | 'ready' | 'paid' | 'cancelled';
export type PaymentMethod = 'cash' | 'card';
export type OrderType = 'dine-in' | 'takeaway' | 'delivery';
export type PromoType = 'percent' | 'fixed' | 'freeItem';

export interface OrderLineModifier {
  optionId: string;
  optionName: string;
  priceAdjustment: number;
}

export interface OrderLine {
  id: string;
  productId?: string;
  productName: string;
  categoryId?: string; // For category breakdown in reports
  variantId?: string;
  variantSize?: string;
  quantity: number;
  unitPrice: number;
  modifiers: OrderLineModifier[];
  note?: string;
  isManual: boolean;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  type: OrderType;
  lines: OrderLine[];
  subtotal: number;
  discount: number;
  promoCode?: string;
  promoName?: string;
  total: number;
  paymentMethod?: PaymentMethod;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
  paidAt?: Date;
  sentToKitchenAt?: Date;
  /** Infos livraison (si type === 'delivery') */
  deliveryAddress?: string;
  deliveryPhone?: string;
  deliveryCustomerName?: string;
}

export interface Promotion {
  id: string;
  code: string;
  name: string;
  type: PromoType;
  value: number;
  startDate: Date;
  endDate: Date;
  active: boolean;
  minOrderTotal?: number;
  freeItemId?: string;
}
