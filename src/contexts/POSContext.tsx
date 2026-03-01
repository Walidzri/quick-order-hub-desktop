/**
 * POSContext — Shim de compatibilité (Phase 1.4)
 *
 * Ce fichier réassemble les 5 contextes éclatés en une interface unique.
 * Les composants existants continuant d'utiliser usePOS() fonctionnent sans modification.
 *
 * Architecture cible :
 *   SettingsProvider > CatalogProvider > PrinterProvider > CartProvider > OrderProvider
 */
import React, { ReactNode } from 'react';
import { useSettings, SettingsProvider } from './SettingsContext';
import { useCatalog, CatalogProvider } from './CatalogContext';
import { usePrinter, PrinterProvider } from './PrinterContext';
import { useCart, CartProvider } from './CartContext';
import { useOrder, OrderProvider } from './OrderContext';

export type { OrderDraft } from './CartContext';

export function usePOS() {
  const settings = useSettings();
  const catalog = useCatalog();
  const printer = usePrinter();
  const cart = useCart();
  const order = useOrder();

  return {
    // Settings
    settings: settings.settings,
    updateSettings: settings.updateSettings,
    t: settings.t,
    language: settings.language,
    currency: settings.currency,
    direction: settings.direction,
    kioskMode: settings.kioskMode,
    toggleKioskMode: settings.toggleKioskMode,
    isLoading: settings.isLoading,

    // Catalog
    categories: catalog.categories,
    products: catalog.products,
    variants: catalog.variants,
    promotions: catalog.promotions,
    getProductsByCategory: catalog.getProductsByCategory,
    getVariantsByProduct: catalog.getVariantsByProduct,
    saveProduct: catalog.saveProduct,
    deleteProduct: catalog.deleteProduct,
    loadProducts: catalog.loadProducts,
    saveCategory: catalog.saveCategory,
    deleteCategory: catalog.deleteCategory,
    loadCategories: catalog.loadCategories,
    loadPromotions: catalog.loadPromotions,
    savePromotion: catalog.savePromotion,
    deletePromotion: catalog.deletePromotion,
    exportProductsTemplate: catalog.exportProductsTemplate,
    importProductsTemplate: catalog.importProductsTemplate,
    resetDatabase: catalog.resetDatabase,

    // Printers
    printers: printer.printers,
    updatePrinter: printer.updatePrinter,
    deletePrinter: printer.deletePrinter,

    // Cart
    orderDrafts: cart.orderDrafts,
    activeOrderId: cart.activeOrderId,
    setActiveOrderId: cart.setActiveOrderId,
    pendingCartItem: cart.pendingCartItem,
    setPendingCartItem: cart.setPendingCartItem,
    subtotal: cart.subtotal,
    discount: cart.discount,
    total: cart.total,
    appliedPromo: cart.appliedPromo,
    currentOrder: cart.currentOrder,
    createNewDraft: cart.createNewDraft,
    createDraftWithType: cart.createDraftWithType,
    updateDraftType: cart.updateDraftType,
    deleteDraft: cart.deleteDraft,
    addToCart: cart.addToCart,
    updateCartItem: cart.updateCartItem,
    removeFromCart: cart.removeFromCart,
    clearCart: cart.clearCart,
    applyPromoCode: cart.applyPromoCode,
    removePromo: cart.removePromo,
    generateOrderNumber: cart.generateOrderNumber,
    createOrder: cart.createOrder,

    // Orders
    orders: order.orders,
    sendToKitchen: order.sendToKitchen,
    markAsPaid: order.markAsPaid,
    cancelOrder: order.cancelOrder,
    updateOrderStatus: order.updateOrderStatus,
    deleteOrder: order.deleteOrder,
    deleteOrders: order.deleteOrders,
    deleteAllOrders: order.deleteAllOrders,
    loadOrders: order.loadOrders,
    loadOrdersByDateRange: order.loadOrdersByDateRange,
    loadOrdersPaginated: order.loadOrdersPaginated,
  };
}

export function POSProvider({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <CatalogProvider>
        <PrinterProvider>
          <CartProvider>
            <OrderProvider>
              {children}
            </OrderProvider>
          </CartProvider>
        </PrinterProvider>
      </CatalogProvider>
    </SettingsProvider>
  );
}
