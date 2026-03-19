import { useState, useEffect, useMemo } from 'react';
import { usePOS } from '@/contexts/POSContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/i18n';
import { Order, OrderStatus } from '@shared/types';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Calendar, 
  Printer, 
  ChefHat,
  Receipt,
  Clock,
  CheckCircle2,
  XCircle,
  BellRing,
  Filter,
  Download,
  Trash2,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TouchInput } from '@/components/ui/touch-input';
import { cn } from '@/lib/utils';
import { PrintPreviewModal } from './PrintPreviewModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const statusIcons: Record<OrderStatus, React.ReactNode> = {
  draft: <Clock className="w-4 h-4" />,
  sentToKitchen: <ChefHat className="w-4 h-4" />,
  ready: <BellRing className="w-4 h-4" />,
  paid: <CheckCircle2 className="w-4 h-4" />,
  cancelled: <XCircle className="w-4 h-4" />,
};

const statusColors: Record<OrderStatus, string> = {
  draft: 'status-draft',
  sentToKitchen: 'status-kitchen',
  ready: 'status-ready',
  paid: 'status-paid',
  cancelled: 'status-cancelled',
};

const PAGE_SIZE = 50; // Number of orders per page

export function OrdersScreen() {
  const { orders, loadOrders, loadOrdersPaginated, printKitchenTicket, printReceipt, currency, t, settings, printers, deleteOrder, deleteOrders, deleteAllOrders, updateOrderStatus } = usePOS();
  const { users, user, hasPermission } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printModalType, setPrintModalType] = useState<'receipt' | 'kitchen'>('receipt');
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [paginatedOrders, setPaginatedOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    variant?: 'default' | 'destructive';
  }>({
    open: false,
    title: '',
    description: '',
    onConfirm: () => {},
    variant: 'default',
  });

  // Check if user can manage orders (admin or chef)
  const canManageOrders = user && (user.role === 'admin' || user.role === 'chef');

  // Create a map of user IDs to names
  const userNamesMap = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach(user => {
      map.set(user.id, user.name);
    });
    return map;
  }, [users]);

  const getCashierName = (userId?: string): string => {
    if (!userId) return '-';
    return userNamesMap.get(userId) || '-';
  };

  // Load paginated orders
  useEffect(() => {
    const loadData = async () => {
      setIsLoadingOrders(true);
      try {
        const result = await loadOrdersPaginated(currentPage, PAGE_SIZE);
        setPaginatedOrders(result.orders);
        setTotalPages(result.totalPages);
        setTotalOrders(result.total);
      } catch (error) {
        console.error('Failed to load orders:', error);
      } finally {
        setIsLoadingOrders(false);
      }
    };
    loadData();
  }, [currentPage, loadOrdersPaginated]);

  // Refresh when an order is deleted or modified
  const refreshOrders = async () => {
    const result = await loadOrdersPaginated(currentPage, PAGE_SIZE);
    setPaginatedOrders(result.orders);
    setTotalPages(result.totalPages);
    setTotalOrders(result.total);
  };

  // Filter orders client-side (for search and status filter on current page)
  const filteredOrders = paginatedOrders.filter(order => {
    if (statusFilter !== 'all' && order.status !== statusFilter) return false;
    if (search && !order.orderNumber.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handlePrintKitchen = async (order: Order) => {
    setSelectedOrder(order);
    setPrintModalType('kitchen');
    setShowPrintModal(true);
  };

  const handlePrintReceipt = async (order: Order) => {
    setSelectedOrder(order);
    setPrintModalType('receipt');
    setShowPrintModal(true);
  };


  const handleToggleSelect = (orderId: string) => {
    setSelectedOrderIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedOrderIds.size === filteredOrders.length) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(filteredOrders.map(o => o.id)));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedOrderIds.size === 0) return;
    const message = t('orders.confirmDeleteSelected').replace('{count}', selectedOrderIds.size.toString());
    setConfirmDialog({
      open: true,
      title: t('orders.deleteSelected'),
      description: message,
      variant: 'destructive',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, open: false }));
        setIsDeleting(true);
        try {
          await deleteOrders(Array.from(selectedOrderIds));
          setSelectedOrderIds(new Set());
          await refreshOrders(); // Refresh paginated list
        } catch (error) {
          console.error('Error deleting orders:', error);
          setConfirmDialog({
            open: true,
            title: t('orders.deleteError'),
            description: t('orders.deleteError'),
            variant: 'default',
            onConfirm: () => setConfirmDialog(prev => ({ ...prev, open: false })),
          });
        } finally {
          setIsDeleting(false);
        }
      },
    });
  };

  const handleDeleteAll = () => {
    setConfirmDialog({
      open: true,
      title: t('orders.deleteAll'),
      description: t('orders.confirmDeleteAll'),
      variant: 'destructive',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, open: false }));
        setIsDeleting(true);
        try {
          await deleteAllOrders();
          setSelectedOrderIds(new Set());
          setCurrentPage(1); // Reset to first page
          await refreshOrders(); // Refresh paginated list
        } catch (error) {
          console.error('Error deleting all orders:', error);
          setConfirmDialog({
            open: true,
            title: t('orders.deleteError'),
            description: t('orders.deleteError'),
            variant: 'default',
            onConfirm: () => setConfirmDialog(prev => ({ ...prev, open: false })),
          });
        } finally {
          setIsDeleting(false);
        }
      },
    });
  };

  const handleExportAll = () => {
    const csvContent = generateOrdersCSV(filteredOrders);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `commandes_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportSelected = () => {
    if (selectedOrderIds.size === 0) return;
    const selectedOrders = filteredOrders.filter(o => selectedOrderIds.has(o.id));
    const csvContent = generateOrdersCSV(selectedOrders);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `commandes_selectionnees_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generateOrdersCSV = (ordersToExport: Order[]): string => {
    const headers = [
      t('csv.number'),
      t('receipt.dateLabel'),
      t('csv.time'),
      t('csv.status'),
      t('csv.type'),
      t('csv.paymentMethod'),
      t('csv.cashier'),
      t('csv.subtotal'),
      t('csv.discount'),
      t('csv.total'),
      t('csv.items'),
    ];
    
    const rows = ordersToExport.map(order => {
      const date = new Date(order.createdAt);
      const cashierName = order.createdBy ? getCashierName(order.createdBy) : '-';
      const articles = order.lines.map(line => 
        `${line.quantity}x ${line.productName}${line.variantSize ? ` (${line.variantSize})` : ''}`
      ).join('; ');
      
      return [
        order.orderNumber,
        date.toLocaleDateString('fr-FR'),
        date.toLocaleTimeString('fr-FR'),
        t(`status.${order.status}`),
        order.type === 'dine-in' ? t('print.dineIn') : order.type === 'delivery' ? t('print.delivery') : t('print.takeaway'),
        order.paymentMethod === 'cash' ? t('print.cash') : t('print.card'),
        cashierName,
        formatCurrency(order.subtotal, currency),
        order.discount > 0 ? formatCurrency(order.discount, currency) : '0',
        formatCurrency(order.total, currency),
        articles
      ];
    });
    
    return [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
  };

  return (
    <div className="h-full flex">
      {/* Orders List */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">{t('orders.title')}</h1>
            
            {/* Management Actions - Only for admin/chef */}
            {canManageOrders && (
              <div className="flex gap-2">
                {selectedOrderIds.size > 0 && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportSelected}
                      disabled={isDeleting}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      {t('orders.exportSelected')} ({selectedOrderIds.size})
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDeleteSelected}
                      disabled={isDeleting}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      {t('orders.deleteSelected')} ({selectedOrderIds.size})
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportAll}
                  disabled={isDeleting || filteredOrders.length === 0}
                >
                  <Download className="w-4 h-4 mr-2" />
                  {t('orders.exportAll')}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteAll}
                  disabled={isDeleting || filteredOrders.length === 0}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {t('orders.deleteAll')}
                </Button>
              </div>
            )}
          </div>
          
          <div className="flex gap-3 flex-wrap items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground z-10" />
              <TouchInput
                value={search}
                onChange={setSearch}
                placeholder={t('general.search')}
                className="pl-10"
              />
            </div>

            {/* Status Filter */}
            <div className="flex gap-2">
              {(['all', 'draft', 'sentToKitchen', 'ready', 'paid', 'cancelled'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    statusFilter === status
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary hover:bg-secondary/80"
                  )}
                >
                  {status === 'all' ? t('general.all') : t(`status.${status}`)}
                </button>
              ))}
            </div>

            {/* Select All Checkbox - Only for admin/chef */}
            {canManageOrders && filteredOrders.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                className="flex items-center gap-2"
              >
                {selectedOrderIds.size === filteredOrders.length ? (
                  <CheckSquare className="w-4 h-4" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                {selectedOrderIds.size === filteredOrders.length 
                  ? t('orders.deselectAll') 
                  : t('orders.selectAll')}
              </Button>
            )}
          </div>
        </div>

        {/* Orders List */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            <AnimatePresence>
              {filteredOrders.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  <Receipt className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p>{t('general.noData')}</p>
                </div>
              ) : (
                filteredOrders.map((order, index) => (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    onClick={(e) => {
                      // Don't select order details if clicking on checkbox or delete button
                      if ((e.target as HTMLElement).closest('.order-checkbox') || 
                          (e.target as HTMLElement).closest('.order-delete-btn')) {
                        return;
                      }
                      setSelectedOrder(order);
                    }}
                    className={cn(
                      "p-4 rounded-xl bg-card border border-border transition-all",
                      selectedOrder?.id === order.id && "ring-2 ring-primary",
                      selectedOrderIds.has(order.id) && "bg-primary/5 border-primary/50",
                      canManageOrders ? "cursor-pointer hover:border-primary/50 hover:shadow-lg" : "cursor-pointer"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        {/* Checkbox for selection - Only for admin/chef */}
                        {canManageOrders && (
                          <button
                            className="order-checkbox flex-shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleSelect(order.id);
                            }}
                          >
                            {selectedOrderIds.has(order.id) ? (
                              <CheckSquare className="w-5 h-5 text-primary" />
                            ) : (
                              <Square className="w-5 h-5 text-muted-foreground" />
                            )}
                          </button>
                        )}
                        
                        <span className={cn(
                          "p-2 rounded-lg flex-shrink-0",
                          statusColors[order.status]
                        )}>
                          {statusIcons[order.status]}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold">{order.orderNumber}</div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(order.createdAt).toLocaleString()}
                          </div>
                          {order.createdBy && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {t('orders.cashierLabel')} {getCashierName(order.createdBy)}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="font-bold text-lg text-primary">
                            {formatCurrency(order.total, currency)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {order.lines.length} {order.lines.length > 1 ? t('order.itemLabelPlural') : t('order.itemLabel')}
                          </div>
                        </div>
                        
                        {/* Delete button - Only for admin/chef */}
                        {canManageOrders && (
                          <button
                            className="order-delete-btn p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors flex-shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              const message = t('orders.confirmDelete').replace('{orderNumber}', order.orderNumber);
                              setConfirmDialog({
                                open: true,
                                title: t('orders.delete'),
                                description: message,
                                variant: 'destructive',
                                onConfirm: async () => {
                                  setConfirmDialog(prev => ({ ...prev, open: false }));
                                  setIsDeleting(true);
                                  try {
                                    await deleteOrder(order.id);
                                    if (selectedOrder?.id === order.id) {
                                      setSelectedOrder(null);
                                    }
                                    setSelectedOrderIds(prev => {
                                      const newSet = new Set(prev);
                                      newSet.delete(order.id);
                                      return newSet;
                                    });
                                    await refreshOrders(); // Refresh paginated list
                                  } catch (error) {
                                    console.error('Error deleting order:', error);
                                    setConfirmDialog({
                                      open: true,
                                      title: t('orders.deleteError'),
                                      description: t('orders.deleteError'),
                                      variant: 'default',
                                      onConfirm: () => setConfirmDialog(prev => ({ ...prev, open: false })),
                                    });
                                  } finally {
                                    setIsDeleting(false);
                                  }
                                },
                              });
                            }}
                            disabled={isDeleting}
                            title={t('orders.delete')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-border flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {t('orders.showing')} {((currentPage - 1) * PAGE_SIZE) + 1}-{Math.min(currentPage * PAGE_SIZE, totalOrders)} {t('orders.of')} {totalOrders}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1 || isLoadingOrders}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-medium px-2">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || isLoadingOrders}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {isLoadingOrders && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}
      </div>

      {/* Order Details */}
      <AnimatePresence>
        {selectedOrder && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="w-[400px] border-l border-border bg-card flex flex-col overflow-hidden"
          >
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">{selectedOrder.orderNumber}</h2>
                <span className={cn(
                  "px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1",
                  statusColors[selectedOrder.status]
                )}>
                  {statusIcons[selectedOrder.status]}
                  {t(`status.${selectedOrder.status}`)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {new Date(selectedOrder.createdAt).toLocaleString()}
              </p>
              {selectedOrder.createdBy && (
                <p className="text-sm text-muted-foreground mt-1">
                  {t('orders.cashierLabel')} {getCashierName(selectedOrder.createdBy)}
                </p>
              )}
              
              {/* Status Change Buttons - Only for admin/chef */}
              {canManageOrders && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-2">{t('orders.changeStatus')}</p>
                  <div className="flex flex-wrap gap-1">
                    {(['draft', 'sentToKitchen', 'ready', 'paid', 'cancelled'] as const).map((status) => (
                      <button
                        key={status}
                        onClick={() => {
                          updateOrderStatus(selectedOrder.id, status);
                          setSelectedOrder({ ...selectedOrder, status });
                        }}
                        disabled={selectedOrder.status === status}
                        className={cn(
                          "px-2 py-1 rounded text-xs font-medium transition-all flex items-center gap-1",
                          selectedOrder.status === status
                            ? cn(statusColors[status], "opacity-100 ring-2 ring-offset-1 ring-primary")
                            : cn(statusColors[status], "opacity-60 hover:opacity-100")
                        )}
                      >
                        {statusIcons[status]}
                        {t(`status.${status}`)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Order Items */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-3">
                {selectedOrder.lines.map((line) => (
                  <div key={line.id} className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex justify-between">
                      <div>
                        <span className="font-medium">{line.quantity}x </span>
                        <span>{line.productName}</span>
                        {line.variantSize && (
                          <span className="text-muted-foreground"> ({line.variantSize})</span>
                        )}
                      </div>
                      <span className="font-bold">
                        {formatCurrency(line.unitPrice * line.quantity, currency)}
                      </span>
                    </div>
                    {line.modifiers.length > 0 && (
                      <div className="text-sm text-muted-foreground mt-1">
                        {line.modifiers.map(m => `(S) ${m.optionName}`).join(', ')}
                      </div>
                    )}
                    {line.note && (
                      <div className="text-sm text-primary italic mt-1">
                        {t('order.noteLabel')} {line.note}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="mt-4 pt-4 border-t border-border space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{t('order.subtotal')}</span>
                  <span>{formatCurrency(selectedOrder.subtotal, currency)}</span>
                </div>
                {selectedOrder.discount > 0 && (
                  <div className="flex justify-between text-sm text-success">
                    <span>{t('order.discount')} ({selectedOrder.promoCode})</span>
                    <span>-{formatCurrency(selectedOrder.discount, currency)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xl font-bold pt-2 border-t border-border">
                  <span>{t('order.total')}</span>
                  <span className="text-primary">{formatCurrency(selectedOrder.total, currency)}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-border space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={() => handlePrintKitchen(selectedOrder)}
                  variant="outline"
                  className="h-12"
                >
                  <ChefHat className="w-4 h-4 mr-2" />
                  {t('orders.kitchen')}
                </Button>
                <Button
                  onClick={() => handlePrintReceipt(selectedOrder)}
                  variant="outline"
                  className="h-12"
                >
                  <Receipt className="w-4 h-4 mr-2" />
                  {t('orders.receipt')}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Print Preview Modal */}
      {selectedOrder && (
        <PrintPreviewModal
          isOpen={showPrintModal}
          onClose={() => {
            setShowPrintModal(false);
            // Don't deselect the order - keep it visible in the details panel
          }}
          order={selectedOrder}
          settings={settings}
          currency={currency}
          type={printModalType}
          cashierName={getCashierName(selectedOrder.createdBy)}
          printers={printers || []}
        />
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => {
        if (!open) {
          setConfirmDialog(prev => ({ ...prev, open: false }));
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">
              {confirmDialog.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {t('general.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDialog.onConfirm}
              disabled={isDeleting}
              className={confirmDialog.variant === 'destructive' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              {isDeleting ? t('general.processing') : t('general.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
