import { useState, useEffect, useMemo } from 'react';
import { usePOS } from '@/contexts/POSContext';
import { useAuth } from '@/contexts/AuthContext';
import type { Supplier, InventoryItem, Invoice, InvoiceLine } from '@shared/types';
import { inventoryService } from '@/services/inventoryService';
import { formatCurrency, Currency } from '@/lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Edit,
  Trash2,
  Package,
  FileText,
  TrendingUp,
  Calendar,
  Search,
  Filter,
  Download,
  AlertTriangle,
  CheckCircle2,
  X,
  Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TouchInput } from '@/components/ui/touch-input';
import { NumericInput } from '@/components/ui/numeric-input';
import { TouchTextarea } from '@/components/ui/touch-textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useDialog } from '@/hooks/use-dialog';
import { cn } from '@/lib/utils';
import { generateUUID } from '@/lib/utils';
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

interface InventoryManagementProps {
  currency: Currency;
  t: (key: string) => string;
}

export function InventoryManagement({ currency, t }: InventoryManagementProps) {
  const { user } = useAuth();
  const { showAlert, DialogComponent } = useDialog();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [activeTab, setActiveTab] = useState<'suppliers' | 'items' | 'invoices' | 'reports'>('suppliers');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'month' | 'year'>('all');
  
  // Editing states
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState<{ open: boolean; type: 'supplier' | 'item' | 'invoice'; id: string; name: string }>({
    open: false,
    type: 'supplier',
    id: '',
    name: '',
  });

  // Load data
  useEffect(() => {
    loadSuppliers();
    loadInventoryItems();
    loadInvoices();
  }, []);

  const loadSuppliers = async () => {
    try {
      const all = await inventoryService.getAllSuppliers();
      setSuppliers(all);
    } catch (error) {
      console.error('Error loading suppliers:', error);
    }
  };

  const loadInventoryItems = async () => {
    try {
      const all = await inventoryService.getAllItems();
      setInventoryItems(all);
    } catch (error) {
      console.error('Error loading inventory items:', error);
    }
  };

  const loadInvoices = async () => {
    try {
      const all = await inventoryService.getAllInvoices();
      setInvoices(all);
    } catch (error) {
      console.error('Error loading invoices:', error);
    }
  };

  const saveSupplier = async (supplier: Supplier) => {
    try {
      await inventoryService.saveSupplier(supplier);
      await loadSuppliers();
      setEditingSupplier(null);
    } catch (error) {
      console.error('Error saving supplier:', error);
      await showAlert(t('inventory.saveError'), 'Erreur');
    }
  };

  const saveInventoryItem = async (item: InventoryItem) => {
    try {
      await inventoryService.saveItem(item);
      await loadInventoryItems();
      setEditingItem(null);
    } catch (error) {
      console.error('Error saving inventory item:', error);
      await showAlert(t('inventory.saveError'), 'Erreur');
    }
  };

  const saveInvoice = async (invoice: Invoice) => {
    try {
      // Le serveur gère la mise à jour des stocks automatiquement
      await inventoryService.saveInvoice(invoice);
      await Promise.all([loadInvoices(), loadInventoryItems()]);
      setEditingInvoice(null);
    } catch (error) {
      console.error('Error saving invoice:', error);
      await showAlert(t('inventory.saveError'), 'Erreur');
    }
  };

  const deleteSupplier = async (id: string) => {
    try {
      await inventoryService.deleteSupplier(id);
      await loadSuppliers();
      setShowDeleteDialog({ open: false, type: 'supplier', id: '', name: '' });
    } catch (error) {
      console.error('Error deleting supplier:', error);
      await showAlert(t('inventory.deleteError'), 'Erreur');
    }
  };

  const deleteInventoryItem = async (id: string) => {
    try {
      await inventoryService.deleteItem(id);
      await loadInventoryItems();
      setShowDeleteDialog({ open: false, type: 'item', id: '', name: '' });
    } catch (error) {
      console.error('Error deleting inventory item:', error);
      await showAlert(t('inventory.deleteError'), 'Erreur');
    }
  };

  const deleteInvoice = async (id: string) => {
    try {
      // Le serveur annule les changements de stock automatiquement
      await inventoryService.deleteInvoice(id);
      await Promise.all([loadInvoices(), loadInventoryItems()]);
      setShowDeleteDialog({ open: false, type: 'invoice', id: '', name: '' });
    } catch (error) {
      console.error('Error deleting invoice:', error);
      await showAlert(t('inventory.deleteError'), 'Erreur');
    }
  };

  // Filtered data
  const filteredSuppliers = useMemo(() => {
    if (!search) return suppliers;
    return suppliers.filter(s => 
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.contact?.toLowerCase().includes(search.toLowerCase()) ||
      s.phone?.toLowerCase().includes(search.toLowerCase())
    );
  }, [suppliers, search]);

  const filteredItems = useMemo(() => {
    let filtered = inventoryItems;
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(item => item.category === categoryFilter);
    }
    if (search) {
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(search.toLowerCase())
      );
    }
    return filtered;
  }, [inventoryItems, categoryFilter, search]);

  const filteredInvoices = useMemo(() => {
    let filtered = invoices;
    if (dateRange !== 'all') {
      const now = new Date();
      const startDate = new Date();
      switch (dateRange) {
        case 'today':
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          startDate.setFullYear(now.getFullYear() - 1);
          break;
      }
      filtered = filtered.filter(inv => new Date(inv.date) >= startDate);
    }
    if (search) {
      filtered = filtered.filter(inv => 
        inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
        inv.supplierName.toLowerCase().includes(search.toLowerCase())
      );
    }
    return filtered;
  }, [invoices, dateRange, search]);

  // Statistics
  const totalStockValue = useMemo(() => {
    return inventoryItems.reduce((sum, item) => sum + (item.currentStock * item.unitPrice), 0);
  }, [inventoryItems]);

  const beverageCount = useMemo(() => {
    return inventoryItems.filter(item => item.category === 'beverage').length;
  }, [inventoryItems]);

  const lowStockItems = useMemo(() => {
    return inventoryItems.filter(item => 
      item.minStock !== undefined && item.currentStock <= item.minStock
    );
  }, [inventoryItems]);

  const periodTotal = useMemo(() => {
    return filteredInvoices.reduce((sum, inv) => sum + inv.total, 0);
  }, [filteredInvoices]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <h2 className="text-xl sm:text-2xl font-bold">{t('inventory.title')}</h2>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-card border border-border rounded-lg">
          <div className="text-sm text-muted-foreground">{t('inventory.totalStockValue')}</div>
          <div className="text-2xl font-bold text-primary mt-1">
            {formatCurrency(totalStockValue, currency)}
          </div>
        </div>
        <div className="p-4 bg-card border border-border rounded-lg">
          <div className="text-sm text-muted-foreground">{t('inventory.totalItems')}</div>
          <div className="text-2xl font-bold mt-1">{inventoryItems.length}</div>
        </div>
        <div className="p-4 bg-card border border-border rounded-lg">
          <div className="text-sm text-muted-foreground">{t('inventory.beverageCount')}</div>
          <div className="text-2xl font-bold mt-1">{beverageCount}</div>
        </div>
        <div className="p-4 bg-card border border-border rounded-lg">
          <div className="text-sm text-muted-foreground">{t('inventory.lowStock')}</div>
          <div className="text-2xl font-bold text-destructive mt-1">{lowStockItems.length}</div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="suppliers">{t('inventory.suppliers')}</TabsTrigger>
          <TabsTrigger value="items">{t('inventory.items')}</TabsTrigger>
          <TabsTrigger value="invoices">{t('inventory.invoices')}</TabsTrigger>
          <TabsTrigger value="reports">{t('inventory.reports')}</TabsTrigger>
        </TabsList>

        {/* Suppliers Tab */}
        <TabsContent value="suppliers" className="space-y-4">
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <TouchInput
                value={search}
                onChange={setSearch}
                placeholder={t('general.search')}
                className="pl-10"
              />
            </div>
            <Button onClick={() => setEditingSupplier({
              id: generateUUID(),
              name: '',
              createdAt: new Date(),
              updatedAt: new Date(),
            })}>
              <Plus className="w-4 h-4 mr-2" />
              {t('inventory.addSupplier')}
            </Button>
          </div>

          <div className="space-y-2">
            {filteredSuppliers.map(supplier => (
              <div key={supplier.id} className="p-4 bg-card border border-border rounded-lg flex items-center justify-between">
                <div>
                  <div className="font-bold">{supplier.name}</div>
                  {supplier.phone && <div className="text-sm text-muted-foreground">{supplier.phone}</div>}
                  {supplier.email && <div className="text-sm text-muted-foreground">{supplier.email}</div>}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditingSupplier(supplier)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog({
                    open: true,
                    type: 'supplier',
                    id: supplier.id,
                    name: supplier.name,
                  })}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Inventory Items Tab */}
        <TabsContent value="items" className="space-y-4">
          <div className="flex gap-2 items-center flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <TouchInput
                value={search}
                onChange={setSearch}
                placeholder={t('general.search')}
                className="pl-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('general.all')}</SelectItem>
                <SelectItem value="food">{t('inventory.category.food')}</SelectItem>
                <SelectItem value="beverage">{t('inventory.category.beverage')}</SelectItem>
                <SelectItem value="supplies">{t('inventory.category.supplies')}</SelectItem>
                <SelectItem value="other">{t('inventory.category.other')}</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setEditingItem({
              id: generateUUID(),
              name: '',
              category: 'food',
              unit: 'piece',
              currentStock: 0,
              unitPrice: 0,
              createdAt: new Date(),
              updatedAt: new Date(),
            })}>
              <Plus className="w-4 h-4 mr-2" />
              {t('inventory.addItem')}
            </Button>
          </div>

          <div className="space-y-2">
            {filteredItems.map(item => (
              <div key={item.id} className="p-4 bg-card border border-border rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-bold">{item.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {t(`inventory.category.${item.category}`)} • {item.currentStock} {item.unit}
                      {item.minStock !== undefined && item.currentStock <= item.minStock && (
                        <span className="text-destructive ml-2">⚠ {t('inventory.lowStock')}</span>
                      )}
                    </div>
                    <div className="text-sm font-semibold mt-1">
                      {formatCurrency(item.unitPrice, currency)} / {item.unit}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditingItem(item)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog({
                      open: true,
                      type: 'item',
                      id: item.id,
                      name: item.name,
                    })}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="space-y-4">
          <div className="flex gap-2 items-center flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <TouchInput
                value={search}
                onChange={setSearch}
                placeholder={t('general.search')}
                className="pl-10"
              />
            </div>
            <Select value={dateRange} onValueChange={(v) => setDateRange(v as any)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('general.all')}</SelectItem>
                <SelectItem value="today">{t('inventory.period.today')}</SelectItem>
                <SelectItem value="week">{t('inventory.period.week')}</SelectItem>
                <SelectItem value="month">{t('inventory.period.month')}</SelectItem>
                <SelectItem value="year">{t('inventory.period.year')}</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setEditingInvoice({
              id: generateUUID(),
              invoiceNumber: `INV-${Date.now()}`,
              supplierId: '',
              supplierName: '',
              date: new Date(),
              lines: [],
              subtotal: 0,
              total: 0,
              createdAt: new Date(),
              updatedAt: new Date(),
            })}>
              <Plus className="w-4 h-4 mr-2" />
              {t('inventory.addInvoice')}
            </Button>
          </div>

          <div className="space-y-2">
            {filteredInvoices.map(invoice => (
              <div key={invoice.id} className="p-4 bg-card border border-border rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold">{invoice.invoiceNumber}</div>
                    <div className="text-sm text-muted-foreground">{invoice.supplierName}</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(invoice.date).toLocaleDateString()} • {formatCurrency(invoice.total, currency)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditingInvoice(invoice)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog({
                      open: true,
                      type: 'invoice',
                      id: invoice.id,
                      name: invoice.invoiceNumber,
                    })}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-4">
          <div className="flex gap-2 items-center">
            <Select value={dateRange} onValueChange={(v) => setDateRange(v as any)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('general.all')}</SelectItem>
                <SelectItem value="today">{t('inventory.period.today')}</SelectItem>
                <SelectItem value="week">{t('inventory.period.week')}</SelectItem>
                <SelectItem value="month">{t('inventory.period.month')}</SelectItem>
                <SelectItem value="year">{t('inventory.period.year')}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => {
              const csv = generateReportCSV(filteredInvoices, inventoryItems);
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const link = document.createElement('a');
              const url = URL.createObjectURL(blob);
              link.setAttribute('href', url);
              link.setAttribute('download', `inventory_report_${new Date().toISOString().split('T')[0]}.csv`);
              link.style.visibility = 'hidden';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}>
              <Download className="w-4 h-4 mr-2" />
              {t('inventory.exportReport')}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-card border border-border rounded-lg">
              <h3 className="font-bold mb-2">{t('inventory.periodTotal')}</h3>
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(periodTotal, currency)}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {filteredInvoices.length} {t('inventory.invoices')}
              </div>
            </div>
            <div className="p-4 bg-card border border-border rounded-lg">
              <h3 className="font-bold mb-2">{t('inventory.totalStockValue')}</h3>
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(totalStockValue, currency)}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {inventoryItems.length} {t('inventory.items')}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Supplier Modal */}
      {editingSupplier && (
        <SupplierModal
          supplier={editingSupplier}
          onClose={() => setEditingSupplier(null)}
          onSave={saveSupplier}
          t={t}
        />
      )}

      {/* Inventory Item Modal */}
      {editingItem && (
        <InventoryItemModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={saveInventoryItem}
          currency={currency}
          t={t}
        />
      )}

      {/* Invoice Modal */}
      {editingInvoice && (
        <InvoiceModal
          invoice={editingInvoice}
          suppliers={suppliers}
          inventoryItems={inventoryItems}
          onClose={() => setEditingInvoice(null)}
          onSave={saveInvoice}
          currency={currency}
          user={user}
          t={t}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog.open} onOpenChange={(open) => {
        if (!open) setShowDeleteDialog({ open: false, type: 'supplier', id: '', name: '' });
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('inventory.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('inventory.confirmDeleteMessage').replace('{name}', showDeleteDialog.name)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('general.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (showDeleteDialog.type === 'supplier') {
                  deleteSupplier(showDeleteDialog.id);
                } else if (showDeleteDialog.type === 'item') {
                  deleteInventoryItem(showDeleteDialog.id);
                } else if (showDeleteDialog.type === 'invoice') {
                  deleteInvoice(showDeleteDialog.id);
                }
              }}
            >
              {t('general.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function generateReportCSV(invoices: Invoice[], items: InventoryItem[]): string {
  const headers = ['Type', 'Date', 'Numéro', 'Fournisseur', 'Article', 'Quantité', 'Prix unitaire', 'Total'];
  const rows: string[][] = [];
  
  invoices.forEach(inv => {
    inv.lines.forEach(line => {
      rows.push([
        'Facture',
        new Date(inv.date).toLocaleDateString('fr-FR'),
        inv.invoiceNumber,
        inv.supplierName,
        line.itemName,
        line.quantity.toString(),
        line.unitPrice.toString(),
        line.total.toString(),
      ]);
    });
  });
  
  return [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
}

// Supplier Modal Component
function SupplierModal({ supplier, onClose, onSave, t }: {
  supplier: Supplier;
  onClose: () => void;
  onSave: (supplier: Supplier) => void;
  t: (key: string) => string;
}) {
  const [formData, setFormData] = useState(supplier);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-card rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">{t('inventory.supplier')}</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">{t('general.name')} *</label>
            <TouchInput
              value={formData.name}
              onChange={(value) => setFormData({ ...formData, name: value })}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t('inventory.contact')}</label>
            <TouchInput
              value={formData.contact || ''}
              onChange={(value) => setFormData({ ...formData, contact: value })}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t('inventory.phone')}</label>
            <TouchInput
              value={formData.phone || ''}
              onChange={(value) => setFormData({ ...formData, phone: value })}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t('inventory.email')}</label>
            <TouchInput
              value={formData.email || ''}
              onChange={(value) => setFormData({ ...formData, email: value })}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t('inventory.address')}</label>
            <TouchTextarea
              value={formData.address || ''}
              onChange={(value) => setFormData({ ...formData, address: value })}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t('inventory.notes')}</label>
            <TouchTextarea
              value={formData.notes || ''}
              onChange={(value) => setFormData({ ...formData, notes: value })}
              className="mt-1"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              {t('general.cancel')}
            </Button>
            <Button onClick={() => {
              formData.updatedAt = new Date();
              onSave(formData);
            }} className="flex-1" disabled={!formData.name}>
              <Save className="w-4 h-4 mr-2" />
              {t('general.save')}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// Inventory Item Modal Component
function InventoryItemModal({ item, onClose, onSave, currency, t }: {
  item: InventoryItem;
  onClose: () => void;
  onSave: (item: InventoryItem) => void;
  currency: Currency;
  t: (key: string) => string;
}) {
  const [formData, setFormData] = useState(item);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-card rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">{t('inventory.item')}</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">{t('general.name')} *</label>
            <TouchInput
              value={formData.name}
              onChange={(value) => setFormData({ ...formData, name: value })}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t('inventory.category')}</label>
            <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v as any })}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="food">{t('inventory.category.food')}</SelectItem>
                <SelectItem value="beverage">{t('inventory.category.beverage')}</SelectItem>
                <SelectItem value="supplies">{t('inventory.category.supplies')}</SelectItem>
                <SelectItem value="other">{t('inventory.category.other')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">{t('inventory.unit')}</label>
              <TouchInput
                value={formData.unit}
                onChange={(value) => setFormData({ ...formData, unit: value })}
                className="mt-1"
                placeholder="kg, L, piece..."
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('inventory.currentStock')}</label>
              <NumericInput
                value={formData.currentStock}
                onChange={(value) => setFormData({ ...formData, currentStock: value })}
                className="mt-1"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">{t('inventory.minStock')}</label>
              <NumericInput
                value={formData.minStock || 0}
                onChange={(value) => setFormData({ ...formData, minStock: value || undefined })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('inventory.unitPrice')}</label>
              <NumericInput
                value={formData.unitPrice}
                onChange={(value) => setFormData({ ...formData, unitPrice: value })}
                className="mt-1"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              {t('general.cancel')}
            </Button>
            <Button onClick={() => {
              formData.updatedAt = new Date();
              onSave(formData);
            }} className="flex-1" disabled={!formData.name || !formData.unit}>
              <Save className="w-4 h-4 mr-2" />
              {t('general.save')}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// Invoice Modal Component
