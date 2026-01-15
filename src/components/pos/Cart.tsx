import { useState, useEffect } from 'react';
import { usePOS, OrderDraft } from '@/contexts/POSContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/i18n';
import { OrderType } from '@/lib/database';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trash2, 
  Plus, 
  Minus, 
  Ticket, 
  CreditCard, 
  Banknote,
  ShoppingBag,
  X,
  PenLine
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TouchInput } from '@/components/ui/touch-input';
import { cn } from '@/lib/utils';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { ManualItemModal } from './ManualItemModal';
import { PaymentModal } from './PaymentModal';
import { OrderTypeModal } from './OrderTypeModal';
import { PrintPreviewModal } from './PrintPreviewModal';
import { EditCartItemModal } from './EditCartItemModal';

export function Cart() {
  const { user } = useAuth();
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
    createDraftWithType,
    updateDraftType,
    settings,
    printers,
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

  // Show type modal if there's a pending cart item
  useEffect(() => {
    if (pendingCartItem) {
      setShowOrderType(true);
    }
  }, [pendingCartItem]);

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

  const handleOrderTypeSelect = (type: OrderType) => {
    if (pendingCartItem) {
      createDraftWithType(type, pendingCartItem);
      setShowOrderType(false);
    } else {
      createNewDraft(undefined, type);
      setShowOrderType(false);
    }
  };

  const handleChangeType = (type: OrderType) => {
    if (activeDraft) {
      updateDraftType(activeDraft.id, type);
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
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-primary" />
                {t('order.cart')}
              </h2>
              <div className="flex items-center gap-2">
                <Button 
                  size="lg" 
                  variant="default" 
                  onClick={handleAddOrder}
                  className="h-12 px-6 text-base font-semibold gap-2 bg-primary hover:bg-primary/90 active:scale-95 transition-all shadow-md"
                >
                  <Plus className="w-5 h-5" />
                  {t('order.addOrder')}
                </Button>
              </div>
            </div>
            {activeDraft && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{activeDraft?.name}</span>
                    <span className="px-2 py-0.5 bg-primary text-primary-foreground text-sm rounded-full">
                      {cart.reduce((sum, item) => sum + item.quantity, 0)}
                    </span>
                  </div>
                </div>
                <Button 
                  onClick={() => setShowEditType(true)}
                  className="w-full h-12 text-base font-semibold gap-2 bg-secondary hover:bg-secondary/90"
                  variant="default"
                >
                  <span className="text-xl">
                    {activeDraft.type === 'dine-in' ? '🍽️' : '📦'}
                  </span>
                  <span>
                    {activeDraft.type === 'dine-in' ? t('order.dineIn') : t('order.takeaway')}
                  </span>
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {orderDrafts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <ShoppingBag className="w-16 h-16 mb-4 opacity-30" />
              <p className="font-medium">{t('order.emptyCart')}</p>
              <p className="text-sm">{t('order.addItems')}</p>
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
                  <AccordionTrigger className="px-2 hover:bg-secondary/50 transition-colors">
                    <div className="flex items-center justify-between w-full">
                              <div className="flex items-center gap-3">
                                <div className="font-medium flex items-center gap-2">
                                  {draft.name}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); deleteDraft(draft.id); }}
                                    className="p-1 hover:bg-destructive/10 rounded"
                                    title={t('order.delete')}
                                  >
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                  </button>
                                </div>
                                <div className="text-sm text-muted-foreground">{draft.cart.length} {t('products.title').toLowerCase()}{draft.cart.length > 1 ? 's' : ''}</div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-primary">{formatCurrency(draftSubtotal, currency)}</div>
                              </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2">
                      {draft.cart.length > 0 && (
                        <div className="flex justify-end">
                          <button
                            onClick={() => clearCart(draft.id)}
                            className="text-sm text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
                          >
                            <Trash2 className="w-4 h-4" />
                            {t('order.clear')}
                          </button>
                        </div>
                      )}
                      <AnimatePresence mode="popLayout">
                        {draft.cart.length === 0 ? (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-muted-foreground py-4">
                            {t('order.emptyCart')}
                          </motion.div>
                        ) : (
                          draft.cart.map((item) => (
                            <motion.div key={item.id} layout initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="cart-item animate-pop">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-semibold text-sm truncate">{item.productName}</h4>
                                  {item.variantSize && <span className="text-xs text-muted-foreground">{item.variantSize}</span>}
                                  {item.modifiers.length > 0 && (
                                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                                      <span>{item.modifiers.map(m => `(S) ${m.optionName}`).join(', ')}</span>
                                      {!item.isManual && (
                                        <button
                                          onClick={() => setEditingCartItem(item)}
                                          className="ml-1 p-2 hover:bg-primary/10 hover:text-primary rounded-lg transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
                                          title={t('order.editItem')}
                                        >
                                          <PenLine className="w-5 h-5" />
                                        </button>
                                      )}
                                    </div>
                                  )}
                                  {!item.isManual && item.modifiers.length === 0 && (
                                    <button
                                      onClick={() => setEditingCartItem(item)}
                                      className="text-sm text-primary hover:bg-primary/10 px-3 py-2 rounded-lg mt-1 font-medium transition-colors min-h-[40px] flex items-center gap-2"
                                    >
                                      <PenLine className="w-4 h-4" />
                                      {t('order.modifyItem')}
                                    </button>
                                  )}
                                  {item.note && <div className="text-xs text-primary italic mt-1 flex items-center gap-1"><PenLine className="w-3 h-3" />{item.note}</div>}
                                </div>

                                <button onClick={() => removeFromCart(item.id)} className="p-1 hover:bg-destructive/10 hover:text-destructive rounded transition-colors"><X className="w-4 h-4" /></button>
                              </div>

                              <div className="flex items-center justify-between mt-2">
                                <div className="flex items-center gap-2">
                                  <button onClick={() => { if (item.quantity > 1) { updateCartItem(item.id, { quantity: item.quantity - 1 }); } else { removeFromCart(item.id); } }} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"><Minus className="w-4 h-4" /></button>
                                  <span className="font-bold min-w-[24px] text-center">{item.quantity}</span>
                                  <button onClick={() => updateCartItem(item.id, { quantity: item.quantity + 1 })} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"><Plus className="w-4 h-4" /></button>
                                </div>
                                <span className="font-bold text-primary">{formatCurrency((item.unitPrice + item.modifiers.reduce((s, m) => s + m.priceAdjustment, 0)) * item.quantity, currency)}</span>
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

        {/* Manual Item Button - show only if there is an active draft */}
        {activeDraft && (
          <div className="px-3 pb-2">
            <button
              onClick={() => setShowManualItem(true)}
              className="w-full py-2 px-3 rounded-lg border-2 border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium">{t('order.addManualItem')}</span>
            </button>
          </div>
        )}

        {/* Promo Code - show only if there is an active draft */}
        {activeDraft && (
          <div className="px-3 pb-3">
            {appliedPromo ? (
              <div className="flex items-center justify-between p-2 bg-success/10 border border-success/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <Ticket className="w-4 h-4 text-success" />
                  <span className="text-sm font-medium text-success">
                    {appliedPromo.code}
                  </span>
                </div>
                <button
                  onClick={removePromo}
                  className="p-1 hover:bg-destructive/10 rounded"
                >
                  <X className="w-4 h-4 text-destructive" />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <TouchInput
                  value={promoInput}
                  onChange={(value) => setPromoInput(value.toUpperCase())}
                  placeholder={t('order.promoCode')}
                  className="flex-1"
                  showQuickSuggestions={false}
                />
                <Button
                  onClick={handleApplyPromo}
                  variant="outline"
                  size="sm"
                  className="h-10 px-4"
                >
                  <Ticket className="w-4 h-4" />
                </Button>
              </div>
            )}
            {promoError && (
              <p className="text-xs text-destructive mt-1">{promoError}</p>
            )}
          </div>
        )}

        {/* Totals - show only if there is an active draft */}
        {activeDraft && (
          <div className="p-3 border-t border-border bg-muted/30 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('order.subtotal')}</span>
              <span>{formatCurrency(subtotal, currency)}</span>
            </div>
            
            {discount > 0 && (
              <div className="flex justify-between text-sm text-success">
                <span>{t('order.discount')}</span>
                <span>-{formatCurrency(discount, currency)}</span>
              </div>
            )}
            
            <div className="flex justify-between text-xl font-bold pt-2 border-t border-border">
              <span>{t('order.total')}</span>
              <span className="text-primary">{formatCurrency(total, currency)}</span>
            </div>
          </div>
        )}

        {/* Action Buttons - show only if there is an active draft */}
        {activeDraft && (
          <div className="p-3 space-y-2 border-t border-border">
            {/* <Button
              onClick={handleSendToKitchen}
              disabled={cart.length === 0 || isProcessing}
              className="w-full h-14 text-lg font-bold bg-warning hover:bg-warning/90 text-warning-foreground"
            >
              <Banknote className="w-6 h-6 mr-2" />
              {t('order.sendToKitchen')}
            </Button> */}
            
            <Button
              onClick={handlePay}
              disabled={cart.length === 0 || isProcessing}
              className="w-full h-14 text-lg font-bold gradient-primary border-0"
            >
              <CreditCard className="w-6 h-6 mr-2" />
              {t('order.pay')} • {formatCurrency(total, currency)}
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
          cashierName={user?.name || ''}
          amountReceived={paidOrder.amountReceived}
          change={paidOrder.change}
          printers={printers || []}
        />
      )}

      <OrderTypeModal 
        isOpen={showOrderType} 
        onClose={() => setShowOrderType(false)} 
        onSelect={handleOrderTypeSelect}
      />

      <OrderTypeModal 
        isOpen={showEditType} 
        onClose={() => setShowEditType(false)} 
        onSelect={handleChangeType}
      />

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
    </>
  );
}
