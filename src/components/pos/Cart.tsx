import { useState, useEffect } from 'react';
import { usePOS, OrderDraft } from '@/contexts/POSContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/i18n';
import { OrderType } from '@shared/types';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trash2, 
  Plus, 
  Minus, 
  Ticket, 
  CreditCard, 
  ShoppingBag,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TouchInput } from '@/components/ui/touch-input';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { ManualItemModal } from './ManualItemModal';
import { PaymentModal } from './PaymentModal';
import { OrderTypeModal } from './OrderTypeModal';
import { PrintPreviewModal } from './PrintPreviewModal';
import { EditCartItemModal } from './EditCartItemModal';

export function Cart() {
  const { user, users } = useAuth();
  const {
    orderDrafts,
    activeOrderId,
    setActiveOrderId,
  createNewDraft,
  updateCartItem,
  removeFromCart,
  clearCart,
  deleteDraft,
    subtotal,
    discount,
    total,
    appliedPromo,
    applyPromoCode,
    removePromo,
    createOrder,
    sendToKitchen,
    currency,
    t,
    pendingCartItem,
    setPendingCartItem,
    createDraftWithType,
    updateDraftType,
    settings,
    printers,
    addToCart,
  } = usePOS();

  const activeDraft: OrderDraft | null = orderDrafts.find(d => d.id === activeOrderId) || orderDrafts[0] || null;
  const cart = activeDraft?.cart || [];

  const [promoInput, setPromoInput] = useState('');
  const [promoError, setPromoError] = useState('');
  const [showManualItem, setShowManualItem] = useState(false);
  const [showOrderType, setShowOrderType] = useState(false);
  const [showEditType, setShowEditType] = useState(false);

  const [showPayment, setShowPayment] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paidOrder, setPaidOrder] = useState<{ order: any; amountReceived: number; change: number } | null>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [editingCartItem, setEditingCartItem] = useState<any | null>(null);

  // Show type modal if there's a pending cart item and no active draft
  useEffect(() => {
    if (pendingCartItem && !activeDraft) {
      setShowOrderType(true);
    } else if (pendingCartItem && activeDraft) {
      // If there's a pending item but we have an active draft, add it directly
      addToCart(pendingCartItem);
      setPendingCartItem(null);
    }
  }, [pendingCartItem, activeDraft, addToCart, setPendingCartItem]);

  const handleApplyPromo = async () => {
    if (!promoInput.trim()) return;
    
    const result = await applyPromoCode(promoInput.trim());
    if (result.success) {
      setPromoInput('');
      setPromoError('');
    } else {
      setPromoError(result.message);
    }
  };

  const handleAddOrder = () => {
    setShowOrderType(true);
  };

  const handleOrderTypeSelect = (type: OrderType, deliveryInfo?: { address: string; phone: string; customerName: string }) => {
    if (pendingCartItem) {
      createDraftWithType(type, pendingCartItem, deliveryInfo);
      setShowOrderType(false);
    } else {
      createNewDraft(undefined, type, deliveryInfo);
      setShowOrderType(false);
    }
  };

  const handleChangeType = (type: OrderType, deliveryInfo?: { address: string; phone: string; customerName: string }) => {
    if (activeDraft) {
      updateDraftType(activeDraft.id, type, deliveryInfo);
      setShowEditType(false);
    }
  };

  const handleSendToKitchen = async () => {
    if (cart.length === 0) return;

    setIsProcessing(true);
    try {
      const order = await createOrder();
      await sendToKitchen(order.id);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePay = async () => {
    if (cart.length === 0) return;
    setShowPayment(true);
  };

  return (
    <>
      <aside className="h-full bg-card border-l border-border flex flex-col overflow-hidden">
        {/* Header - Compact on small screens */}
        <div className="p-2 sm:p-3 lg:p-4 border-b border-border">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm sm:text-base lg:text-lg font-bold flex items-center gap-1.5">
              <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              <span className="hidden sm:inline">{t('order.cart')}</span>
              {activeDraft && (
                <span className="ml-1 px-1.5 py-0.5 bg-primary text-primary-foreground text-xs rounded-full">
                  {cart.reduce((sum, item) => sum + item.quantity, 0)}
                </span>
              )}
            </h2>
            <Button 
              size="sm" 
              variant="default" 
              onClick={handleAddOrder}
              className="h-8 sm:h-10 px-2 sm:px-4 text-xs sm:text-sm font-semibold gap-1 bg-primary hover:bg-primary/90 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{t('order.addOrder')}</span>
            </Button>
          </div>
          {activeDraft && (
            <div className="mt-2 flex items-center gap-2">
              <Button 
                onClick={() => setShowEditType(true)}
                className="flex-1 h-8 sm:h-10 text-xs sm:text-sm font-medium gap-1.5 bg-secondary hover:bg-secondary/90"
                variant="default"
              >
                <span className="text-base sm:text-lg">
                  {activeDraft.type === 'dine-in' ? '🍽️' : activeDraft.type === 'delivery' ? '🚚' : '📦'}
                </span>
                <span className="truncate">
                  {activeDraft.type === 'dine-in' ? t('order.dineIn') : activeDraft.type === 'delivery' ? t('order.delivery') : t('order.takeaway')}
                </span>
              </Button>
              <span className="text-xs text-muted-foreground hidden lg:block">{activeDraft?.name}</span>
            </div>
          )}
        </div>

        {/* Cart Items - Compact on small screens */}
        <div className="flex-1 overflow-y-auto p-1.5 sm:p-2 lg:p-3 space-y-1 sm:space-y-2">
          {orderDrafts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <ShoppingBag className="w-10 h-10 sm:w-16 sm:h-16 mb-2 sm:mb-4 opacity-30" />
              <p className="font-medium text-sm sm:text-base">{t('order.emptyCart')}</p>
              <p className="text-xs sm:text-sm">{t('order.addItems')}</p>
            </div>
          ) : (
            <Accordion type="single" value={activeOrderId ?? ""} onValueChange={(v) => setActiveOrderId(v || null)}>
              {orderDrafts.map((draft) => {
              const draftSubtotal = (draft.cart || []).reduce((sum, item) => {
                const itemTotal = item.unitPrice * item.quantity;
                const modifiersTotal = item.modifiers.reduce((m, mod) => m + mod.priceAdjustment, 0) * item.quantity;
                return sum + itemTotal + modifiersTotal;
              }, 0);

              return (
                <AccordionItem key={draft.id} value={draft.id} className="border-b">
                  <AccordionTrigger className="px-1.5 sm:px-2 py-1.5 sm:py-2 hover:bg-secondary/50 transition-colors">
                    <div className="flex items-center justify-between w-full gap-2">
                      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                        <span className="font-medium text-xs sm:text-sm truncate">{draft.name}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); e.preventDefault(); deleteDraft(draft.id); }}
                          className="p-0.5 sm:p-1 hover:bg-destructive/10 rounded flex-shrink-0"
                          title={t('order.delete')}
                        >
                          <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 text-destructive" />
                        </button>
                        <span className="text-[10px] sm:text-xs text-muted-foreground hidden sm:inline">
                          {draft.cart.length} {t('order.itemsAbbr')}
                        </span>
                      </div>
                      <span className="font-bold text-xs sm:text-sm text-primary flex-shrink-0">
                        {formatCurrency(draftSubtotal, currency)}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-1 sm:space-y-2">
                      {draft.cart.length > 0 && (
                        <div className="flex justify-end">
                          <button
                            onClick={() => clearCart(draft.id)}
                            className="text-[10px] sm:text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-0.5"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span className="hidden sm:inline">{t('order.clear')}</span>
                          </button>
                        </div>
                      )}
                      <AnimatePresence mode="popLayout">
                        {draft.cart.length === 0 ? (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-muted-foreground py-2 sm:py-4 text-xs sm:text-sm text-center">
                            {t('order.emptyCart')}
                          </motion.div>
                        ) : (
                          draft.cart.map((item) => (
                            <motion.div 
                              key={item.id} 
                              layout 
                              initial={{ opacity: 0, x: 20 }} 
                              animate={{ opacity: 1, x: 0 }} 
                              exit={{ opacity: 0, x: -20 }} 
                              className="p-1.5 sm:p-2 bg-muted/30 rounded-lg"
                            >
                              <div className="flex items-start justify-between gap-1">
                                <div 
                                  className="flex-1 min-w-0 cursor-pointer" 
                                  onClick={() => !item.isManual && setEditingCartItem(item)}
                                >
                                  <h4 className="font-semibold text-xs sm:text-sm truncate">{item.productName}</h4>
                                  {item.variantSize && (
                                    <span className="text-[10px] sm:text-xs text-muted-foreground">{item.variantSize}</span>
                                  )}
                                  {item.modifiers.length > 0 && (
                                    <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                                      +{item.modifiers.length} {t('order.supplementsAbbr')}
                                    </p>
                                  )}
                                  {item.note && (
                                    <p className="text-[10px] text-primary italic truncate mt-0.5">
                                      {item.note}
                                    </p>
                                  )}
                                </div>
                                <button 
                                  onClick={() => removeFromCart(item.id)} 
                                  className="p-0.5 hover:bg-destructive/10 hover:text-destructive rounded transition-colors flex-shrink-0"
                                >
                                  <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                </button>
                              </div>

                              <div className="flex items-center justify-between mt-1.5">
                                <div className="flex items-center gap-1">
                                  <button 
                                    onClick={() => { if (item.quantity > 1) { updateCartItem(item.id, { quantity: item.quantity - 1 }); } else { removeFromCart(item.id); } }} 
                                    className="w-6 h-6 sm:w-7 sm:h-7 rounded bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
                                  >
                                    <Minus className="w-3 h-3 sm:w-4 sm:h-4" />
                                  </button>
                                  <span className="font-bold text-xs sm:text-sm min-w-[20px] text-center">{item.quantity}</span>
                                  <button 
                                    onClick={() => updateCartItem(item.id, { quantity: item.quantity + 1 })} 
                                    className="w-6 h-6 sm:w-7 sm:h-7 rounded bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
                                  >
                                    <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                                  </button>
                                </div>
                                <span className="font-bold text-xs sm:text-sm text-primary">
                                  {formatCurrency((item.unitPrice + item.modifiers.reduce((s, m) => s + m.priceAdjustment, 0)) * item.quantity, currency)}
                                </span>
                              </div>
                            </motion.div>
                          ))
                        )}
                      </AnimatePresence>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
            </Accordion>
          )}
        </div>

        {/* Manual Item Button - Compact on small screens */}
        {activeDraft && (
          <div className="px-1.5 sm:px-2 lg:px-3 pb-1.5 sm:pb-2">
            <button
              onClick={() => setShowManualItem(true)}
              className="w-full py-1.5 sm:py-2 px-2 rounded-lg border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="text-xs sm:text-sm font-medium">{t('order.addManualItem')}</span>
            </button>
          </div>
        )}

        {/* Promo Code - Compact on small screens */}
        {activeDraft && (
          <div className="px-1.5 sm:px-2 lg:px-3 pb-1.5 sm:pb-2">
            {appliedPromo ? (
              <div className="flex items-center justify-between p-1.5 sm:p-2 bg-success/10 border border-success/20 rounded-lg">
                <div className="flex items-center gap-1.5">
                  <Ticket className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-success" />
                  <span className="text-xs sm:text-sm font-medium text-success">
                    {appliedPromo.code}
                  </span>
                </div>
                <button
                  onClick={removePromo}
                  className="p-0.5 sm:p-1 hover:bg-destructive/10 rounded"
                >
                  <X className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-destructive" />
                </button>
              </div>
            ) : (
              <div className="flex gap-1.5 sm:gap-2">
                <TouchInput
                  value={promoInput}
                  onChange={(value) => setPromoInput(value.toUpperCase())}
                  placeholder={t('order.promoCode')}
                  className="flex-1 h-8 sm:h-10 text-xs sm:text-sm"
                  showQuickSuggestions={false}
                />
                <Button
                  onClick={handleApplyPromo}
                  variant="outline"
                  size="sm"
                  className="h-8 sm:h-10 px-2 sm:px-3"
                >
                  <Ticket className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </Button>
              </div>
            )}
            {promoError && (
              <p className="text-[10px] sm:text-xs text-destructive mt-0.5">{promoError}</p>
            )}
          </div>
        )}

        {/* Totals - Compact on small screens */}
        {activeDraft && (
          <div className="p-1.5 sm:p-2 lg:p-3 border-t border-border bg-muted/30 space-y-1 sm:space-y-1.5">
            <div className="flex justify-between text-xs sm:text-sm">
              <span className="text-muted-foreground">{t('order.subtotal')}</span>
              <span>{formatCurrency(subtotal, currency)}</span>
            </div>
            
            {discount > 0 && (
              <div className="flex justify-between text-xs sm:text-sm text-success">
                <span>{t('order.discount')}</span>
                <span>-{formatCurrency(discount, currency)}</span>
              </div>
            )}
            
            <div className="flex justify-between text-base sm:text-lg lg:text-xl font-bold pt-1 sm:pt-1.5 border-t border-border">
              <span>{t('order.total')}</span>
              <span className="text-primary">{formatCurrency(total, currency)}</span>
            </div>
          </div>
        )}

        {/* Action Buttons - Compact on small screens */}
        {activeDraft && (
          <div className="p-1.5 sm:p-2 lg:p-3 border-t border-border">
            <Button
              onClick={handlePay}
              disabled={cart.length === 0 || isProcessing}
              className="w-full h-10 sm:h-12 lg:h-14 text-sm sm:text-base lg:text-lg font-bold gradient-primary border-0"
            >
              <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 mr-1.5 sm:mr-2" />
              <span className="hidden sm:inline">{t('order.pay')} • </span>
              {formatCurrency(total, currency)}
            </Button>
          </div>
        )}
      </aside>

      {/* Modals */}
      {showManualItem && (
        <ManualItemModal onClose={() => setShowManualItem(false)} />
      )}
      
      {showPayment && (
        <PaymentModal 
          onClose={() => setShowPayment(false)} 
          onPaymentSuccess={(order, amountReceived, change) => {
            setPaidOrder({ order, amountReceived, change });
            setShowPrintPreview(true);
            setShowPayment(false);
          }}
        />
      )}

      {paidOrder && (
        <PrintPreviewModal
          isOpen={showPrintPreview}
          onClose={() => {
            setShowPrintPreview(false);
            setPaidOrder(null);
          }}
          order={paidOrder.order}
          settings={settings}
          currency={currency}
          type="receipt"
          cashierName={
            paidOrder.order?.createdBy
              ? (users.find((u) => u.id === paidOrder.order.createdBy)?.name ?? user?.name ?? '')
              : (user?.name ?? '')
          }
          amountReceived={paidOrder.amountReceived}
          change={paidOrder.change}
          printers={printers || []}
        />
      )}

      <OrderTypeModal 
        isOpen={showOrderType} 
        onClose={() => {
          setShowOrderType(false);
          if (pendingCartItem) {
            setPendingCartItem(null);
          }
        }} 
        onSelect={handleOrderTypeSelect}
      />

      <OrderTypeModal 
        isOpen={showEditType} 
        onClose={() => setShowEditType(false)} 
        onSelect={handleChangeType}
        initialDeliveryInfo={activeDraft?.type === 'delivery' ? {
          address: activeDraft.deliveryAddress ?? '',
          phone: activeDraft.deliveryPhone ?? '',
          customerName: activeDraft.deliveryCustomerName ?? '',
          fee: activeDraft.deliveryFee,
        } : undefined}
      />

      <AnimatePresence>
        {editingCartItem && (
          <EditCartItemModal
            item={editingCartItem}
            onClose={() => setEditingCartItem(null)}
            onSave={(updates) => {
              updateCartItem(editingCartItem.id, updates);
              setEditingCartItem(null);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