function InvoiceModal({ invoice, suppliers, inventoryItems, onClose, onSave, currency, user, t }: {
  invoice: Invoice;
  suppliers: Supplier[];
  inventoryItems: InventoryItem[];
  onClose: () => void;
  onSave: (invoice: Invoice) => void;
  currency: Currency;
  user?: { id: string; name: string } | null;
  t: (key: string) => string;
}) {
  const [formData, setFormData] = useState(invoice);
  const [newLine, setNewLine] = useState<Partial<InvoiceLine>>({
    itemName: '',
    quantity: 1,
    unit: 'piece',
    unitPrice: 0,
  });

  const selectedSupplier = suppliers.find(s => s.id === formData.supplierId);

  const addLine = () => {
    if (!newLine.itemName || !newLine.quantity || !newLine.unitPrice) return;
    const line: InvoiceLine = {
      id: generateUUID(),
      inventoryItemId: newLine.inventoryItemId,
      itemName: newLine.itemName,
      quantity: newLine.quantity,
      unit: newLine.unit || 'piece',
      unitPrice: newLine.unitPrice,
      total: newLine.quantity * newLine.unitPrice,
    };
    setFormData({
      ...formData,
      lines: [...formData.lines, line],
    });
    setNewLine({ itemName: '', quantity: 1, unit: 'piece', unitPrice: 0 });
  };

  const removeLine = (lineId: string) => {
    setFormData({
      ...formData,
      lines: formData.lines.filter(l => l.id !== lineId),
    });
  };

  const updateLine = (lineId: string, updates: Partial<InvoiceLine>) => {
    setFormData({
      ...formData,
      lines: formData.lines.map(l => {
        if (l.id === lineId) {
          const updated = { ...l, ...updates };
          if (updates.quantity !== undefined || updates.unitPrice !== undefined) {
            updated.total = updated.quantity * updated.unitPrice;
          }
          return updated;
        }
        return l;
      }),
    });
  };

  const subtotal = formData.lines.reduce((sum, line) => sum + line.total, 0);
  const tax = formData.tax || 0;
  const discount = formData.discount || 0;
  const total = subtotal + tax - discount;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-card rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">{t('inventory.invoice')}</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">{t('inventory.invoiceNumber')}</label>
              <TouchInput
                value={formData.invoiceNumber}
                onChange={(value) => setFormData({ ...formData, invoiceNumber: value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('inventory.supplier')} *</label>
              <Select
                value={formData.supplierId}
                onValueChange={(value) => {
                  const supplier = suppliers.find(s => s.id === value);
                  setFormData({
                    ...formData,
                    supplierId: value,
                    supplierName: supplier?.name || '',
                  });
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">{t('inventory.date')}</label>
            <Input
              type="date"
              value={new Date(formData.date).toISOString().split('T')[0]}
              onChange={(e) => setFormData({ ...formData, date: new Date(e.target.value) })}
              className="mt-1"
            />
          </div>

          {/* Invoice Lines */}
          <div>
            <label className="text-sm font-medium mb-2 block">{t('inventory.items')}</label>
            <div className="space-y-2 border border-border rounded-lg p-4">
              {formData.lines.map((line, index) => (
                <div key={line.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                  <div className="flex-1 grid grid-cols-5 gap-2">
                    <div className="col-span-2">
                      <Input value={line.itemName} onChange={(e) => updateLine(line.id, { itemName: e.target.value })} />
                    </div>
                    <NumericInput value={line.quantity} onChange={(v) => updateLine(line.id, { quantity: v })} />
                    <Input value={line.unit} onChange={(e) => updateLine(line.id, { unit: e.target.value })} />
                    <NumericInput value={line.unitPrice} onChange={(v) => updateLine(line.id, { unitPrice: v })} />
                  </div>
                  <div className="font-bold min-w-[100px] text-right">
                    {formatCurrency(line.total, currency)}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeLine(line.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
              
              {/* Add new line */}
              <div className="flex items-center gap-2 p-2 border border-dashed rounded">
                <div className="flex-1 grid grid-cols-5 gap-2">
                  <div className="col-span-2">
                    <Select
                      value={newLine.inventoryItemId || ''}
                      onValueChange={(value) => {
                        const item = inventoryItems.find(i => i.id === value);
                        setNewLine({
                          ...newLine,
                          inventoryItemId: value,
                          itemName: item?.name || '',
                          unit: item?.unit || 'piece',
                          unitPrice: item?.unitPrice || 0,
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('inventory.selectItem')} />
                      </SelectTrigger>
                      <SelectContent>
                        {inventoryItems.map(item => (
                          <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <NumericInput
                    value={newLine.quantity || 1}
                    onChange={(v) => setNewLine({ ...newLine, quantity: v })}
                    placeholder="Qty"
                  />
                  <Input
                    value={newLine.unit || 'piece'}
                    onChange={(e) => setNewLine({ ...newLine, unit: e.target.value })}
                    placeholder="Unit"
                  />
                  <NumericInput
                    value={newLine.unitPrice || 0}
                    onChange={(v) => setNewLine({ ...newLine, unitPrice: v })}
                    placeholder="Price"
                  />
                </div>
                <Button onClick={addLine} disabled={!newLine.itemName}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Totals */}
          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between">
              <span>{t('inventory.subtotal')}</span>
              <span>{formatCurrency(subtotal, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('inventory.tax')}</span>
              <NumericInput
                value={tax}
                onChange={(v) => setFormData({ ...formData, tax: v })}
                className="w-[150px]"
              />
            </div>
            <div className="flex justify-between">
              <span>{t('inventory.discount')}</span>
              <NumericInput
                value={discount}
                onChange={(v) => setFormData({ ...formData, discount: v })}
                className="w-[150px]"
              />
            </div>
            <div className="flex justify-between font-bold text-lg border-t pt-2">
              <span>{t('inventory.total')}</span>
              <span>{formatCurrency(total, currency)}</span>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">{t('inventory.notes')}</label>
            <TouchTextarea
              value={formData.notes || ''}
              onChange={(value) => setFormData({ ...formData, notes: value })}
              className="mt-1"
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              {t('general.cancel')}
            </Button>
            <Button onClick={() => {
              const finalInvoice: Invoice = {
                ...formData,
                subtotal,
                total,
                updatedAt: new Date(),
                createdBy: user?.id,
              };
              onSave(finalInvoice);
            }} className="flex-1" disabled={!formData.supplierId || formData.lines.length === 0}>
              <Save className="w-4 h-4 mr-2" />
              {t('general.save')}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
