import { useState, useMemo } from 'react';
import { Settings, ReceiptCustomization, Order, OrderLine } from '@/lib/database';
import { motion } from 'framer-motion';
import { 
  Eye, 
  EyeOff, 
  AlignLeft, 
  AlignCenter, 
  AlignRight,
  Type,
  SeparatorHorizontal,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useDialog } from '@/hooks/use-dialog';
import { cn } from '@/lib/utils';
import { TouchInput } from '@/components/ui/touch-input';
import { TouchTextarea } from '@/components/ui/touch-textarea';
import { NumericInput } from '@/components/ui/numeric-input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { formatCurrency, Currency } from '@/lib/i18n';
import { usePOS } from '@/contexts/POSContext';
import { DirectPrinter } from '@/lib/printer';
import { renderReceiptHTML } from '@/lib/receipt-renderer';

interface ReceiptCustomizationSectionProps {
  settings: Settings;
  updateSettings: (updates: Partial<Settings>) => Promise<void>;
  t: (key: string) => string;
}

export function ReceiptCustomizationSection({ settings, updateSettings, t }: ReceiptCustomizationSectionProps) {
  const { currency } = usePOS();
  const { showDialog, DialogComponent } = useDialog();
  // Use useMemo to make customization reactive to settings changes
  const customization = useMemo(() => {
    return settings.receiptCustomization || getDefaultCustomization();
  }, [settings.receiptCustomization]);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    display: true,
    formatting: false,
    layout: false,
    labels: false,
    kitchen: false,
    preview: false,
  });
  
  // Create a sample order for preview with dynamic order number based on numbering strategy
  const sampleOrderNumber = useMemo(() => {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    if (settings.numberingStrategy === 'daily') {
      return `${today}-001`;
    } else if (settings.numberingStrategy === 'prefixed') {
      return `${settings.numberingPrefix || 'CMD'}-0001`;
    } else {
      return '000001';
    }
  }, [settings.numberingStrategy, settings.numberingPrefix]);

  const sampleOrder: Order = {
    id: 'preview-order',
    orderNumber: sampleOrderNumber,
    status: 'paid',
    type: 'dine-in',
    lines: [
      {
        id: 'line1',
        productId: 'prod1',
        productName: 'Tacos Classique',
        variantId: 'var1',
        variantSize: 'XL',
        quantity: 2,
        unitPrice: 8.50,
        modifiers: [
          {
            optionId: 'mod1',
            optionName: 'Sauce blanche',
            priceAdjustment: 0.50,
          },
          {
            optionId: 'mod2',
            optionName: 'Frites',
            priceAdjustment: 2.00,
          },
        ],
        note: 'Sans oignons',
        isManual: false,
      },
      {
        id: 'line2',
        productId: 'prod2',
        productName: 'Burger Deluxe',
        variantId: 'var2',
        variantSize: 'Grande',
        quantity: 1,
        unitPrice: 12.00,
        modifiers: [
          {
            optionId: 'mod3',
            optionName: 'Fromage supplémentaire',
            priceAdjustment: 1.50,
          },
        ],
        note: '',
        isManual: false,
      },
    ],
    subtotal: 35.50,
    discount: 0,
    total: 35.50,
    paymentMethod: 'cash',
    createdBy: 'admin',
    createdAt: new Date(),
    updatedAt: new Date(),
    paidAt: new Date(),
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const updateCustomization = async (updates: Partial<ReceiptCustomization>) => {
    await updateSettings({
      receiptCustomization: { ...customization, ...updates }
    });
  };

  return (
    <>
      {DialogComponent}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-4 sm:space-y-6 w-full"
    >
      <h2 className="text-xl sm:text-2xl font-bold">Personnalisation des Tickets et Reçus</h2>
      
      {/* Layout with options on left and preview on right */}
      <div className="flex flex-col lg:flex-row gap-6 w-full">
        {/* Left column: All options including general settings */}
        <div className="lg:w-[50%] lg:min-w-[600px] space-y-4 sm:space-y-6">
          {/* General Receipt Settings */}
          <div className="p-4 bg-muted/50 rounded-xl space-y-4">
            <h3 className="font-semibold text-base">Paramètres généraux</h3>
            
            <div>
              <label className="text-xs sm:text-sm font-medium text-muted-foreground">
                Message d'en-tête
              </label>
              <TouchTextarea
                value={settings.receiptHeader}
                onChange={(value) => updateSettings({ receiptHeader: value })}
                className="mt-1"
                rows={2}
                placeholder="Message d'en-tête"
                showQuickSuggestions={false}
              />
            </div>

            <div>
              <label className="text-xs sm:text-sm font-medium text-muted-foreground">
                Message de pied de page
              </label>
              <TouchTextarea
                value={settings.receiptFooter}
                onChange={(value) => updateSettings({ receiptFooter: value })}
                className="mt-1"
                rows={2}
                placeholder="Message de pied de page"
                showQuickSuggestions={false}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-background rounded-lg">
              <span className="font-medium text-sm">Afficher l'adresse</span>
              <Switch
                checked={settings.showAddress}
                onCheckedChange={(checked) => updateSettings({ showAddress: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-background rounded-lg">
              <span className="font-medium text-sm">Afficher le téléphone</span>
              <Switch
                checked={settings.showPhone}
                onCheckedChange={(checked) => updateSettings({ showPhone: checked })}
              />
            </div>
          </div>
          {/* Display Options */}
          <Collapsible open={expandedSections.display} onOpenChange={() => toggleSection('display')}>
        <CollapsibleTrigger className="w-full flex items-center justify-between p-4 bg-muted/50 rounded-xl hover:bg-muted/70 transition-colors">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            <h3 className="font-semibold text-base">Options d'affichage</h3>
          </div>
          {expandedSections.display ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DisplayToggle label="Numéro de commande" checked={customization.showOrderNumber} onChange={(v) => updateCustomization({ showOrderNumber: v })} />
            <DisplayToggle label="Date" checked={customization.showDate} onChange={(v) => updateCustomization({ showDate: v })} />
            <DisplayToggle label="Heure" checked={customization.showTime} onChange={(v) => updateCustomization({ showTime: v })} />
            <DisplayToggle label="Type de commande" checked={customization.showOrderType} onChange={(v) => updateCustomization({ showOrderType: v })} />
            <DisplayToggle label="Mode de paiement" checked={customization.showPaymentMethod} onChange={(v) => updateCustomization({ showPaymentMethod: v })} />
            <DisplayToggle label="Caissier" checked={customization.showCashier} onChange={(v) => updateCustomization({ showCashier: v })} />
            <DisplayToggle label="Produits" checked={customization.showProducts} onChange={(v) => updateCustomization({ showProducts: v })} />
            <DisplayToggle label="Prix des produits" checked={customization.showProductPrices} onChange={(v) => updateCustomization({ showProductPrices: v })} />
            <DisplayToggle label="Modificateurs" checked={customization.showModifiers} onChange={(v) => updateCustomization({ showModifiers: v })} />
            <DisplayToggle label="Notes" checked={customization.showNotes} onChange={(v) => updateCustomization({ showNotes: v })} />
            <DisplayToggle label="Sous-total" checked={customization.showSubtotal} onChange={(v) => updateCustomization({ showSubtotal: v })} />
            <DisplayToggle label="Remise" checked={customization.showDiscount} onChange={(v) => updateCustomization({ showDiscount: v })} />
            <DisplayToggle label="Total" checked={customization.showTotal} onChange={(v) => updateCustomization({ showTotal: v })} />
            <DisplayToggle label="Montant reçu" checked={customization.showAmountReceived} onChange={(v) => updateCustomization({ showAmountReceived: v })} />
            <DisplayToggle label="Monnaie" checked={customization.showChange} onChange={(v) => updateCustomization({ showChange: v })} />
          </div>
        </CollapsibleContent>
          </Collapsible>

          {/* Formatting Options */}
          <Collapsible open={expandedSections.formatting} onOpenChange={() => toggleSection('formatting')}>
            <CollapsibleTrigger className="w-full flex items-center justify-between p-4 bg-muted/50 rounded-xl hover:bg-muted/70 transition-colors">
              <div className="flex items-center gap-2">
                <Type className="w-5 h-5" />
                <h3 className="font-semibold text-base">Options de formatage</h3>
              </div>
              {expandedSections.formatting ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 space-y-4">
          <div>
            <label className="text-xs sm:text-sm font-medium text-muted-foreground block mb-2">
              Format du numéro de commande
            </label>
            <Input
              value={customization.orderNumberFormat}
              onChange={(e) => updateCustomization({ orderNumberFormat: e.target.value })}
              placeholder="{prefix}{number}"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Utilisez {"{prefix}"} pour le préfixe et {"{number}"} pour le numéro
            </p>
          </div>

          <div>
            <label className="text-xs sm:text-sm font-medium text-muted-foreground block mb-2">
              Padding du numéro (zéros)
            </label>
            <NumericInput
              value={customization.orderNumberPadding}
              onChange={(value) => updateCustomization({ orderNumberPadding: parseInt(value) || 6 })}
              min={0}
              max={20}
              className="w-32"
              allowDecimal={false}
            />
          </div>

          <div>
            <label className="text-xs sm:text-sm font-medium text-muted-foreground block mb-2">
              Format de date
            </label>
            <Select
              value={customization.dateFormat}
              onValueChange={(value) => updateCustomization({ dateFormat: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                <SelectItem value="DD-MM-YYYY">DD-MM-YYYY</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs sm:text-sm font-medium text-muted-foreground block mb-2">
              Format d'heure
            </label>
            <Select
              value={customization.timeFormat}
              onValueChange={(value) => updateCustomization({ timeFormat: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HH:mm">24h (HH:mm)</SelectItem>
                <SelectItem value="hh:mm A">12h (hh:mm AM/PM)</SelectItem>
              </SelectContent>
            </Select>
          </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Layout Options */}
          <Collapsible open={expandedSections.layout} onOpenChange={() => toggleSection('layout')}>
            <CollapsibleTrigger className="w-full flex items-center justify-between p-4 bg-muted/50 rounded-xl hover:bg-muted/70 transition-colors">
              <div className="flex items-center gap-2">
                <AlignCenter className="w-5 h-5" />
                <h3 className="font-semibold text-base">Options de mise en page</h3>
              </div>
              {expandedSections.layout ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 space-y-4">
          <div>
            <label className="text-xs sm:text-sm font-medium text-muted-foreground block mb-2">
              Alignement de l'en-tête
            </label>
            <div className="flex gap-2">
              <Button
                variant={customization.headerAlignment === 'left' ? 'default' : 'outline'}
                onClick={() => updateCustomization({ headerAlignment: 'left' })}
                className="flex-1"
              >
                <AlignLeft className="w-4 h-4 mr-2" />
                Gauche
              </Button>
              <Button
                variant={customization.headerAlignment === 'center' ? 'default' : 'outline'}
                onClick={() => updateCustomization({ headerAlignment: 'center' })}
                className="flex-1"
              >
                <AlignCenter className="w-4 h-4 mr-2" />
                Centre
              </Button>
              <Button
                variant={customization.headerAlignment === 'right' ? 'default' : 'outline'}
                onClick={() => updateCustomization({ headerAlignment: 'right' })}
                className="flex-1"
              >
                <AlignRight className="w-4 h-4 mr-2" />
                Droite
              </Button>
            </div>
          </div>

          <div>
            <label className="text-xs sm:text-sm font-medium text-muted-foreground block mb-2">
              Style du nom du restaurant
            </label>
            <Select
              value={customization.restaurantNameStyle}
              onValueChange={(value: 'normal' | 'uppercase' | 'lowercase') => updateCustomization({ restaurantNameStyle: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="uppercase">MAJUSCULES</SelectItem>
                <SelectItem value="lowercase">minuscules</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs sm:text-sm font-medium text-muted-foreground block mb-2">
              Style du nom des produits
            </label>
            <Select
              value={customization.productNameStyle}
              onValueChange={(value: 'normal' | 'uppercase' | 'lowercase') => updateCustomization({ productNameStyle: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="uppercase">MAJUSCULES</SelectItem>
                <SelectItem value="lowercase">minuscules</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs sm:text-sm font-medium text-muted-foreground block mb-2">
              Style des séparateurs
            </label>
            <Select
              value={customization.separatorStyle}
              onValueChange={(value: 'dashes' | 'dots' | 'equals' | 'line' | 'none') => {
                const chars: Record<string, string> = {
                  dashes: '─',
                  dots: '·',
                  equals: '═',
                  line: '─',
                  none: ' ',
                };
                updateCustomization({ separatorStyle: value, separatorChar: chars[value] });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dashes">Tirets (─)</SelectItem>
                <SelectItem value="dots">Points (·)</SelectItem>
                <SelectItem value="equals">Double traits (═)</SelectItem>
                <SelectItem value="line">Ligne simple (─)</SelectItem>
                <SelectItem value="none">Aucun</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {customization.separatorStyle !== 'none' && (
            <div>
              <label className="text-xs sm:text-sm font-medium text-muted-foreground block mb-2">
                Caractère de séparation personnalisé
              </label>
              <Input
                value={customization.separatorChar}
                onChange={(e) => updateCustomization({ separatorChar: e.target.value || '─' })}
                maxLength={1}
                className="w-32 font-mono text-2xl text-center"
                placeholder="─"
              />
            </div>
          )}

          <div>
            <label className="text-xs sm:text-sm font-medium text-muted-foreground block mb-2">
              Taille de police
            </label>
            <Select
              value={customization.fontSize}
              onValueChange={(value: 'small' | 'normal' | 'large') => updateCustomization({ fontSize: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Petite</SelectItem>
                <SelectItem value="normal">Normale</SelectItem>
                <SelectItem value="large">Grande</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs sm:text-sm font-medium text-muted-foreground block mb-2">
              Police de caractères
            </label>
            <Select
              value={customization.fontFamily}
              onValueChange={(value: 'monospace' | 'sans-serif' | 'serif') => updateCustomization({ fontFamily: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monospace">Monospace (Courier)</SelectItem>
                <SelectItem value="sans-serif">Sans-serif (Arial)</SelectItem>
                <SelectItem value="serif">Serif (Times)</SelectItem>
              </SelectContent>
            </Select>
          </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Custom Labels */}
          <Collapsible open={expandedSections.labels} onOpenChange={() => toggleSection('labels')}>
            <CollapsibleTrigger className="w-full flex items-center justify-between p-4 bg-muted/50 rounded-xl hover:bg-muted/70 transition-colors">
              <div className="flex items-center gap-2">
                <Type className="w-5 h-5" />
                <h3 className="font-semibold text-base">Libellés personnalisés</h3>
              </div>
              {expandedSections.labels ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 space-y-3">
          <LabelInput label="Numéro de commande" value={customization.labelOrderNumber} onChange={(v) => updateCustomization({ labelOrderNumber: v })} />
          <LabelInput label="Date" value={customization.labelDate} onChange={(v) => updateCustomization({ labelDate: v })} />
          <LabelInput label="Heure" value={customization.labelTime} onChange={(v) => updateCustomization({ labelTime: v })} />
          <LabelInput label="Type de commande" value={customization.labelOrderType} onChange={(v) => updateCustomization({ labelOrderType: v })} />
          <LabelInput label="Mode de paiement" value={customization.labelPaymentMethod} onChange={(v) => updateCustomization({ labelPaymentMethod: v })} />
          <LabelInput label="Caissier" value={customization.labelCashier} onChange={(v) => updateCustomization({ labelCashier: v })} />
          <LabelInput label="Sous-total" value={customization.labelSubtotal} onChange={(v) => updateCustomization({ labelSubtotal: v })} />
          <LabelInput label="Remise" value={customization.labelDiscount} onChange={(v) => updateCustomization({ labelDiscount: v })} />
          <LabelInput label="Total" value={customization.labelTotal} onChange={(v) => updateCustomization({ labelTotal: v })} />
          <LabelInput label="Montant reçu" value={customization.labelAmountReceived} onChange={(v) => updateCustomization({ labelAmountReceived: v })} />
          <LabelInput label="Monnaie" value={customization.labelChange} onChange={(v) => updateCustomization({ labelChange: v })} />
          <LabelInput label="Message de remerciement" value={customization.labelThankYou} onChange={(v) => updateCustomization({ labelThankYou: v })} />
            </CollapsibleContent>
          </Collapsible>

          {/* Kitchen Ticket Options */}
          <Collapsible open={expandedSections.kitchen} onOpenChange={() => toggleSection('kitchen')}>
            <CollapsibleTrigger className="w-full flex items-center justify-between p-4 bg-muted/50 rounded-xl hover:bg-muted/70 transition-colors">
              <div className="flex items-center gap-2">
                <SeparatorHorizontal className="w-5 h-5" />
                <h3 className="font-semibold text-base">Options du ticket cuisine</h3>
              </div>
              {expandedSections.kitchen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DisplayToggle label="Numéro de commande" checked={customization.kitchenShowOrderNumber} onChange={(v) => updateCustomization({ kitchenShowOrderNumber: v })} />
            <DisplayToggle label="Date" checked={customization.kitchenShowDate} onChange={(v) => updateCustomization({ kitchenShowDate: v })} />
            <DisplayToggle label="Heure" checked={customization.kitchenShowTime} onChange={(v) => updateCustomization({ kitchenShowTime: v })} />
            <DisplayToggle label="Type de commande" checked={customization.kitchenShowOrderType} onChange={(v) => updateCustomization({ kitchenShowOrderType: v })} />
            <DisplayToggle label="Caissier" checked={customization.kitchenShowCashier} onChange={(v) => updateCustomization({ kitchenShowCashier: v })} />
            <DisplayToggle label="Produits" checked={customization.kitchenShowProducts} onChange={(v) => updateCustomization({ kitchenShowProducts: v })} />
            <DisplayToggle label="Prix des produits" checked={customization.kitchenShowProductPrices} onChange={(v) => updateCustomization({ kitchenShowProductPrices: v })} />
            <DisplayToggle label="Modificateurs" checked={customization.kitchenShowModifiers} onChange={(v) => updateCustomization({ kitchenShowModifiers: v })} />
            <DisplayToggle label="Notes" checked={customization.kitchenShowNotes} onChange={(v) => updateCustomization({ kitchenShowNotes: v })} />
          </div>
        </CollapsibleContent>
          </Collapsible>

          {/* Reset Button */}
          <div className="pt-4 border-t border-border">
            <Button
              variant="outline"
              onClick={async () => {
                const confirmed = await showDialog({
                  title: 'Réinitialiser',
                  description: t('receipt.resetConfirm'),
                  confirmText: 'Confirmer',
                  cancelText: 'Annuler',
                  variant: 'default',
                });
                if (confirmed) {
                  updateSettings({ receiptCustomization: getDefaultCustomization() });
                }
              }}
              className="w-full"
            >
              {t('receipt.resetCustomizations')}
            </Button>
          </div>
        </div>

        {/* Right column: Preview - Always visible, floating on right (desktop) */}
        <div className="hidden lg:block w-[50%] lg:min-w-[600px] flex-shrink-0">
          <div className="sticky top-4">
            <div className="bg-background rounded-xl p-4 border border-border">
              <h3 className="font-semibold text-base mb-4 flex items-center gap-2">
                <Eye className="w-5 h-5" />
                {t('receipt.preview')}
              </h3>
              <Tabs defaultValue="receipt" className="w-full">
                <TabsList className="w-full mb-4">
                  <TabsTrigger value="receipt" className="flex-1">
                    {t('print.receipt')}
                  </TabsTrigger>
                  <TabsTrigger value="kitchen" className="flex-1">
                    {t('print.kitchenTicket')}
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="receipt" className="mt-0">
                  <div className="bg-white text-black p-6 rounded-lg shadow-inner overflow-auto max-h-[calc(100vh-300px)] max-w-full" style={{ 
                    fontFamily: customization.fontFamily === 'monospace' ? 'Courier New, monospace' : 
                               customization.fontFamily === 'sans-serif' ? 'Arial, sans-serif' : 
                               'Times New Roman, serif',
                    fontSize: customization.fontSize === 'small' ? '11px' : 
                             customization.fontSize === 'large' ? '15px' : 
                             '13px',
                    lineHeight: '1.5',
                    letterSpacing: '0.5px',
                    minWidth: '300px'
                  }}>
                    {renderReceiptHTML({
                      order: sampleOrder,
                      settings,
                      currency,
                      customization,
                      cashierName: 'Admin',
                      amountReceived: sampleOrder.paymentMethod === 'cash' ? sampleOrder.total + 5 : undefined,
                      change: sampleOrder.paymentMethod === 'cash' ? 5 : undefined,
                      t,
                      type: 'receipt'
                    })}
                  </div>
                </TabsContent>
                
                <TabsContent value="kitchen" className="mt-0">
                  <div className="bg-white text-black p-6 rounded-lg shadow-inner overflow-auto max-h-[calc(100vh-300px)] max-w-full" style={{ 
                    fontFamily: customization.fontFamily === 'monospace' ? 'Courier New, monospace' : 
                               customization.fontFamily === 'sans-serif' ? 'Arial, sans-serif' : 
                               'Times New Roman, serif',
                    fontSize: customization.fontSize === 'small' ? '11px' : 
                             customization.fontSize === 'large' ? '15px' : 
                             '13px',
                    lineHeight: '1.5',
                    letterSpacing: '0.5px',
                    minWidth: '300px'
                  }}>
                    {renderReceiptHTML({
                      order: sampleOrder,
                      settings,
                      currency,
                      customization,
                      cashierName: 'Admin',
                      t,
                      type: 'kitchen'
                    })}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
        
      {/* Mobile Preview - Below options */}
      <div className="lg:hidden mt-6">
          <div className="bg-background rounded-xl p-4 border border-border">
            <h3 className="font-semibold text-base mb-4 flex items-center gap-2">
              <Eye className="w-5 h-5" />
              {t('receipt.preview')}
            </h3>
            <Tabs defaultValue="receipt" className="w-full">
              <TabsList className="w-full mb-4">
                <TabsTrigger value="receipt" className="flex-1">
                  {t('print.receipt')}
                </TabsTrigger>
                <TabsTrigger value="kitchen" className="flex-1">
                  {t('print.kitchenTicket')}
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="receipt" className="mt-0">
                <div className="bg-white text-black p-6 rounded-lg shadow-inner overflow-auto max-h-96 max-w-full" style={{ 
                  fontFamily: customization.fontFamily === 'monospace' ? 'Courier New, monospace' : 
                             customization.fontFamily === 'sans-serif' ? 'Arial, sans-serif' : 
                             'Times New Roman, serif',
                  fontSize: customization.fontSize === 'small' ? '11px' : 
                           customization.fontSize === 'large' ? '15px' : 
                           '13px',
                  lineHeight: '1.5',
                  letterSpacing: '0.5px',
                  minWidth: '300px'
                }}>
                  {renderReceiptHTML({
                    order: sampleOrder,
                    settings,
                    currency,
                    customization,
                    cashierName: 'Admin',
                    amountReceived: sampleOrder.paymentMethod === 'cash' ? sampleOrder.total + 5 : undefined,
                    change: sampleOrder.paymentMethod === 'cash' ? 5 : undefined,
                    t,
                    type: 'receipt'
                  })}
                </div>
              </TabsContent>
              
              <TabsContent value="kitchen" className="mt-0">
                <div className="bg-white text-black p-6 rounded-lg shadow-inner overflow-auto max-h-96 max-w-full" style={{ 
                  fontFamily: customization.fontFamily === 'monospace' ? 'Courier New, monospace' : 
                             customization.fontFamily === 'sans-serif' ? 'Arial, sans-serif' : 
                             'Times New Roman, serif',
                  fontSize: customization.fontSize === 'small' ? '11px' : 
                           customization.fontSize === 'large' ? '15px' : 
                           '13px',
                  lineHeight: '1.5',
                  letterSpacing: '0.5px',
                  minWidth: '300px'
                }}>
                  {renderReceiptHTML({
                    order: sampleOrder,
                    settings,
                    currency,
                    customization,
                    cashierName: 'Admin',
                    t,
                    type: 'kitchen'
                  })}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
    </motion.div>
    </>
  );
}

// DEPRECATED: Use renderReceiptHTML from @/lib/receipt-renderer instead
// This function is kept for reference but should not be used
function _renderReceiptPreview_OLD_UNUSED(order: Order, settings: Settings, currency: Currency, customization: ReceiptCustomization, t: (key: string) => string) {
  const typeLabel = order.type === 'dine-in' ? `🍽️ ${t('print.dineIn')}` : `📦 ${t('print.takeaway')}`;
  const paymentLabel = order.paymentMethod === 'cash' ? t('print.cash') : t('print.card');
  
  // Format date and time according to customization
  const dateObj = new Date(order.createdAt);
  const formattedDate = DirectPrinter.formatDate(dateObj, customization.dateFormat);
  const formattedTime = DirectPrinter.formatDate(dateObj, customization.timeFormat);
  
  // Format order number
  const formattedOrderNumber = DirectPrinter.formatOrderNumber(
    order.orderNumber,
    settings.numberingPrefix || '',
    customization
  );
  
  // Sample payment info for preview
  const amountReceived = order.paymentMethod === 'cash' ? order.total + 5 : undefined;
  const change = amountReceived ? amountReceived - order.total : undefined;
  
  // Get separator character
  const separatorChar = customization.separatorStyle === 'none' ? '' : customization.separatorChar || '─';
  
  // Get alignment class
  const headerAlignClass = customization.headerAlignment === 'left' ? 'text-left' : 
                           customization.headerAlignment === 'right' ? 'text-right' : 
                           'text-center';
  
  // Separator component that spans full width
  const Separator = () => {
    if (customization.separatorStyle === 'none') return null;
    return (
      <div 
        className="divider my-3 text-gray-400" 
        style={{ 
          fontFamily: 'monospace',
          width: '100%',
          display: 'block',
          lineHeight: '1',
          letterSpacing: '0',
          overflow: 'hidden',
          position: 'relative',
          height: '1em'
        }}
      >
        <div style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          whiteSpace: 'nowrap',
          overflow: 'hidden'
        }}>
          {separatorChar.repeat(500)}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Restaurant Header - With customizable alignment */}
      <div className={`header mb-4 ${headerAlignClass}`}>
        {settings?.logo && (
          <div className="mb-3">
            <img 
              src={settings.logo} 
              alt="Logo" 
              className="h-20 mx-auto object-contain"
            />
          </div>
        )}
        <div className="restaurant-name text-lg font-bold uppercase tracking-wide mb-1">
          {DirectPrinter.applyTextStyle(settings?.restaurantName || t('print.restaurant'), customization.restaurantNameStyle)}
        </div>
        {settings?.showAddress && settings?.address && (
          <div className="address text-xs mb-1">{settings.address}</div>
        )}
        {settings?.showPhone && settings?.phone && (
          <div className="phone text-xs">{settings.phone}</div>
        )}
      </div>

      <Separator />

      {/* Receipt Header Message */}
      {settings?.receiptHeader && (
        <>
          <div className={`section text-xs mb-3 ${headerAlignClass}`} style={{ whiteSpace: 'pre-line' }}>
            {settings.receiptHeader}
          </div>
          <Separator />
        </>
      )}

      {/* Order Info - Conditional display based on customization */}
      {customization.showOrderNumber || customization.showDate || customization.showTime || customization.showOrderType || customization.showPaymentMethod || customization.showCashier ? (
        <>
          <div className="section mb-4">
            <div className="order-info text-xs space-y-1">
              {customization.showOrderNumber && (
                <div className="flex justify-between">
                  <span className="font-semibold">{customization.labelOrderNumber}:</span>
                  <span className="font-mono">{formattedOrderNumber}</span>
                </div>
              )}
              {customization.showDate && (
                <div className="flex justify-between">
                  <span className="font-semibold">{customization.labelDate}:</span>
                  <span>{formattedDate}</span>
                </div>
              )}
              {customization.showTime && (
                <div className="flex justify-between">
                  <span className="font-semibold">{customization.labelTime}:</span>
                  <span>{formattedTime}</span>
                </div>
              )}
              {customization.showOrderType && (
                <div className="flex justify-between">
                  <span className="font-semibold">{customization.labelOrderType}:</span>
                  <span>{typeLabel}</span>
                </div>
              )}
              {customization.showPaymentMethod && (
                <div className="flex justify-between">
                  <span className="font-semibold">{customization.labelPaymentMethod}:</span>
                  <span>{paymentLabel}</span>
                </div>
              )}
              {customization.showCashier && (
                <div className="flex justify-between">
                  <span className="font-semibold">{customization.labelCashier}:</span>
                  <span>Admin</span>
                </div>
              )}
            </div>
          </div>
          <Separator />
        </>
      ) : null}

      {/* Order Lines - Conditional display */}
      {customization.showProducts && order.lines.length > 0 && (
        <>
          <div className="section mb-4 space-y-3">
            {order.lines.map((line, index) => {
              const lineTotal = (line.unitPrice + line.modifiers.reduce((sum, m) => sum + m.priceAdjustment, 0)) * line.quantity;
              const productName = DirectPrinter.applyTextStyle(line.productName, customization.productNameStyle);
              return (
                <div key={index} className="order-line">
                  <div className="line-header font-semibold uppercase text-sm mb-1">
                    {line.quantity}x {productName}
                  </div>
                  {customization.showModifiers && line.variantSize && (
                    <div className="line-details text-xs ml-3 text-gray-600">
                      Taille: {line.variantSize}
                    </div>
                  )}
                  {customization.showModifiers && line.modifiers.length > 0 && (
                    <div className="line-details text-xs ml-3 text-gray-600 space-y-0.5">
                      {line.modifiers.map((mod, modIndex) => (
                        <div key={modIndex}>+ (S) {mod.optionName}</div>
                      ))}
                    </div>
                  )}
                  {customization.showNotes && line.note && (
                    <div className="line-details text-xs ml-3 text-amber-700 font-semibold italic mt-1">
                      ⚠ NOTE: {line.note}
                    </div>
                  )}
                  {customization.showProductPrices && (
                    <div className="text-right mt-1 text-sm font-semibold">
                      {formatCurrency(lineTotal, currency)}
                    </div>
                  )}
                  {index < order.lines.length - 1 && customization.separatorStyle !== 'none' && (
                    <div className="mt-2 text-center text-gray-400" style={{ fontFamily: 'monospace' }}>
                      {customization.separatorChar.repeat(20)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <Separator />
        </>
      )}

      {/* Totals - Conditional display */}
      {(customization.showSubtotal || customization.showDiscount || customization.showTotal || customization.showAmountReceived || customization.showChange) && (
        <>
          <div className="totals space-y-2 mb-4">
            {customization.showSubtotal && (
              <div className="total-line flex justify-between text-xs">
                <span>{customization.labelSubtotal}</span>
                <span>{formatCurrency(order.subtotal, currency)}</span>
              </div>
            )}
            {customization.showDiscount && order.discount > 0 && (
              <div className="total-line flex justify-between text-xs text-green-700">
                <span>{customization.labelDiscount}</span>
                <span>-{formatCurrency(order.discount, currency)}</span>
              </div>
            )}
            {customization.showTotal && (
              <>
                <div className="divider border-t border-gray-400 my-2"></div>
                <div className="total-line flex justify-between text-base font-bold uppercase">
                  <span>{customization.labelTotal}</span>
                  <span>{formatCurrency(order.total, currency)}</span>
                </div>
              </>
            )}
            {order.paymentMethod === 'cash' && amountReceived && change !== undefined && (
              <>
                <div className="divider border-t border-gray-400 my-2"></div>
                {customization.showAmountReceived && (
                  <div className="total-line flex justify-between text-xs">
                    <span>{customization.labelAmountReceived}:</span>
                    <span>{formatCurrency(amountReceived, currency)}</span>
                  </div>
                )}
                {customization.showChange && change > 0 && (
                  <div className="total-line flex justify-between text-xs">
                    <span>{customization.labelChange}:</span>
                    <span>{formatCurrency(change, currency)}</span>
                  </div>
                )}
              </>
            )}
          </div>
          <Separator />
        </>
      )}

      {/* Receipt Footer */}
      {settings?.receiptFooter && (
        <>
          <div className={`footer text-xs mb-3 ${headerAlignClass}`} style={{ whiteSpace: 'pre-line' }}>
            {settings.receiptFooter}
          </div>
          <Separator />
        </>
      )}

      <div className={`footer mt-4 ${headerAlignClass}`}>
        <div className="text-sm font-semibold uppercase tracking-wide mb-2">
          {customization.labelThankYou}
        </div>
      </div>
    </>
  );
}

// DEPRECATED: Use renderReceiptHTML from @/lib/receipt-renderer instead
// This function is kept for reference but should not be used
function _renderKitchenPreview_OLD_UNUSED(order: Order, settings: Settings, customization: ReceiptCustomization, currency: Currency, t: (key: string) => string) {
  const typeLabel = order.type === 'dine-in' ? `🍽️ ${t('print.dineIn')}` : `📦 ${t('print.takeaway')}`;
  
  // Format date and time according to customization
  const dateObj = new Date(order.createdAt);
  const formattedDate = DirectPrinter.formatDate(dateObj, customization.dateFormat);
  const formattedTime = DirectPrinter.formatDate(dateObj, customization.timeFormat);
  
  // Format order number
  const formattedOrderNumber = DirectPrinter.formatOrderNumber(
    order.orderNumber,
    settings.numberingPrefix || '',
    customization
  );
  
  // Get separator character
  const separatorChar = customization.separatorStyle === 'none' ? '' : customization.separatorChar || '─';
  
  // Get alignment class
  const headerAlignClass = customization.headerAlignment === 'left' ? 'text-left' : 
                           customization.headerAlignment === 'right' ? 'text-right' : 
                           'text-center';
  
  // Separator component that spans full width
  const Separator = () => {
    if (customization.separatorStyle === 'none') return null;
    return (
      <div 
        className="divider my-3 text-gray-400" 
        style={{ 
          fontFamily: 'monospace',
          width: '100%',
          display: 'block',
          lineHeight: '1',
          letterSpacing: '0',
          overflow: 'hidden',
          position: 'relative',
          height: '1em'
        }}
      >
        <div style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          whiteSpace: 'nowrap',
          overflow: 'hidden'
        }}>
          {separatorChar.repeat(500)}
        </div>
      </div>
    );
  };
  
  return (
    <>
      {/* Kitchen Ticket Header */}
      <div className={`header ${headerAlignClass}`}>
        <div className="section-title">TICKET CUISINE</div>
      </div>

      <Separator />

      {/* Order Info - Conditional display based on kitchen customization */}
      {(customization.kitchenShowOrderNumber || customization.kitchenShowDate || customization.kitchenShowTime || customization.kitchenShowOrderType || customization.kitchenShowCashier) && (
        <>
          <div className="section">
            <div className="order-info">
              {customization.kitchenShowOrderNumber && (
                <div><strong>{customization.labelOrderNumber}:</strong> {formattedOrderNumber}</div>
              )}
              {customization.kitchenShowOrderType && (
                <div><strong>{customization.labelOrderType}:</strong> {typeLabel}</div>
              )}
              {customization.kitchenShowDate && (
                <div><strong>{customization.labelDate}:</strong> {formattedDate}</div>
              )}
              {customization.kitchenShowTime && (
                <div><strong>{customization.labelTime}:</strong> {formattedTime}</div>
              )}
              {customization.kitchenShowCashier && (
                <div><strong>{customization.labelCashier}:</strong> Admin</div>
              )}
            </div>
          </div>
          <Separator />
        </>
      )}

      {/* Order Lines - Conditional display */}
      {customization.kitchenShowProducts && order.lines.length > 0 && (
        <>
          <div className="section">
            {order.lines.map((line, index) => {
              const lineTotal = (line.unitPrice + line.modifiers.reduce((sum, m) => sum + m.priceAdjustment, 0)) * line.quantity;
              const productName = DirectPrinter.applyTextStyle(line.productName, customization.productNameStyle);
              return (
                <div key={index} className="order-line">
                  <div className="line-header">
                    {line.quantity}x {productName}
                    {customization.kitchenShowModifiers && line.variantSize && ` (${line.variantSize})`}
                  </div>
                  {customization.kitchenShowModifiers && line.modifiers.length > 0 && (
                    <div className="line-details">
                      {line.modifiers.map((mod, modIndex) => (
                        <div key={modIndex}>+ (S) {mod.optionName}</div>
                      ))}
                    </div>
                  )}
                  {customization.kitchenShowNotes && line.note && (
                    <div className="line-details" style={{ fontStyle: 'italic', fontWeight: 'bold' }}>
                      ⚠ Note: {line.note}
                    </div>
                  )}
                  {customization.kitchenShowProductPrices && (
                    <div className="text-right mt-1 text-sm font-semibold">
                      {formatCurrency(lineTotal, currency)}
                    </div>
                  )}
                  {index < order.lines.length - 1 && customization.separatorStyle !== 'none' && (
                    <div 
                      className="mt-2 text-gray-400" 
                      style={{ 
                        fontFamily: 'monospace',
                        width: '100%',
                        display: 'block',
                        lineHeight: '1',
                        letterSpacing: '0',
                        overflow: 'hidden',
                        position: 'relative'
                      }}
                    >
                      <div style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden'
                      }}>
                        {customization.separatorChar.repeat(500)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <Separator />
        </>
      )}

      <div className={`footer ${headerAlignClass}`}>
        <div>Bon appétit !</div>
      </div>
    </>
  );
}

function DisplayToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-3 bg-background rounded-lg">
      <span className="font-medium text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function LabelInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="text-xs sm:text-sm font-medium text-muted-foreground block mb-1">
        {label}
      </label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm"
      />
    </div>
  );
}

function getDefaultCustomization(): ReceiptCustomization {
  return {
    showOrderNumber: true,
    showDate: true,
    showTime: true,
    showOrderType: true,
    showPaymentMethod: true,
    showCashier: true,
    showProducts: true,
    showProductPrices: true,
    showModifiers: true,
    showNotes: true,
    showSubtotal: true,
    showDiscount: true,
    showTotal: true,
    showAmountReceived: true,
    showChange: true,
    orderNumberFormat: '{prefix}{number}',
    orderNumberPadding: 6,
    dateFormat: 'DD/MM/YYYY',
    timeFormat: 'HH:mm',
    headerAlignment: 'center',
    restaurantNameStyle: 'uppercase',
    productNameStyle: 'uppercase',
    separatorStyle: 'dashes',
    separatorChar: '─',
    fontSize: 'normal',
    fontFamily: 'monospace',
    labelOrderNumber: 'COMMANDE N°',
    labelDate: 'DATE',
    labelTime: 'HEURE',
    labelOrderType: 'TYPE',
    labelPaymentMethod: 'PAIEMENT',
    labelCashier: 'CAISSIER',
    labelSubtotal: 'SOUS-TOTAL',
    labelDiscount: 'REMISE',
    labelTotal: 'TOTAL',
    labelAmountReceived: 'MONTANT REÇU',
    labelChange: 'MONNAIE',
    labelThankYou: 'MERCI DE VOTRE VISITE !',
    kitchenShowOrderNumber: true,
    kitchenShowDate: true,
    kitchenShowTime: true,
    kitchenShowOrderType: true,
    kitchenShowCashier: true,
    kitchenShowProducts: true,
    kitchenShowProductPrices: false,
    kitchenShowModifiers: true,
    kitchenShowNotes: true,
  };
}