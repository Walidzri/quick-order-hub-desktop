export type Size = 'L' | 'XL' | 'XXL' | 'XXXL' | 'petite' | 'grande' | 'Simple' | 'Cheddar' | 'Classique' | 'Double';

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
  icon?: string;
  image?: string; // Base64 image data
  supplementIds?: string[]; // IDs of supplements available for all products in this category
}

export interface ProductVariant {
  id: string;
  productId: string;
  size: string;
  price: number;
}

export interface ModifierGroup {
  id: string;
  name: string;
  required: boolean;
  multiSelect: boolean;
}

export interface ModifierOption {
  id: string;
  groupId: string;
  name: string;
  priceAdjustment: number;
  sizeBasedPrices?: Record<string, number>;
}

export interface Product {
  id: string;
  categoryId: string;
  name: string;
  basePrice?: number;
  variants?: ProductVariant[];
  modifierGroupIds?: string[];
  sortOrder: number;
  description?: string;
  available?: boolean;
  image?: string; // Base64 image data
  supplementIds?: string[]; // IDs of supplements that can be added to this product
}
