import { useState, useEffect, useMemo, useCallback } from 'react';
import { usePOS } from '@/contexts/POSContext';
import { useAuth } from '@/contexts/AuthContext';
import { Language, Currency, LANGUAGES, CURRENCIES } from '@/lib/i18n';
import { Promotion, PromoType, Product, ProductVariant, User, UserRole, Printer as PrinterType, PrinterRole, PrinterMode, PrinterConnectionType, ReceiptCustomization } from '@/lib/database';
import { motion, AnimatePresence } from 'framer-motion';
import { generateUUID } from '@/lib/utils';
import { 
  Globe, 
  DollarSign, 
  Palette, 
  Printer,
  Receipt,
  Tag,
  Store,
  Moon,
  Sun,
  ChevronRight,
  Check,
  Plus,
  Edit,
  Trash2,
  X,
  Calendar,
  Package,
  Upload,
  Download,
  Save,
  Users,
  Network,
  Wifi,
  AlertCircle,
  Activity,
  Loader2,
  Warehouse,
  Database,
  FolderOpen,
  RefreshCw,
  Server
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { TouchInput } from '@/components/ui/touch-input';
import { TouchTextarea } from '@/components/ui/touch-textarea';
import { NumericInput } from '@/components/ui/numeric-input';
import { IPInput } from '@/components/ui/ip-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/i18n';
import { toast } from '@/hooks/use-toast';
import { useDialog } from '@/hooks/use-dialog';
import { ProductsManagement } from './ProductsManagement';
import { UserModal } from './UserModal';
import { ReceiptCustomizationSection } from './ReceiptCustomizationSection';
import { InventoryManagement } from './InventoryManagement';

type SettingsSection = 'general' | 'branding' | 'printers' | 'receipt' | 'promotions' | 'theme' | 'products' | 'users' | 'inventory' | 'data';

const sections: { id: SettingsSection; icon: React.ReactNode }[] = [
  { id: 'general', icon: <Globe className="w-5 h-5" /> },
  { id: 'branding', icon: <Store className="w-5 h-5" /> },
  { id: 'products', icon: <Package className="w-5 h-5" /> },
  { id: 'inventory', icon: <Warehouse className="w-5 h-5" /> },
  { id: 'printers', icon: <Printer className="w-5 h-5" /> },
  { id: 'receipt', icon: <Receipt className="w-5 h-5" /> },
  { id: 'promotions', icon: <Tag className="w-5 h-5" /> },
  { id: 'theme', icon: <Palette className="w-5 h-5" /> },
  { id: 'users', icon: <Users className="w-5 h-5" /> },
  { id: 'data', icon: <Database className="w-5 h-5" /> },
];

export function SettingsScreen() {
  const { settings, updateSettings, t, printers, updatePrinter, deletePrinter, promotions, savePromotion, deletePromotion, loadPromotions, currency, resetDatabase, exportProductsTemplate, importProductsTemplate, categories, products, variants, saveProduct, deleteProduct, loadProducts, getVariantsByProduct, saveCategory, deleteCategory, loadCategories } = usePOS();
  const { canAccessSettingsSection, hasPermission, users, loadUsers, saveUser, deleteUser, user } = useAuth();
  const { showDialog, showAlert, DialogComponent } = useDialog();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isExportingTemplate, setIsExportingTemplate] = useState(false);
  const [isImportingTemplate, setIsImportingTemplate] = useState(false);
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [daemonStatus, setDaemonStatus] = useState<{
    running: boolean;
    status?: string;
    message?: string;
    version?: string;
    error?: string;
    daemonProcess?: { pid: number | undefined; killed: boolean };
  } | null>(null);
  const [isCheckingDaemon, setIsCheckingDaemon] = useState(false);

  // Check daemon status function (memoized to avoid recreating on each render)
  const checkDaemonStatus = useCallback(async () => {
    try {
      if (typeof window === 'undefined' || !window.electronAPI || !window.electronAPI.getDaemonStatus) {
        return;
      }
      
      setIsCheckingDaemon(true);
      const status = await window.electronAPI.getDaemonStatus();
      setDaemonStatus(status);
    } catch (error) {
      console.error('Error checking daemon status:', error);
      setDaemonStatus({
        running: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsCheckingDaemon(false);
    }
  }, []);

  // Check daemon status when data section is active
  useEffect(() => {
    if (activeSection === 'data' && typeof window !== 'undefined' && window.electronAPI && window.electronAPI.getDaemonStatus) {
      checkDaemonStatus().catch(console.error);
      // Check every 5 seconds
      const interval = setInterval(() => {
        checkDaemonStatus().catch(console.error);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [activeSection, checkDaemonStatus]);

  const handleRestartDaemon = async () => {
    if (typeof window === 'undefined' || !window.electronAPI || !window.electronAPI.restartDaemon) {
      await showAlert('L\'API Electron n\'est pas disponible.', 'Erreur');
      return;
    }
    
    try {
      const result = await window.electronAPI.restartDaemon();
      if (result.success) {
        toast({
          title: 'Daemon redémarré',
          description: result.message || 'Le daemon d\'impression a été redémarré avec succès.',
        });
        // Recheck status after 1 second
        setTimeout(checkDaemonStatus, 1000);
      } else {
        await showAlert(result.error || 'Erreur lors du redémarrage du daemon', 'Erreur');
      }
    } catch (error) {
      console.error('Error restarting daemon:', error);
      await showAlert('Erreur lors du redémarrage du daemon', 'Erreur');
    }
  };

  if (!settings) return null;

  // Filter sections based on permissions
  const accessibleSections = sections.filter(section => canAccessSettingsSection(section.id));
  
  // Set default section if current one is not accessible
  useEffect(() => {
    if (accessibleSections.length > 0 && !canAccessSettingsSection(activeSection)) {
      setActiveSection(accessibleSections[0].id);
    }
  }, [activeSection, accessibleSections, canAccessSettingsSection]);

  // Export all data to backup file
  const handleExportBackup = async () => {
    // Check if we're in Electron
    const isElectron = typeof window !== 'undefined' && window.electronAPI;
    
    if (!isElectron) {
      console.error('electronAPI check:', {
        windowExists: typeof window !== 'undefined',
        electronAPI: typeof window !== 'undefined' ? window.electronAPI : 'N/A',
        allKeys: typeof window !== 'undefined' ? Object.keys(window).filter(k => k.toLowerCase().includes('electron')) : [],
      });
      await showAlert(
        'L\'API Electron n\'est pas disponible.\n\n' +
        'Assurez-vous que :\n' +
        '1. Vous utilisez la version desktop (npm run electron:dev)\n' +
        '2. L\'application Electron est bien lancée\n' +
        '3. Le preload est correctement chargé\n\n' +
        'Vérifiez la console pour plus de détails.',
        'Erreur'
      );
      return;
    }

    setIsExporting(true);
    try {
      const { getDB } = await import('@/lib/database');
      const db = await getDB();

      // Export all data from all stores
      const backupData = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        data: {
          categories: await db.getAll('categories'),
          products: await db.getAll('products'),
          productVariants: await db.getAll('productVariants'),
          modifierGroups: await db.getAll('modifierGroups'),
          modifierOptions: await db.getAll('modifierOptions'),
          orders: await db.getAll('orders'),
          printers: await db.getAll('printers'),
          printJobs: await db.getAll('printJobs'),
          promotions: await db.getAll('promotions'),
          settings: await db.getAll('settings'),
          numberingCounters: await db.getAll('numberingCounters'),
          users: await db.getAll('users'),
          userSessions: await db.getAll('userSessions'),
          suppliers: await db.getAll('suppliers'),
          inventoryItems: await db.getAll('inventoryItems'),
          invoices: await db.getAll('invoices'),
        },
      };

      const jsonData = JSON.stringify(backupData, null, 2);
      const fileName = `backup-quick-order-hub-${new Date().toISOString().split('T')[0]}.json`;

      // Show save dialog
      const result = await window.electronAPI.showSaveDialog({
        title: 'Sauvegarder la sauvegarde',
        defaultPath: fileName,
        filters: [
          { name: 'Fichiers JSON', extensions: ['json'] },
          { name: 'Tous les fichiers', extensions: ['*'] },
        ],
      });

      if (!result.canceled && result.filePath) {
        await window.electronAPI.saveBackup(jsonData, result.filePath);
        await showAlert('Sauvegarde créée avec succès !', 'Succès');
      }
    } catch (error) {
      console.error('Export error:', error);
      await showAlert('Erreur lors de la création de la sauvegarde: ' + (error instanceof Error ? error.message : 'Erreur inconnue'), 'Erreur');
    } finally {
      setIsExporting(false);
    }
  };

  // Import data from backup file
  const handleImportBackup = async () => {
    // Check if we're in Electron
    const isElectron = typeof window !== 'undefined' && window.electronAPI;
    
    if (!isElectron) {
      await showAlert(
        'L\'API Electron n\'est pas disponible.\n\n' +
        'Assurez-vous que vous utilisez la version desktop de l\'application.',
        'Erreur'
      );
      return;
    }

    const confirmed = await showDialog({
      title: '⚠️ ATTENTION',
      description: 'L\'importation d\'une sauvegarde remplacera TOUTES les données actuelles. Cette action est irréversible.\n\nÊtes-vous sûr de vouloir continuer ?',
      confirmText: 'Continuer',
      cancelText: 'Annuler',
      variant: 'destructive',
    });

    if (!confirmed) return;

    setIsImporting(true);
    try {
      // Show open dialog
      const result = await window.electronAPI.showOpenDialog({
        title: 'Importer une sauvegarde',
        filters: [
          { name: 'Fichiers JSON', extensions: ['json'] },
          { name: 'Tous les fichiers', extensions: ['*'] },
        ],
        properties: ['openFile'],
      });

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        setIsImporting(false);
        return;
      }

      const filePath = result.filePaths[0];
      const loadResult = await window.electronAPI.loadBackup(filePath);

      if (!loadResult.success || !loadResult.data) {
        throw new Error('Impossible de lire le fichier de sauvegarde');
      }

      const backupData = JSON.parse(loadResult.data);

      // Validate backup structure
      if (!backupData.data || typeof backupData.data !== 'object') {
        throw new Error('Format de sauvegarde invalide');
      }

      const { getDB } = await import('@/lib/database');
      const db = await getDB();

      // Import all data
      const stores = [
        'categories', 'products', 'productVariants', 'modifierGroups', 'modifierOptions',
        'orders', 'printers', 'printJobs', 'promotions', 'settings', 'numberingCounters',
        'users', 'userSessions', 'suppliers', 'inventoryItems', 'invoices',
      ];

      for (const storeName of stores) {
        if (backupData.data[storeName] && Array.isArray(backupData.data[storeName])) {
          // Clear existing data
          const tx = db.transaction(storeName, 'readwrite');
          await tx.store.clear();
          await tx.done;

          // Import new data
          for (const item of backupData.data[storeName]) {
            await db.put(storeName, item);
          }
        }
      }

      // Reload all data
      await loadCategories();
      await loadProducts();
      await loadPromotions();
      await loadUsers();
      
      // Reload page to refresh all data
      window.location.reload();

      await showAlert('Sauvegarde importée avec succès ! L\'application va se recharger.', 'Succès');
    } catch (error) {
      console.error('Import error:', error);
      await showAlert('Erreur lors de l\'importation de la sauvegarde: ' + (error instanceof Error ? error.message : 'Erreur inconnue'), 'Erreur');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
      {DialogComponent}
      <div className="h-full flex flex-col md:flex-row overflow-hidden">
      {/* Mobile Menu */}
      <div className="md:hidden border-b border-border bg-card p-3 flex items-center justify-between">
        <h1 className="text-lg font-bold">{t('settings.title')}</h1>
        <Select value={activeSection} onValueChange={(value) => setActiveSection(value as SettingsSection)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {accessibleSections.map((section) => (
              <SelectItem key={section.id} value={section.id}>
                <div className="flex items-center gap-2">
                  {section.icon}
                  <span>{t(`settings.${section.id}`)}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-[260px] bg-sidebar border-r border-sidebar-border overflow-y-auto flex-shrink-0">
        <div className="w-full">
          <div className="p-4 border-b border-sidebar-border">
            <h1 className="text-xl font-bold">{t('settings.title')}</h1>
          </div>
          <nav className="p-2 space-y-1">
            {accessibleSections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left",
                  activeSection === section.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-sidebar-accent"
                )}
              >
                {section.icon}
                <span className="font-medium flex-1">{t(`settings.${section.id}`) || section.labelKey}</span>
                <ChevronRight className="w-4 h-4 opacity-50" />
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
        <div className={cn("max-w-2xl", (activeSection === 'products' || activeSection === 'receipt' || activeSection === 'inventory') && "max-w-full")}>
          {activeSection === 'general' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <h2 className="text-xl sm:text-2xl font-bold">{t('general.generalSettings')}</h2>
              
              {/* Language */}
              <div>
                <label className="text-xs sm:text-sm font-medium text-muted-foreground block mb-2 sm:mb-3">
                  {t('settings.language')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(LANGUAGES) as [Language, typeof LANGUAGES[Language]][]).map(([code, lang]) => (
                    <button
                      key={code}
                      onClick={() => updateSettings({ language: code })}
                      className={cn(
                        "p-3 sm:p-4 rounded-xl border-2 transition-all text-center",
                        settings.language === code
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <span className="font-medium text-sm sm:text-base">{lang.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Currency */}
              <div>
                <label className="text-xs sm:text-sm font-medium text-muted-foreground block mb-2 sm:mb-3">
                  {t('settings.currency')}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(Object.keys(CURRENCIES) as Currency[]).map((code) => (
                    <button
                      key={code}
                      onClick={() => updateSettings({ currency: code })}
                      className={cn(
                        "p-3 sm:p-4 rounded-xl border-2 transition-all text-center",
                        settings.currency === code
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <span className="font-bold text-base sm:text-lg">{CURRENCIES[code].symbol}</span>
                      <span className="block text-xs sm:text-sm text-muted-foreground">{code}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Kiosk Mode */}
              <div className="flex items-center justify-between p-3 sm:p-4 bg-muted/50 rounded-xl">
                <div>
                  <span className="font-medium text-sm sm:text-base">{t('settings.kioskMode')}</span>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {settings.kioskMode ? t('settings.kioskOn') : t('settings.kioskOff')}
                  </p>
                </div>
                <Switch
                  checked={settings.kioskMode}
                  onCheckedChange={(checked) => updateSettings({ kioskMode: checked })}
                />
              </div>

              {/* Paiement par carte */}
              <div className="p-4 bg-muted/50 rounded-lg border border-border">
                <div className="flex items-center justify-between">
                  <div className="flex-1 pr-4">
                    <label className="text-sm font-medium block mb-1">
                      Paiement par carte
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Activer ou désactiver le paiement par carte bancaire
                    </p>
                  </div>
                  <Switch
                    checked={settings.cardPaymentEnabled === true}
                    onCheckedChange={(checked) => updateSettings({ cardPaymentEnabled: checked })}
                  />
                </div>
              </div>

              {/* Version & Copyright */}
              <div className="pt-6 mt-6 border-t border-border">
                <div className="text-center space-y-2">
                  <div className="text-sm font-medium">
                    Quick Order Hub
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Version 3.1.0
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Copyright © {new Date().getFullYear()} by WA
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeSection === 'branding' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4 sm:space-y-6"
            >
              <h2 className="text-xl sm:text-2xl font-bold">{t('settings.branding')}</h2>
              
              {/* Logo Upload */}
              <div>
                <label className="text-xs sm:text-sm font-medium text-muted-foreground block mb-2 sm:mb-3">
                  {t('settings.logo')}
                </label>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                  {settings.logo && (
                    <div className="relative">
                      <img 
                        src={settings.logo} 
                        alt="Logo" 
                        className="w-16 h-16 sm:w-20 sm:h-20 object-contain rounded-lg border-2 border-border"
                      />
                      <button
                        onClick={() => updateSettings({ logo: undefined })}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center text-xs hover:bg-destructive/90 transition-colors"
                      >
                        ×
                      </button>
                    </div>
                  )}
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            const base64String = reader.result as string;
                            updateSettings({ logo: base64String });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="hidden"
                      id="logo-upload"
                    />
                    <label
                      htmlFor="logo-upload"
                      className="cursor-pointer inline-block px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
                    >
                      {settings.logo ? t('settings.changeLogo') : t('settings.addLogo')}
                    </label>
                    <p className="text-xs text-muted-foreground mt-2">
                      PNG, JPG jusqu'à 2MB
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs sm:text-sm font-medium text-muted-foreground">
                  {t('settings.restaurantName')}
                </label>
                <TouchInput
                  value={settings.restaurantName}
                  onChange={(value) => updateSettings({ restaurantName: value })}
                  className="mt-1"
                  placeholder={t('settings.restaurantName')}
                />
              </div>

              <div>
                <label className="text-xs sm:text-sm font-medium text-muted-foreground">
                  {t('settings.address')}
                </label>
                <TouchTextarea
                  value={settings.address}
                  onChange={(value) => updateSettings({ address: value })}
                  className="mt-1"
                  rows={2}
                  placeholder={t('settings.address')}
                  showQuickSuggestions={false}
                />
              </div>

              <div>
                <label className="text-xs sm:text-sm font-medium text-muted-foreground">
                  {t('settings.phone')}
                </label>
                <TouchInput
                  value={settings.phone}
                  onChange={(value) => updateSettings({ phone: value })}
                  className="mt-1"
                  placeholder={t('settings.phone')}
                />
              </div>
            </motion.div>
          )}

          {activeSection === 'receipt' && (
            <ReceiptCustomizationSection 
              settings={settings}
              updateSettings={updateSettings}
              t={t}
            />
          )}

          {activeSection === 'products' && (
            <ProductsManagement
              categories={categories}
              products={products}
              variants={variants}
              currency={currency}
              getVariantsByProduct={getVariantsByProduct}
              saveProduct={saveProduct}
              deleteProduct={deleteProduct}
              loadProducts={loadProducts}
              saveCategory={saveCategory}
              deleteCategory={deleteCategory}
              loadCategories={loadCategories}
            />
          )}

          {activeSection === 'theme' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4 sm:space-y-6"
            >
              <h2 className="text-xl sm:text-2xl font-bold">{t('settings.theme')}</h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <button
                  onClick={() => updateSettings({ darkMode: false })}
                  className={cn(
                    "p-4 sm:p-6 rounded-xl border-2 transition-all flex flex-col items-center gap-2 sm:gap-3",
                    !settings.darkMode
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <Sun className="w-8 h-8 sm:w-10 sm:h-10 text-warning" />
                  <span className="font-medium text-sm sm:text-base">{t('settings.lightMode')}</span>
                </button>
                
                <button
                  onClick={() => updateSettings({ darkMode: true })}
                  className={cn(
                    "p-4 sm:p-6 rounded-xl border-2 transition-all flex flex-col items-center gap-2 sm:gap-3",
                    settings.darkMode
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <Moon className="w-8 h-8 sm:w-10 sm:h-10 text-info" />
                  <span className="font-medium text-sm sm:text-base">{t('settings.darkMode')}</span>
                </button>
              </div>

              {/* Color Presets */}
              <div>
                <label className="text-xs sm:text-sm font-medium text-muted-foreground block mb-2 sm:mb-3">
                  {t('settings.primaryColor')}
                </label>
                <div className="flex gap-2 sm:gap-3 flex-wrap">
                  {[
                    { color: '#f97316', name: t('color.orange') },
                    { color: '#ef4444', name: t('color.red') },
                    { color: '#22c55e', name: t('color.green') },
                    { color: '#3b82f6', name: t('color.blue') },
                    { color: '#8b5cf6', name: t('color.purple') },
                  ].map((preset) => (
                    <button
                      key={preset.color}
                      onClick={() => updateSettings({ primaryColor: preset.color })}
                      className={cn(
                        "w-12 h-12 rounded-xl transition-all",
                        settings.primaryColor === preset.color && "ring-2 ring-offset-2 ring-foreground"
                      )}
                      style={{ backgroundColor: preset.color }}
                      title={preset.name}
                    />
                  ))}
                </div>
              </div>

              {/* UI Scale */}
              <div>
                <label className="text-xs sm:text-sm font-medium text-muted-foreground block mb-2 sm:mb-3">
                  Taille de l'interface
                </label>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.1"
                      value={settings.uiScale ?? 1.0}
                      onChange={(e) => updateSettings({ uiScale: parseFloat(e.target.value) })}
                      className="flex-1 h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <div className="w-16 sm:w-20 text-center">
                      <span className="text-sm sm:text-base font-medium">
                        {((settings.uiScale ?? 1.0) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Ajustez la taille de l'interface pour les petits écrans. Réduire pour afficher plus de contenu, augmenter pour des boutons plus grands.
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {[0.75, 0.9, 1.0, 1.1, 1.25].map((scale) => (
                      <button
                        key={scale}
                        onClick={() => updateSettings({ uiScale: scale })}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all border",
                          (settings.uiScale ?? 1.0) === scale
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-secondary text-secondary-foreground border-border hover:border-primary/50"
                        )}
                      >
                        {(scale * 100).toFixed(0)}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeSection === 'promotions' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4 sm:space-y-6"
            >
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <h2 className="text-xl sm:text-2xl font-bold">{t('promo.title')}</h2>
                <Button
                  onClick={() => {
                    setEditingPromo(null);
                    setShowPromoModal(true);
                  }}
                  className="gap-2 text-sm sm:text-base"
                  size="sm"
                >
                  <Plus className="w-4 h-4" />
                  {t('promo.add')}
                </Button>
              </div>
              
              <div className="space-y-3">
                {promotions.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Tag className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>Aucune promotion configurée</p>
                    <Button
                      onClick={() => {
                        setEditingPromo(null);
                        setShowPromoModal(true);
                      }}
                      variant="outline"
                      className="mt-4 gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      {t('promo.add')}
                    </Button>
                  </div>
                ) : (
                  promotions.map((promo) => {
                    const now = new Date();
                    const startDate = new Date(promo.startDate);
                    const endDate = new Date(promo.endDate);
                    const isExpired = endDate < now;
                    const isNotStarted = startDate > now;
                    const isActive = promo.active && !isExpired && !isNotStarted;

                    return (
                      <div
                        key={promo.id}
                        className={cn(
                          "p-3 sm:p-4 rounded-xl border-2 transition-all",
                          isActive ? "bg-success/5 border-success/20" : "bg-muted/50 border-border"
                        )}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                              <span className="font-bold text-base sm:text-lg">{promo.code}</span>
                              <span className={cn(
                                "px-2 py-1 rounded-full text-xs font-medium",
                                isActive ? "bg-success/20 text-success" : 
                                isExpired ? "bg-destructive/20 text-destructive" :
                                isNotStarted ? "bg-warning/20 text-warning" :
                                "bg-muted text-muted-foreground"
                              )}>
                                {isActive ? t('general.active') : 
                                 isExpired ? t('general.expired') :
                                 isNotStarted ? t('general.upcoming') :
                                 t('general.inactive')}
                              </span>
                            </div>
                            <div className="text-sm sm:text-base font-medium mb-1 truncate">{promo.name}</div>
                            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground mb-2">
                              <span>
                                {promo.type === 'percent' && `-${promo.value}%`}
                                {promo.type === 'fixed' && `-${formatCurrency(promo.value, currency)}`}
                                {promo.type === 'freeItem' && t('promo.freeItem')}
                              </span>
                              {promo.minOrderTotal && (
                                <span>• Min: {formatCurrency(promo.minOrderTotal, currency)}</span>
                              )}
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                <span>Du {startDate.toLocaleDateString('fr-FR')}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                <span>Au {endDate.toLocaleDateString('fr-FR')}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              onClick={() => {
                                setEditingPromo(promo);
                                setShowPromoModal(true);
                              }}
                              className="p-2 hover:bg-primary/10 rounded-lg transition-colors"
                              title={t('general.edit')}
                            >
                              <Edit className="w-4 h-4 text-primary" />
                            </button>
                            <button
                              onClick={async () => {
                                const confirmed = await showDialog({
                                  title: 'Supprimer la promotion',
                                  description: `Êtes-vous sûr de vouloir supprimer la promotion ${promo.code} ?`,
                                  confirmText: 'Supprimer',
                                  cancelText: 'Annuler',
                                  variant: 'destructive',
                                });
                                if (confirmed) {
                                  await deletePromotion(promo.id);
                                }
                              }}
                              className="p-2 hover:bg-destructive/10 rounded-lg transition-colors"
                              title={t('general.delete')}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}

          {/* Promotion Modal */}
          <PromotionModal
            isOpen={showPromoModal}
            onClose={() => {
              setShowPromoModal(false);
              setEditingPromo(null);
            }}
            promotion={editingPromo}
            onSave={async (promo) => {
              await savePromotion(promo);
              await loadPromotions();
              setShowPromoModal(false);
              setEditingPromo(null);
            }}
            currency={currency}
            t={t}
          />

          {activeSection === 'printers' && (
            <PrinterSettings 
              printers={printers}
              updatePrinter={updatePrinter}
              deletePrinter={deletePrinter}
              t={t}
              showDialog={showDialog}
            />
          )}

          {activeSection === 'inventory' && (
            <InventoryManagement currency={currency} t={t} />
          )}

          {activeSection === 'users' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4 sm:space-y-6"
            >
              {!canAccessSettingsSection('users') ? (
                <div className="text-center py-8 sm:py-12 text-muted-foreground">
                  <p className="text-sm sm:text-base">{t('general.accessDenied')}</p>
                </div>
              ) : (
                <>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <h2 className="text-xl sm:text-2xl font-bold">{t('settings.users')}</h2>
                <Button
                  onClick={() => {
                    setEditingUser(null);
                    setShowUserModal(true);
                  }}
                  className="gap-2 text-sm sm:text-base"
                  size="sm"
                >
                  <Plus className="w-4 h-4" />
                  {t('users.add')}
                </Button>
              </div>
              
              <div className="space-y-3">
                {users.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>{t('users.noUsers')}</p>
                  </div>
                ) : (
                  users.map((u) => {
                    const roleLabels: Record<string, string> = {
                      admin: t('users.roleAdmin'),
                      caissier: t('users.roleCaissier'),
                      chef: t('users.roleChef'),
                    };

                    return (
                      <div
                        key={u.id}
                        className="p-3 sm:p-4 bg-muted/50 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="font-bold text-base sm:text-lg">{u.name}</span>
                            <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                              {roleLabels[u.role] || u.role}
                            </span>
                          </div>
                          <div className="text-xs sm:text-sm text-muted-foreground">
                            <div className="truncate">{t('users.username')}: {u.username}</div>
                            {u.lastLogin && (
                              <div>{t('users.lastLogin')}: {new Date(u.lastLogin).toLocaleString('fr-FR')}</div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => {
                              setEditingUser(u);
                              setShowUserModal(true);
                            }}
                            className="p-2 hover:bg-primary/10 rounded-lg transition-colors"
                            title={t('users.edit')}
                          >
                            <Edit className="w-4 h-4 text-primary" />
                          </button>
                          {/* Can't delete yourself. Only admin can delete other admins (if there are multiple) */}
                          {u.id !== user?.id && (
                            u.role !== 'admin' 
                              ? true  // Non-admin users can be deleted by anyone with access
                              : (user?.role === 'admin' && users.filter(x => x.role === 'admin').length > 1) // Admin can delete other admins if multiple exist
                          ) && (
                            <button
                              onClick={async () => {
                                const confirmed = await showDialog({
                                  title: 'Supprimer l\'utilisateur',
                                  description: `${t('users.deleteConfirm')} "${u.name}" ?`,
                                  confirmText: 'Supprimer',
                                  cancelText: 'Annuler',
                                  variant: 'destructive',
                                });
                                if (confirmed) {
                                  await deleteUser(u.id);
                                  await loadUsers();
                                }
                              }}
                              className="p-2 hover:bg-destructive/10 rounded-lg transition-colors"
                              title={t('users.delete')}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
                </>
              )}
            </motion.div>
          )}

          {activeSection === 'data' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4 sm:space-y-6"
            >
              <h2 className="text-xl sm:text-2xl font-bold">{t('settings.data')}</h2>
              
              {/* Backup & Restore */}
              <div className="p-3 sm:p-4 bg-info/10 border-2 border-info/20 rounded-xl">
                <h3 className="font-medium text-info mb-2 text-sm sm:text-base">Sauvegarde et Restauration</h3>
                <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
                  Créez une sauvegarde complète de toutes vos données ou restaurez une sauvegarde précédente.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="default"
                    onClick={handleExportBackup}
                    disabled={isExporting || isImporting}
                    className="flex-1"
                  >
                    {isExporting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Export en cours...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Exporter la sauvegarde
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleImportBackup}
                    disabled={isExporting || isImporting}
                    className="flex-1"
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Import en cours...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Importer une sauvegarde
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Automatic Backup Configuration */}
              <div className="p-3 sm:p-4 bg-primary/10 border-2 border-primary/20 rounded-xl">
                <h3 className="font-medium text-primary mb-2 text-sm sm:text-base">Sauvegarde automatique</h3>
                <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
                  Configurez la sauvegarde automatique de la base de données à intervalles réguliers.
                </p>
                
                {/* Enable/Disable Automatic Backup */}
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg mb-4">
                  <div className="flex-1 pr-4">
                    <p className="text-sm font-medium">Activer la sauvegarde automatique</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      La base de données sera sauvegardée automatiquement selon l&apos;intervalle configuré.
                    </p>
                  </div>
                  <Switch
                    checked={settings.backupEnabled || false}
                    onCheckedChange={(checked) => updateSettings({ backupEnabled: checked })}
                  />
                </div>

                {settings.backupEnabled && (
                  <>
                    {/* Backup Schedule Type */}
                    <div className="mb-4">
                      <label className="text-sm font-medium text-muted-foreground block mb-2">
                        Type de planification
                      </label>
                      <Select
                        value={settings.backupScheduleType || 'interval'}
                        onValueChange={(value) => {
                          updateSettings({ backupScheduleType: value as 'interval' | 'daily' | 'weekly' | 'monthly' });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="interval">À intervalles réguliers</SelectItem>
                          <SelectItem value="daily">Quotidienne</SelectItem>
                          <SelectItem value="weekly">Hebdomadaire</SelectItem>
                          <SelectItem value="monthly">Mensuelle</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        Choisissez comment planifier les sauvegardes automatiques
                      </p>
                    </div>

                    {/* Interval Schedule */}
                    {(!settings.backupScheduleType || settings.backupScheduleType === 'interval') && (
                      <div className="mb-4">
                        <label className="text-sm font-medium text-muted-foreground block mb-2">
                          Intervalle de sauvegarde (en minutes)
                        </label>
                        <NumericInput
                          value={settings.backupInterval || 60}
                          onChange={(value) => {
                            const numValue = typeof value === 'number' ? value : parseFloat(value);
                            if (numValue > 0) {
                              updateSettings({ backupInterval: numValue });
                            }
                          }}
                          placeholder="60"
                          allowDecimal={false}
                          min={1}
                          max={10080}
                          className="font-mono"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Intervalle entre chaque sauvegarde automatique (minimum: 1 minute, maximum: 10080 minutes = 7 jours)
                        </p>
                      </div>
                    )}

                    {/* Daily Schedule */}
                    {settings.backupScheduleType === 'daily' && (
                      <div className="mb-4">
                        <label className="text-sm font-medium text-muted-foreground block mb-2">
                          Heure de sauvegarde quotidienne
                        </label>
                        <Input
                          type="time"
                          value={settings.backupDailyTime || '02:00'}
                          onChange={(e) => updateSettings({ backupDailyTime: e.target.value })}
                          className="font-mono"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Heure à laquelle la sauvegarde sera effectuée chaque jour (format HH:MM)
                        </p>
                      </div>
                    )}

                    {/* Weekly Schedule */}
                    {settings.backupScheduleType === 'weekly' && (
                      <>
                        <div className="mb-4">
                          <label className="text-sm font-medium text-muted-foreground block mb-2">
                            Jour de la semaine
                          </label>
                          <Select
                            value={settings.backupWeeklyDay?.toString() || '0'}
                            onValueChange={(value) => {
                              updateSettings({ backupWeeklyDay: parseInt(value, 10) });
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">Dimanche</SelectItem>
                              <SelectItem value="1">Lundi</SelectItem>
                              <SelectItem value="2">Mardi</SelectItem>
                              <SelectItem value="3">Mercredi</SelectItem>
                              <SelectItem value="4">Jeudi</SelectItem>
                              <SelectItem value="5">Vendredi</SelectItem>
                              <SelectItem value="6">Samedi</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="mb-4">
                          <label className="text-sm font-medium text-muted-foreground block mb-2">
                            Heure de sauvegarde
                          </label>
                          <Input
                            type="time"
                            value={settings.backupWeeklyTime || '02:00'}
                            onChange={(e) => updateSettings({ backupWeeklyTime: e.target.value })}
                            className="font-mono"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Heure à laquelle la sauvegarde sera effectuée (format HH:MM)
                          </p>
                        </div>
                      </>
                    )}

                    {/* Monthly Schedule */}
                    {settings.backupScheduleType === 'monthly' && (
                      <>
                        <div className="mb-4">
                          <label className="text-sm font-medium text-muted-foreground block mb-2">
                            Jour du mois
                          </label>
                          <NumericInput
                            value={settings.backupMonthlyDay || 1}
                            onChange={(value) => {
                              const numValue = typeof value === 'number' ? value : parseFloat(value);
                              if (numValue >= 1 && numValue <= 31) {
                                updateSettings({ backupMonthlyDay: numValue });
                              }
                            }}
                            placeholder="1"
                            allowDecimal={false}
                            min={1}
                            max={31}
                            className="font-mono"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Jour du mois où la sauvegarde sera effectuée (1-31)
                          </p>
                        </div>
                        <div className="mb-4">
                          <label className="text-sm font-medium text-muted-foreground block mb-2">
                            Heure de sauvegarde
                          </label>
                          <Input
                            type="time"
                            value={settings.backupMonthlyTime || '02:00'}
                            onChange={(e) => updateSettings({ backupMonthlyTime: e.target.value })}
                            className="font-mono"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Heure à laquelle la sauvegarde sera effectuée (format HH:MM)
                          </p>
                        </div>
                      </>
                    )}

                    {/* Backup Directory */}
                    <div className="mb-4">
                      <label className="text-sm font-medium text-muted-foreground block mb-2">
                        Répertoire de sauvegarde
                      </label>
                      <div className="flex gap-2">
                        <Input
                          value={settings.backupDirectory || ''}
                          onChange={(e) => updateSettings({ backupDirectory: e.target.value })}
                          placeholder="C:\Backups\POS"
                          className="flex-1"
                        />
                        <Button
                          variant="outline"
                          onClick={async () => {
                            if (typeof window !== 'undefined' && window.electronAPI) {
                              try {
                                const result = await window.electronAPI.showOpenDialog({
                                  title: 'Sélectionner le répertoire de sauvegarde',
                                  properties: ['openDirectory'],
                                });
                                if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
                                  await updateSettings({ backupDirectory: result.filePaths[0] });
                                }
                              } catch (error) {
                                console.error('Error selecting directory:', error);
                                await showAlert('Erreur lors de la sélection du répertoire', 'Erreur');
                              }
                            } else {
                              await showAlert('L\'API Electron n\'est pas disponible. Veuillez utiliser la version desktop.', 'Erreur');
                            }
                          }}
                        >
                          <FolderOpen className="w-4 h-4 mr-2" />
                          Parcourir
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Répertoire où seront stockées les sauvegardes automatiques. Les fichiers seront nommés avec un horodatage.
                      </p>
                    </div>

                    {/* Status Info */}
                    <div className="p-3 bg-info/10 border border-info/20 rounded-lg">
                      <p className="text-xs text-info">
                        <strong>Statut:</strong> {settings.backupDirectory ? (
                          <>
                            {(() => {
                              const scheduleType = settings.backupScheduleType || 'interval';
                              if (scheduleType === 'interval') {
                                return `Sauvegarde automatique active - Toutes les ${settings.backupInterval || 60} minute(s)`;
                              } else if (scheduleType === 'daily') {
                                return `Sauvegarde automatique active - Quotidienne à ${settings.backupDailyTime || '02:00'}`;
                              } else if (scheduleType === 'weekly') {
                                const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
                                const day = days[settings.backupWeeklyDay || 0];
                                return `Sauvegarde automatique active - Hebdomadaire le ${day} à ${settings.backupWeeklyTime || '02:00'}`;
                              } else if (scheduleType === 'monthly') {
                                return `Sauvegarde automatique active - Mensuelle le ${settings.backupMonthlyDay || 1} à ${settings.backupMonthlyTime || '02:00'}`;
                              }
                              return 'Sauvegarde automatique active';
                            })()}
                          </>
                        ) : (
                          <>Veuillez sélectionner un répertoire de sauvegarde pour activer la sauvegarde automatique</>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Les sauvegardes sont créées au format JSON, compatible avec la fonction d&apos;import/export manuelle.
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Print Daemon Status */}
              {typeof window !== 'undefined' && window.electronAPI && window.electronAPI.getDaemonStatus && (
                <div className="p-3 sm:p-4 bg-primary/10 border-2 border-primary/20 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Server className="w-5 h-5 text-primary" />
                      <h3 className="font-medium text-primary text-sm sm:text-base">Statut du Daemon d'Impression</h3>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={checkDaemonStatus}
                      disabled={isCheckingDaemon}
                    >
                      {isCheckingDaemon ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  
                  {daemonStatus ? (
                    <div className="space-y-2">
                      <div className={`p-3 rounded-lg border ${daemonStatus.running ? 'bg-success/10 border-success/20' : 'bg-destructive/10 border-destructive/20'}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`w-3 h-3 rounded-full ${daemonStatus.running ? 'bg-success animate-pulse' : 'bg-destructive'}`} />
                          <p className="text-sm font-medium">
                            {daemonStatus.running ? 'Daemon actif' : 'Daemon inactif'}
                          </p>
                        </div>
                        
                        {daemonStatus.running ? (
                          <div className="text-xs space-y-1">
                            {daemonStatus.status && (
                              <p><strong>Statut:</strong> {daemonStatus.status}</p>
                            )}
                            {daemonStatus.message && (
                              <p><strong>Message:</strong> {daemonStatus.message}</p>
                            )}
                            {daemonStatus.version && (
                              <p><strong>Version:</strong> {daemonStatus.version}</p>
                            )}
                            {daemonStatus.daemonProcess?.pid && (
                              <p><strong>PID:</strong> {daemonStatus.daemonProcess.pid}</p>
                            )}
                            <p className="text-muted-foreground mt-2">
                              Le daemon écoute sur <code className="bg-background px-1 rounded">http://127.0.0.1:9100</code>
                            </p>
                          </div>
                        ) : (
                          <div className="text-xs space-y-1">
                            {daemonStatus.error && (
                              <p className="text-destructive"><strong>Erreur:</strong> {daemonStatus.error}</p>
                            )}
                            {daemonStatus.daemonProcess && (
                              <p><strong>Processus:</strong> PID {daemonStatus.daemonProcess.pid || 'N/A'} - {daemonStatus.daemonProcess.killed ? 'Arrêté' : 'Inconnu'}</p>
                            )}
                            <p className="text-muted-foreground mt-2">
                              Le daemon d'impression n'est pas accessible. L'impression peut ne pas fonctionner.
                            </p>
                          </div>
                        )}
                      </div>
                      
                      {!daemonStatus.running && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={handleRestartDaemon}
                          className="w-full"
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Redémarrer le daemon
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">
                        Vérification du statut en cours...
                      </p>
                    </div>
                  )}
                  
                  <div className="mt-3 p-2 bg-muted/30 rounded text-xs text-muted-foreground">
                    <p><strong>Comment tester manuellement :</strong></p>
                    <ol className="list-decimal list-inside mt-1 space-y-1">
                      <li>Ouvrir PowerShell ou CMD</li>
                      <li>Exécuter : <code className="bg-background px-1 rounded">curl http://127.0.0.1:9100/health</code></li>
                      <li>Ou dans un navigateur : <code className="bg-background px-1 rounded">http://127.0.0.1:9100/health</code></li>
                    </ol>
                  </div>
                </div>
              )}

              {/* Data Location Info */}
              {typeof window !== 'undefined' && window.electronAPI && (
                <div className="p-3 sm:p-4 bg-gray-500/10 border-2 border-gray-500/20 rounded-xl">
                  <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-2 text-sm sm:text-base">Emplacement des Données</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-2">
                    Les données de l'application (produits, commandes, paramètres) sont stockées localement sur votre ordinateur.
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      if (window.electronAPI) {
                        try {
                          const userDataPath = await window.electronAPI.getUserDataPath();
                          const indexedDBPath = await window.electronAPI.getIndexedDBPath();
                          await showAlert(
                            `Emplacement des données :\n\n` +
                            `Dossier utilisateur :\n${userDataPath}\n\n` +
                            `Base de données (IndexedDB) :\n${indexedDBPath}\n\n` +
                            `Note : En développement, la base de données peut être dans un sous-dossier IndexedDB avec un nom basé sur l'URL.`,
                            'Emplacement des données'
                          );
                        } catch (error) {
                          console.error('Error getting paths:', error);
                        }
                      }
                    }}
                    className="w-full text-left justify-start"
                  >
                    📁 Afficher l'emplacement des données
                  </Button>
                </div>
              )}

              {/* Export/Import Products Template */}
              <div className="p-3 sm:p-4 bg-blue-500/10 border-2 border-blue-500/20 rounded-xl">
                <h3 className="font-medium text-blue-600 dark:text-blue-400 mb-2 text-sm sm:text-base">Template des Produits</h3>
                <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
                  Exportez ou importez un template de produits (catégories, produits, variantes et modifiers) pour partager votre configuration ou démarrer rapidement.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={async () => {
                      const isElectron = typeof window !== 'undefined' && window.electronAPI;
                      
                      if (!isElectron) {
                        await showAlert(
                          'L\'API Electron n\'est pas disponible.\n\n' +
                          'Assurez-vous que vous utilisez la version desktop de l\'application.',
                          'Erreur'
                        );
                        return;
                      }

                      setIsExportingTemplate(true);
                      try {
                        const templateData = await exportProductsTemplate();
                        const jsonData = JSON.stringify(templateData, null, 2);
                        const fileName = `products-template-${new Date().toISOString().split('T')[0]}.json`;

                        const result = await window.electronAPI.showSaveDialog({
                          title: 'Exporter le template des produits',
                          defaultPath: fileName,
                          filters: [
                            { name: 'Fichiers JSON', extensions: ['json'] },
                            { name: 'Tous les fichiers', extensions: ['*'] },
                          ],
                        });

                        if (!result.canceled && result.filePath) {
                          await window.electronAPI.saveBackup(jsonData, result.filePath);
                          await showAlert('Template des produits exporté avec succès !', 'Succès');
                        }
                      } catch (error) {
                        console.error('Export template error:', error);
                        await showAlert('Erreur lors de l\'export du template: ' + (error instanceof Error ? error.message : 'Erreur inconnue'), 'Erreur');
                      } finally {
                        setIsExportingTemplate(false);
                      }
                    }}
                    disabled={isExportingTemplate || isImportingTemplate}
                    className="flex-1"
                  >
                    {isExportingTemplate ? 'Export...' : 'Exporter'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      const isElectron = typeof window !== 'undefined' && window.electronAPI;
                      
                      if (!isElectron) {
                        await showAlert(
                          'L\'API Electron n\'est pas disponible.\n\n' +
                          'Assurez-vous que vous utilisez la version desktop de l\'application.',
                          'Erreur'
                        );
                        return;
                      }

                      const confirmed = await showDialog({
                        title: 'Importer un template',
                        description: 'L\'importation d\'un template remplacera les produits, catégories, variantes et modifiers existants. Les autres données (commandes, paramètres, etc.) ne seront pas affectées.\n\nÊtes-vous sûr de vouloir continuer ?',
                        confirmText: 'Continuer',
                        cancelText: 'Annuler',
                        variant: 'default',
                      });

                      if (!confirmed) return;

                      setIsImportingTemplate(true);
                      try {
                        const result = await window.electronAPI.showOpenDialog({
                          title: 'Importer un template de produits',
                          filters: [
                            { name: 'Fichiers JSON', extensions: ['json'] },
                            { name: 'Tous les fichiers', extensions: ['*'] },
                          ],
                          properties: ['openFile'],
                        });

                        if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
                          setIsImportingTemplate(false);
                          return;
                        }

                        const filePath = result.filePaths[0];
                        const loadResult = await window.electronAPI.loadBackup(filePath);

                        if (!loadResult.success || !loadResult.data) {
                          throw new Error('Impossible de lire le fichier template');
                        }

                        const templateData = JSON.parse(loadResult.data);

                        // Validate template structure
                        if (!templateData.categories && !templateData.products) {
                          // Try nested structure (from full backup)
                          if (templateData.data && (templateData.data.categories || templateData.data.products)) {
                            await importProductsTemplate(templateData.data);
                          } else {
                            throw new Error('Format de template invalide. Le fichier doit contenir des catégories et/ou produits.');
                          }
                        } else {
                          await importProductsTemplate(templateData);
                        }

                        await showAlert('Template des produits importé avec succès !', 'Succès');
                      } catch (error) {
                        console.error('Import template error:', error);
                        await showAlert('Erreur lors de l\'import du template: ' + (error instanceof Error ? error.message : 'Erreur inconnue'), 'Erreur');
                      } finally {
                        setIsImportingTemplate(false);
                      }
                    }}
                    disabled={isExportingTemplate || isImportingTemplate}
                    className="flex-1"
                  >
                    {isImportingTemplate ? 'Import...' : 'Importer'}
                  </Button>
                </div>
              </div>

              {/* Database Reset */}
              <div className="p-3 sm:p-4 bg-destructive/10 border-2 border-destructive/20 rounded-xl">
                <h3 className="font-medium text-destructive mb-2 text-sm sm:text-base">Zone de danger</h3>
                <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
                  La réinitialisation de la base de données supprimera TOUTES les données (commandes, produits, catégories, paramètres, etc.) et rendra le logiciel complètement vierge. Cette action est irréversible.
                </p>
                <Button
                  variant="destructive"
                  onClick={async () => {
                    const confirmed1 = await showDialog({
                      title: '⚠️ ATTENTION',
                      description: 'Vous êtes sur le point de supprimer TOUTES les données. Le logiciel sera complètement vierge (aucun produit, aucune catégorie). Cette action est irréversible.\n\nAssurez-vous d\'avoir exporté le template des produits si nécessaire.\n\nÊtes-vous vraiment sûr de vouloir continuer ?',
                      confirmText: 'Continuer',
                      cancelText: 'Annuler',
                      variant: 'destructive',
                    });
                    if (confirmed1) {
                      const confirmed2 = await showDialog({
                        title: t('database.resetConfirm'),
                        description: t('database.resetConfirm'),
                        confirmText: 'Confirmer',
                        cancelText: 'Annuler',
                        variant: 'destructive',
                      });
                      if (confirmed2) {
                        await resetDatabase();
                      }
                    }
                  }}
                  className="w-full"
                >
                  {t('database.reset')}
                </Button>
              </div>
            </motion.div>
          )}

          {/* User Modal */}
          {showUserModal && (
            <UserModal
              isOpen={showUserModal}
              onClose={() => {
                setShowUserModal(false);
                setEditingUser(null);
              }}
              user={editingUser}
              existingUsers={users}
              onSave={async (userData) => {
                await saveUser(userData);
                await loadUsers();
                setShowUserModal(false);
                setEditingUser(null);
              }}
              t={t}
            />
          )}
        </div>
      </div>
    </div>
    </>
  );
}

interface PromotionModalProps {
  isOpen: boolean;
  onClose: () => void;
  promotion: Promotion | null;
  onSave: (promo: Promotion) => Promise<void>;
  currency: Currency;
  t: (key: string) => string;
}

function PromotionModal({ isOpen, onClose, promotion, onSave, currency, t }: PromotionModalProps) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<PromoType>('percent');
  const [value, setValue] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [active, setActive] = useState(true);
  const [minOrderTotal, setMinOrderTotal] = useState('');
  const [error, setError] = useState('');

  // Initialize form when modal opens or promotion changes
  useEffect(() => {
    if (promotion) {
      setCode(promotion.code);
      setName(promotion.name);
      setType(promotion.type);
      setValue(promotion.value.toString());
      setStartDate(new Date(promotion.startDate).toISOString().split('T')[0]);
      setEndDate(new Date(promotion.endDate).toISOString().split('T')[0]);
      setActive(promotion.active);
      setMinOrderTotal(promotion.minOrderTotal?.toString() || '');
    } else {
      // Reset for new promotion
      setCode('');
      setName('');
      setType('percent');
      setValue('');
      const today = new Date().toISOString().split('T')[0];
      setStartDate(today);
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      setEndDate(nextMonth.toISOString().split('T')[0]);
      setActive(true);
      setMinOrderTotal('');
    }
    setError('');
  }, [promotion, isOpen]);

  const handleSubmit = async () => {
    // Validation
    if (!code.trim()) {
      setError(t('general.codeRequired'));
      return;
    }
    if (!name.trim()) {
      setError(t('general.nameRequired'));
      return;
    }
    if (type !== 'freeItem' && (!value || parseFloat(value) <= 0)) {
      setError(t('general.valueMustBeGreaterThanZero'));
      return;
    }
    if (!startDate || !endDate) {
      setError(t('general.datesRequired'));
      return;
    }
    if (new Date(startDate) >= new Date(endDate)) {
      setError(t('general.endDateAfterStartDate'));
      return;
    }

    const promo: Promotion = {
      id: promotion?.id || generateUUID(),
      code: code.toUpperCase().trim(),
      name: name.trim(),
      type,
      value: type === 'freeItem' ? 0 : parseFloat(value),
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      active,
      minOrderTotal: minOrderTotal ? parseFloat(minOrderTotal) : undefined,
    };

    await onSave(promo);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="bg-card rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-xl font-bold">
              {promotion ? t('general.edit') : t('promo.add')}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-accent rounded-xl transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)] space-y-4">
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  {t('promo.code')} *
                </label>
                <TouchInput
                  value={code}
                  onChange={(value) => setCode(value.toUpperCase())}
                  placeholder={t('promo.placeholderCode')}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  {t('promo.name')} *
                </label>
                <TouchInput
                  value={name}
                  onChange={setName}
                  placeholder={t('promo.placeholderName')}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-3">
                {t('promo.type')} *
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['percent', 'fixed', 'freeItem'] as PromoType[]).map((promoType) => (
                  <button
                    key={promoType}
                    onClick={() => setType(promoType)}
                    className={cn(
                      "p-4 rounded-xl border-2 transition-all text-center",
                      type === promoType
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <span className="font-medium">{t(`promo.${promoType}`)}</span>
                  </button>
                ))}
              </div>
            </div>

            {type !== 'freeItem' && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  {t('promo.value')} * {type === 'percent' ? '(%)' : `(${currency})`}
                </label>
                <NumericInput
                  value={value}
                  onChange={setValue}
                  placeholder={type === 'percent' ? '10' : '100'}
                  className="mt-1 h-12"
                  min={0}
                  step={type === 'percent' ? 1 : 0.01}
                  allowDecimal={type !== 'percent'}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  {t('promo.startDate')} *
                </label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 h-12"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  {t('promo.endDate')} *
                </label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1 h-12"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">
                {t('promo.minOrder')} ({currency})
              </label>
              <NumericInput
                value={minOrderTotal}
                onChange={setMinOrderTotal}
                placeholder={t('general.optional')}
                className="mt-1 h-12"
                min={0}
                step={0.01}
                allowDecimal={true}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
              <div>
                <span className="font-medium">{t('promo.active')}</span>
                <p className="text-sm text-muted-foreground">
                  La promotion sera disponible si activée
                </p>
              </div>
              <Switch
                checked={active}
                onCheckedChange={setActive}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-2 p-4 border-t border-border">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1 h-12"
            >
              {t('general.cancel')}
            </Button>
            <Button
              onClick={handleSubmit}
              className="flex-1 h-12"
            >
              {t('promo.save')}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Printer Settings Component
interface PrinterSettingsProps {
  printers: PrinterType[];
  updatePrinter: (printer: PrinterType) => Promise<void>;
  deletePrinter: (printerId: string) => Promise<void>;
  t: (key: string) => string;
  showDialog: (options: {
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'default' | 'destructive';
  }) => Promise<boolean>;
}

function PrinterSettings({ printers, updatePrinter, deletePrinter, t, showDialog }: PrinterSettingsProps) {
  const [editingPrinter, setEditingPrinter] = useState<PrinterType | null>(null);
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [testingPrinters, setTestingPrinters] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});

  // Helper: description du rôle
  const getRoleLabel = (role: PrinterRole) =>
    role === 'kitchen' ? t('printer.kitchenPrinter') : t('printer.cashierPrinter');

  // Helper: label du type de connexion
  const getConnectionLabel = (connectionType?: PrinterConnectionType) => {
    switch (connectionType) {
      case 'bluetooth':
        return 'Bluetooth';
      case 'wifi':
        return 'Wi-Fi';
      case 'windows':
        return 'Imprimante Windows (daemon)';
      case 'tcp':
      default:
        return 'Ethernet / Réseau';
    }
  };

  const handleAddPrinter = () => {
    const newPrinter: PrinterType = {
      id: generateUUID(),
      role: 'cashier',
      mode: 'tcp',
      connectionType: 'tcp',
      name: '',
      tcpHost: '',
      tcpPort: 9100,
      isThermalPrinter: false,
      enabled: true,
    };
    setEditingPrinter(newPrinter);
    setShowPrinterModal(true);
  };

  const handleDeletePrinter = async (printer: PrinterType) => {
    const confirmed = await showDialog({
      title: 'Supprimer l\'imprimante',
      description: `Êtes-vous sûr de vouloir supprimer l'imprimante "${printer.name || 'sans nom'}" ?`,
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      variant: 'destructive',
    });
    if (!confirmed) return;
    await deletePrinter(printer.id);
    toast({
      title: 'Imprimante supprimée',
      description: 'L\'imprimante a été supprimée de la configuration.',
    });
  };

  const handleEditPrinter = (printer: PrinterType) => {
    setEditingPrinter(printer);
    setShowPrinterModal(true);
  };

  const handleSavePrinter = async (printer: PrinterType) => {
    await updatePrinter(printer);
    setShowPrinterModal(false);
    setEditingPrinter(null);
    toast({
      title: t('printer.configured'),
      description: t('printer.configuredDesc').replace('{role}', printer.role === 'kitchen' ? t('printer.kitchen') : t('printer.cashier')),
    });
  };

  const handleTestPrinter = async (printer: PrinterType) => {
    const effectiveConnectionType: PrinterConnectionType = printer.connectionType || 'tcp';

    // Validation selon le type de connexion
    if ((effectiveConnectionType === 'tcp' || effectiveConnectionType === 'wifi') && !printer.tcpHost) {
      toast({
        title: t('general.error'),
        description: t('printer.configureIpFirst'),
        variant: 'destructive',
      });
      return;
    }

    if (effectiveConnectionType === 'windows' && !printer.name) {
      toast({
        title: t('general.error'),
        description: 'Le nom de l\'imprimante Windows est requis pour le test.',
        variant: 'destructive',
      });
      return;
    }

    if (effectiveConnectionType === 'bluetooth') {
      toast({
        title: t('general.info'),
        description: 'Le test d\'impression Bluetooth n\'est pas encore disponible.',
        variant: 'default',
      });
      return;
    }

    setTestingPrinters(prev => ({ ...prev, [printer.id]: true }));
    setTestResults(prev => {
      const newResults = { ...prev };
      delete newResults[printer.id];
      return newResults;
    });

    try {
      // Test via daemon
      const daemonUrl = 'http://127.0.0.1:9100/print';
      const testContent = '\x1B@'; // ESC @ (initialize printer only, no print)
      
      let body: any;

      if (effectiveConnectionType === 'windows') {
        body = {
          connectionType: 'windows',
          target: {
            printerName: printer.name,
          },
          content: testContent,
          isThermalPrinter: printer.isThermalPrinter ?? true,
          role: printer.role || 'cashier',
        };
      } else if (effectiveConnectionType === 'tcp' || effectiveConnectionType === 'wifi') {
        body = {
          connectionType: effectiveConnectionType,
          target: {
            host: printer.tcpHost,
            port: printer.tcpPort || 9100,
          },
          content: testContent,
          isThermalPrinter: printer.isThermalPrinter ?? true,
          role: printer.role || 'cashier',
        };
      } else {
        throw new Error('Type de connexion non supporté pour le test');
      }

      console.log('[TEST] Testing printer via daemon:', body);

      const response = await fetch(daemonUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      // Try to parse error response even if status is not ok
      const result = await response.json().catch(() => null);
      
      if (!response.ok) {
        const errorMsg = result?.message || result?.error || `HTTP ${response.status}`;
        console.error('[TEST] Daemon error response:', result);
        throw new Error(
          `Daemon d'impression: ${errorMsg} (HTTP ${response.status})`
        );
      }
      
      if (!result || result.success !== true) {
        throw new Error(
          result?.message || result?.error || "Erreur lors du test de connexion via le daemon."
        );
      }

      let successMessage = 'Test réussi';
      if (effectiveConnectionType === 'windows') {
        successMessage = `Test réussi sur "${printer.name}"`;
      } else if (effectiveConnectionType === 'tcp' || effectiveConnectionType === 'wifi') {
        successMessage = `Connexion réussie à ${printer.tcpHost}:${printer.tcpPort || 9100}`;
      }

      setTestResults(prev => ({
        ...prev,
        [printer.id]: {
          success: true,
          message: successMessage
        }
      }));

      toast({
        title: 'Test réussi',
        description: successMessage,
      });
    } catch (error) {
      console.error('❌ Test printer error:', error);
      let errorMessage = 'Erreur lors du test de connexion';
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        errorMessage = `⚠️ Daemon d'impression non accessible!\n\nAssurez-vous que le daemon est démarré (http://127.0.0.1:9100)`;
      } else if (error instanceof Error) {
        errorMessage = error.message || errorMessage;
      }
      
      setTestResults(prev => ({
        ...prev,
        [printer.id]: {
          success: false,
          message: errorMessage
        }
      }));

      toast({
        title: t('printer.testError'),
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setTestingPrinters(prev => {
        const newState = { ...prev };
        delete newState[printer.id];
        return newState;
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4 sm:space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-xl sm:text-2xl font-bold">{t('settings.printers')}</h2>
        <Button
          size="sm"
          className="gap-2"
          onClick={handleAddPrinter}
        >
          <Plus className="w-4 h-4" />
          Ajouter une imprimante
        </Button>
      </div>

      <div className="space-y-3 sm:space-y-4">
        {printers.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Aucune imprimante configurée. Cliquez sur "Ajouter une imprimante" pour commencer.
          </div>
        )}

        {printers.map((printer) => (
          <div
            key={printer.id}
            className={cn(
              "p-3 sm:p-4 rounded-xl border-2 space-y-3",
              printer.enabled === false
                ? "bg-muted/30 border-dashed border-border/60 opacity-70"
                : "bg-muted/50 border-border"
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <Printer
                  className={cn(
                    "w-5 h-6 sm:w-6 sm:h-6 flex-shrink-0",
                    printer.role === 'kitchen'
                      ? "text-warning"
                      : "text-success",
                    printer.enabled === false && "opacity-60"
                  )}
                />
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-sm sm:text-base">
                    {printer.name || getRoleLabel(printer.role)}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-xs sm:text-sm text-muted-foreground">
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {getRoleLabel(printer.role)}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground flex items-center gap-1">
                      <Network className="w-3 h-3" />
                      {getConnectionLabel(printer.connectionType || 'tcp')}
                    </span>
                    {printer.isThermalPrinter && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[11px]">
                        Thermique ESC/POS
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border bg-background">
                  <Switch
                    checked={printer.enabled !== false}
                    onCheckedChange={async (checked) => {
                      await updatePrinter({ ...printer, enabled: checked });
                      toast({
                        title: checked ? 'Imprimante activée' : 'Imprimante désactivée',
                        description: `L'imprimante "${printer.name || 'sans nom'}" a été ${checked ? 'activée' : 'désactivée'}.`,
                      });
                    }}
                  />
                  <span className={cn(
                    "text-xs font-medium whitespace-nowrap",
                    printer.enabled === false ? "text-muted-foreground" : "text-foreground"
                  )}>
                    {printer.enabled === false ? 'Désactivée' : 'Activée'}
                  </span>
                </div>
                <Button
                  onClick={() => handleEditPrinter(printer)}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <Edit className="w-4 h-4" />
                  <span className="hidden sm:inline">Configurer</span>
                </Button>
                <Button
                  onClick={() => handleDeletePrinter(printer)}
                  variant="outline"
                  size="icon"
                  className="text-destructive border-destructive/40 hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Section de test et détails pour tous les types d'imprimantes */}
            <div className="mt-3 pt-3 border-t border-border space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs sm:text-sm">
                  {printer.connectionType === 'windows' ? (
                    <>
                      <Printer className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{printer.name || 'Imprimante Windows'}</span>
                    </>
                  ) : (printer.connectionType === 'tcp' || printer.connectionType === 'wifi' || !printer.connectionType) && printer.tcpHost ? (
                    <>
                      <Network className="w-4 h-4 text-muted-foreground" />
                      <span className="font-mono">{printer.tcpHost}:{printer.tcpPort || 9100}</span>
                    </>
                  ) : printer.connectionType === 'bluetooth' ? (
                    <>
                      <Wifi className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Bluetooth</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground text-xs">Aucune configuration réseau</span>
                  )}
                </div>
                <Button
                  onClick={() => handleTestPrinter(printer)}
                  disabled={testingPrinters[printer.id]}
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                >
                  {testingPrinters[printer.id] ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Test...
                    </>
                  ) : (
                    <>
                      <Activity className="w-3 h-3" />
                      Tester
                    </>
                  )}
                </Button>
              </div>
              {testResults[printer.id] && (
                <div className={cn(
                  "flex items-center gap-2 text-xs p-2 rounded",
                  testResults[printer.id].success
                    ? "bg-success/10 text-success"
                    : "bg-destructive/10 text-destructive"
                )}>
                  {testResults[printer.id].success ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <AlertCircle className="w-3 h-3" />
                  )}
                  <span>{testResults[printer.id].message}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Printer Modal */}
      {showPrinterModal && editingPrinter && (
        <PrinterConfigModal
          printer={editingPrinter}
          onClose={() => {
            setShowPrinterModal(false);
            setEditingPrinter(null);
          }}
          onSave={handleSavePrinter}
          t={t}
        />
      )}
    </motion.div>
  );
}

// Printer Configuration Modal
interface PrinterConfigModalProps {
  printer: PrinterType;
  onClose: () => void;
  onSave: (printer: PrinterType) => Promise<void>;
  t: (key: string) => string;
}

function PrinterConfigModal({ printer, onClose, onSave, t }: PrinterConfigModalProps) {
  const [name, setName] = useState(printer.name || '');
  const [role, setRole] = useState<PrinterRole>(printer.role || 'cashier');
  const [connectionType, setConnectionType] = useState<PrinterConnectionType>(printer.connectionType || 'tcp');
  const [tcpHost, setTcpHost] = useState(printer.tcpHost || '');
  const [tcpPort, setTcpPort] = useState(printer.tcpPort?.toString() || '9100');
  const [isThermalPrinter, setIsThermalPrinter] = useState(printer.isThermalPrinter !== undefined ? printer.isThermalPrinter : false);
  const [enabled, setEnabled] = useState(printer.enabled !== false);
  const [error, setError] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Le nom de l\'imprimante est requis');
      return;
    }

    // Validation selon le type de connexion
    if (connectionType === 'tcp' || connectionType === 'wifi') {
      // Validate IP address format
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (!tcpHost.trim()) {
        setError(t('general.ipRequired'));
        return;
      }
      if (!ipRegex.test(tcpHost.trim())) {
        setError(t('general.invalidIpFormat'));
        return;
      }
      if (!tcpPort || isNaN(parseInt(tcpPort)) || parseInt(tcpPort) < 1 || parseInt(tcpPort) > 65535) {
        setError(t('general.invalidPort'));
        return;
      }
    }

    const updatedPrinter: PrinterType = {
      ...printer,
      name: name.trim(),
      role,
      // On ne se base plus sur mode pour le routing, mais on garde 'tcp' pour les connexions réseau
      mode: connectionType === 'tcp' || connectionType === 'wifi' ? 'tcp' : printer.mode,
      connectionType,
      tcpHost: (connectionType === 'tcp' || connectionType === 'wifi') ? tcpHost.trim() : undefined,
      tcpPort: (connectionType === 'tcp' || connectionType === 'wifi') ? parseInt(tcpPort || '9100') : undefined,
      isThermalPrinter: isThermalPrinter,
      enabled,
    };

    await onSave(updatedPrinter);
  };

  const handleTestConnection = async () => {
    if (connectionType !== 'tcp') {
      setError('Le test de connexion est disponible uniquement pour les imprimantes réseau (Ethernet/Wi-Fi).');
      setTestResult(null);
      return;
    }
    // Validate IP address format
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!tcpHost.trim()) {
      setError(t('general.ipRequiredForTest'));
      setTestResult(null);
      return;
    }
    if (!ipRegex.test(tcpHost.trim())) {
      setError(t('general.invalidIpFormat'));
      setTestResult(null);
      return;
    }
    if (!tcpPort || isNaN(parseInt(tcpPort)) || parseInt(tcpPort) < 1 || parseInt(tcpPort) > 65535) {
      setError(t('general.invalidPort'));
      setTestResult(null);
      return;
    }

    setIsTesting(true);
    setError('');
    setTestResult(null);

    try {
      // Test via daemon
      const daemonUrl = 'http://127.0.0.1:9100/print';
      const testContent = '\x1B@'; // ESC @ (initialize printer only, no print)
      
      const body = {
        connectionType: connectionType === 'wifi' ? 'wifi' : 'tcp',
        target: {
          host: tcpHost.trim(),
          port: parseInt(tcpPort),
        },
        content: testContent,
        isThermalPrinter: isThermalPrinter,
        role: role || 'cashier',
      };

      console.log('[TEST] Testing printer connection via daemon:', body);

      const response = await fetch(daemonUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(
          `Daemon d'impression non accessible (HTTP ${response.status}). Vérifiez qu'il est démarré.`
        );
      }

      const result = await response.json().catch(() => null);
      
      if (!result || result.success !== true) {
        throw new Error(
          result?.message || "Erreur lors du test de connexion via le daemon."
        );
      }

      setTestResult({
        success: true,
        message: result.message || `Connexion réussie à ${tcpHost.trim()}:${tcpPort}`
      });
    } catch (error) {
      console.error('❌ Test connection error:', error);
      let errorMessage = 'Erreur lors du test de connexion';
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        errorMessage = `⚠️ Daemon d'impression non accessible!\n\nAssurez-vous que le daemon est démarré (http://127.0.0.1:9100)`;
      } else if (error instanceof Error) {
        errorMessage = error.message || errorMessage;
      }
      
      setTestResult({
        success: false,
        message: errorMessage
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="bg-card rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4 border-b border-border flex items-center justify-between flex-shrink-0">
            <h2 className="text-xl font-bold">
              {t('printer.configurePrinter').replace('{role}', printer.role === 'kitchen' ? t('printer.kitchen') : t('printer.cashier'))}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-accent rounded-xl transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                {error}
              </div>
            )}

            {testResult && (
              <div className={cn(
                "p-3 border rounded-lg text-sm flex items-center gap-2",
                testResult.success
                  ? "bg-success/10 border-success/20 text-success"
                  : "bg-destructive/10 border-destructive/20 text-destructive"
              )}>
                {testResult.success ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}

            {/* Nom et rôle */}
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-2">
                Nom de l'imprimante *
              </label>
              <TouchInput
                type="text"
                value={name}
                onChange={(value) => {
                  setName(value);
                  setError('');
                  setTestResult(null);
                }}
                placeholder="Imprimante cuisine"
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Saisissez un nom pour identifier cette imprimante (ex: "Imprimante cuisine", "Caisse principale")
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-2">
                Type de ticket
              </label>
              <Select
                value={role}
                onValueChange={(value) => {
                  setRole(value as PrinterRole);
                  setError('');
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kitchen">Ticket cuisine</SelectItem>
                  <SelectItem value="cashier">Reçu client</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-2">
                Type de connexion
              </label>
              <Select
                value={connectionType}
                onValueChange={(value) => {
                  setConnectionType(value as PrinterConnectionType);
                  setError('');
                  setTestResult(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tcp">Réseau (Ethernet / Wi-Fi)</SelectItem>
                  <SelectItem value="bluetooth">Bluetooth</SelectItem>
                  <SelectItem value="wifi">Wi-Fi direct</SelectItem>
                  <SelectItem value="windows">Imprimante Windows (daemon local)</SelectItem>
                </SelectContent>
              </Select>
              {connectionType !== 'tcp' && connectionType !== 'windows' && connectionType !== 'wifi' && (
                <p className="text-xs text-muted-foreground mt-1">
                  Pour le moment, seules l&apos;impression réseau (TCP/IP), Wi‑Fi et l&apos;impression Windows via le daemon sont supportées. Bluetooth sera ajouté plus tard.
                </p>
              )}
            </div>

            {/* Paramètres réseau TCP */}
            {connectionType === 'tcp' && (
              <>
                <div>
                  <label className="text-sm font-medium text-muted-foreground block mb-2">
                    Adresse IP de l'imprimante *
                  </label>
                  <IPInput
                    value={tcpHost}
                    onChange={(value) => {
                      setTcpHost(value);
                      setError('');
                      setTestResult(null);
                    }}
                    placeholder="192.168.1.100"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Adresse IP de l&apos;imprimante sur le réseau
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground block mb-2">
                    Port *
                  </label>
                  <NumericInput
                    value={tcpPort}
                    onChange={(value) => {
                      setTcpPort(value);
                      setError('');
                      setTestResult(null);
                    }}
                    placeholder="9100"
                    allowDecimal={false}
                    min={1}
                    max={65535}
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Port TCP (par défaut: 9100 pour l&apos;impression RAW)
                  </p>
                </div>
              </>
            )}

            {/* Activation / désactivation */}
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-2">
                Statut de l&apos;imprimante
              </label>
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="flex-1 pr-4">
                  <p className="text-xs text-muted-foreground">
                    Activez ou désactivez cette imprimante sans la supprimer. Si elle est désactivée, elle ne sera pas utilisée pour l&apos;impression.
                  </p>
                </div>
                <Switch
                  checked={enabled}
                  onCheckedChange={setEnabled}
                />
              </div>
            </div>

            {/* Type d'imprimante */}
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-2">
                {t('printer.printerType')}
              </label>
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">
                    {t('printer.printerTypeDesc')}
                  </p>
                </div>
                <Switch
                  checked={isThermalPrinter}
                  onCheckedChange={setIsThermalPrinter}
                />
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {isThermalPrinter ? (
                  <span className="text-amber-600">⚠ {t('printer.thermalPrinterNote')}</span>
                ) : (
                  <span className="text-blue-600">ℹ {t('printer.regularPrinterNote')}</span>
                )}
              </div>
            </div>

            {connectionType === 'tcp' && (
              <Button
                onClick={handleTestConnection}
                disabled={isTesting || !tcpHost.trim() || !tcpPort}
                variant="outline"
                className="w-full"
                type="button"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Test en cours...
                  </>
                ) : (
                  <>
                    <Activity className="w-4 h-4 mr-2" />
                    Tester la connexion
                  </>
                )}
              </Button>
            )}
          </div>

          <div className="flex gap-2 p-4 border-t border-border flex-shrink-0">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1"
            >
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              className="flex-1"
            >
              <Save className="w-4 h-4 mr-2" />
              Enregistrer
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
