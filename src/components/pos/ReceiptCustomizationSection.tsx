import { useState, useMemo } from 'react';
import { Settings, ReceiptCustomization, Order } from '@/lib/database';
import { motion } from 'framer-motion';
import { 
  Eye, 
  AlignLeft, 
  AlignCenter, 
  AlignRight,
  FileText,
  SeparatorHorizontal,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useDialog } from '@/hooks/use-dialog';
import { TouchTextarea } from '@/components/ui/touch-textarea';
import { NumericInput } from '@/components/ui/numeric-input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
  const { showDialog, showAlert, DialogComponent } = useDialog();
  const customization = useMemo(() => {
    return settings.receiptCustomization || DirectPrinter.getDefaultCustomization();
  }, [settings.receiptCustomization]);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    receipt: false,
    kitchen: false,
    receiptDisplay: false,
    receiptFormat: false,
    receiptLayout: false,
    receiptLabels: false,
    kitchenDisplay: false,
    kitchenFormat: false,
    kitchenLayout: false,
    kitchenLabels: false,
  });
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };
  
  const sampleOrderNumber = '#001';

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

        <div className="flex flex-col lg:flex-row gap-6 w-full">
          <div className="lg:w-[50%] lg:min-w-[600px] space-y-4 sm:space-y-6">
            {/* Général (toujours visible) */}
            <div className="p-4 bg-muted/50 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-base">Paramètres généraux</h3>
              </div>
              <div>
                <label className="text-xs sm:text-sm font-medium text-muted-foreground">Message d&apos;en-tête</label>
                <TouchTextarea value={settings.receiptHeader} onChange={(v) => updateSettings({ receiptHeader: v })} className="mt-1" rows={2} placeholder="Message d'en-tête" showQuickSuggestions={false} />
              </div>
              <div>
                <label className="text-xs sm:text-sm font-medium text-muted-foreground">Message de pied de page</label>
                <TouchTextarea value={settings.receiptFooter} onChange={(v) => updateSettings({ receiptFooter: v })} className="mt-1" rows={2} placeholder="Message de pied de page" showQuickSuggestions={false} />
              </div>
              <div className="flex items-center justify-between p-3 bg-background rounded-lg">
                <span className="font-medium text-sm">Afficher l&apos;adresse</span>
                <Switch checked={settings.showAddress} onCheckedChange={(c) => updateSettings({ showAddress: c })} />
              </div>
              <div className="flex items-center justify-between p-3 bg-background rounded-lg">
                <span className="font-medium text-sm">Afficher le téléphone</span>
                <Switch checked={settings.showPhone} onCheckedChange={(c) => updateSettings({ showPhone: c })} />
              </div>
            </div>

            {/* Reçu Client Section */}
            <Collapsible open={expandedSections.receipt} onOpenChange={() => toggleSection('receipt')}>
                  <CollapsibleTrigger className="w-full flex items-center justify-between p-4 bg-primary/10 border-2 border-primary/20 rounded-xl hover:bg-primary/15 transition-colors">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-primary" />
                      <h3 className="font-semibold text-base text-primary">Reçu client</h3>
                    </div>
                    {expandedSections.receipt ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-4 space-y-4">
                    {/* Options d'affichage - Reçu */}
                    <Collapsible open={expandedSections.receiptDisplay} onOpenChange={() => toggleSection('receiptDisplay')}>
                      <CollapsibleTrigger className="w-full flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/40 transition-colors">
                        <h4 className="font-medium text-sm">Éléments à afficher</h4>
                        {expandedSections.receiptDisplay ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-3 space-y-3">
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

                    {/* Formatage - Reçu */}
                    <Collapsible open={expandedSections.receiptFormat} onOpenChange={() => toggleSection('receiptFormat')}>
                      <CollapsibleTrigger className="w-full flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/40 transition-colors">
                        <h4 className="font-medium text-sm">Formatage</h4>
                        {expandedSections.receiptFormat ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-3 space-y-4">
                      <div>
                        <label className="text-xs sm:text-sm font-medium text-muted-foreground block mb-2">Padding du numéro (zéros)</label>
                        <NumericInput value={customization.orderNumberPadding} onChange={(value) => updateCustomization({ orderNumberPadding: parseInt(value) || 6 })} min={0} max={20} className="w-32" allowDecimal={false} />
                      </div>
                      <div>
                        <label className="text-xs sm:text-sm font-medium text-muted-foreground block mb-2">Format de date</label>
                        <Select value={customization.dateFormat} onValueChange={(v) => updateCustomization({ dateFormat: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                            <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                            <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                            <SelectItem value="DD-MM-YYYY">DD-MM-YYYY</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs sm:text-sm font-medium text-muted-foreground block mb-2">Format d&apos;heure</label>
                        <Select value={customization.timeFormat} onValueChange={(v) => updateCustomization({ timeFormat: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="HH:mm">24h (HH:mm)</SelectItem>
                            <SelectItem value="hh:mm A">12h (hh:mm AM/PM)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Mise en page - Reçu */}
                    <Collapsible open={expandedSections.receiptLayout} onOpenChange={() => toggleSection('receiptLayout')}>
                      <CollapsibleTrigger className="w-full flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/40 transition-colors">
                        <h4 className="font-medium text-sm">Mise en page</h4>
                        {expandedSections.receiptLayout ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-3 space-y-4">
                      <div>
                        <label className="text-xs sm:text-sm font-medium text-muted-foreground block mb-2">Alignement de l&apos;en-tête</label>
                        <div className="flex gap-2">
                          <Button variant={customization.headerAlignment === 'left' ? 'default' : 'outline'} size="sm" className="flex-1" onClick={() => updateCustomization({ headerAlignment: 'left' })}><AlignLeft className="w-4 h-4 mr-2" />Gauche</Button>
                          <Button variant={customization.headerAlignment === 'center' ? 'default' : 'outline'} size="sm" className="flex-1" onClick={() => updateCustomization({ headerAlignment: 'center' })}><AlignCenter className="w-4 h-4 mr-2" />Centre</Button>
                          <Button variant={customization.headerAlignment === 'right' ? 'default' : 'outline'} size="sm" className="flex-1" onClick={() => updateCustomization({ headerAlignment: 'right' })}><AlignRight className="w-4 h-4 mr-2" />Droite</Button>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs sm:text-sm font-medium text-muted-foreground block mb-2">Style du nom du restaurant</label>
                        <Select value={customization.restaurantNameStyle} onValueChange={(v: 'normal'|'uppercase'|'lowercase') => updateCustomization({ restaurantNameStyle: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="uppercase">MAJUSCULES</SelectItem>
                            <SelectItem value="lowercase">minuscules</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs sm:text-sm font-medium text-muted-foreground block mb-2">Style du nom des produits</label>
                        <Select value={customization.productNameStyle} onValueChange={(v: 'normal'|'uppercase'|'lowercase') => updateCustomization({ productNameStyle: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="uppercase">MAJUSCULES</SelectItem>
                            <SelectItem value="lowercase">minuscules</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs sm:text-sm font-medium text-muted-foreground block mb-2">Style des séparateurs</label>
                        <Select value={customization.separatorStyle} onValueChange={(v: 'dashes'|'dots'|'equals'|'line'|'none') => {
                          const chars: Record<string, string> = { dashes: '─', dots: '·', equals: '═', line: '─', none: ' ' };
                          updateCustomization({ separatorStyle: v, separatorChar: chars[v] });
                        }}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="dashes">Tirets (─)</SelectItem>
                            <SelectItem value="dots">Points (·)</SelectItem>
                            <SelectItem value="equals">Double traits (═)</SelectItem>
                            <SelectItem value="line">Ligne simple</SelectItem>
                            <SelectItem value="none">Aucun</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {customization.separatorStyle !== 'none' && (
                        <div>
                          <label className="text-xs sm:text-sm font-medium text-muted-foreground block mb-2">Caractère de séparation personnalisé</label>
                          <Input value={customization.separatorChar} onChange={(e) => updateCustomization({ separatorChar: e.target.value || '─' })} maxLength={1} className="w-32 font-mono text-2xl text-center" placeholder="─" />
                        </div>
                      )}
                      <div>
                        <label className="text-xs sm:text-sm font-medium text-muted-foreground block mb-2">Taille de police</label>
                        <Select value={customization.fontSize} onValueChange={(v: 'small'|'normal'|'large') => updateCustomization({ fontSize: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="small">Petite</SelectItem>
                            <SelectItem value="normal">Normale</SelectItem>
                            <SelectItem value="large">Grande</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs sm:text-sm font-medium text-muted-foreground block mb-2">Police de caractères</label>
                        <Select value={customization.fontFamily} onValueChange={(v: 'monospace'|'sans-serif'|'serif') => updateCustomization({ fontFamily: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="monospace">Monospace (Courier)</SelectItem>
                            <SelectItem value="sans-serif">Sans-serif (Arial)</SelectItem>
                            <SelectItem value="serif">Serif (Times)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Libellés - Reçu */}
                    <Collapsible open={expandedSections.receiptLabels} onOpenChange={() => toggleSection('receiptLabels')}>
                      <CollapsibleTrigger className="w-full flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/40 transition-colors">
                        <h4 className="font-medium text-sm">Libellés personnalisés</h4>
                        {expandedSections.receiptLabels ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-3 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                      </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </CollapsibleContent>
                </Collapsible>

                {/* Ticket Cuisine Section */}
                <Collapsible open={expandedSections.kitchen} onOpenChange={() => toggleSection('kitchen')}>
                  <CollapsibleTrigger className="w-full flex items-center justify-between p-4 bg-orange-500/10 border-2 border-orange-500/20 rounded-xl hover:bg-orange-500/15 transition-colors">
                    <div className="flex items-center gap-2">
                      <SeparatorHorizontal className="w-5 h-5 text-orange-600" />
                      <h3 className="font-semibold text-base text-orange-600">Ticket Cuisine</h3>
                    </div>
                    {expandedSections.kitchen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-4 space-y-4">
                    {/* Options d'affichage - Cuisine */}
                    <Collapsible open={expandedSections.kitchenDisplay} onOpenChange={() => toggleSection('kitchenDisplay')}>
                      <CollapsibleTrigger className="w-full flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/40 transition-colors">
                        <h4 className="font-medium text-sm">Éléments à afficher</h4>
                        {expandedSections.kitchenDisplay ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-3 space-y-3">
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

                    {/* Formatage - Cuisine */}
                    <Collapsible open={expandedSections.kitchenFormat} onOpenChange={() => toggleSection('kitchenFormat')}>
                      <CollapsibleTrigger className="w-full flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/40 transition-colors">
                        <h4 className="font-medium text-sm">Formatage</h4>
                        {expandedSections.kitchenFormat ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-3 space-y-4">
                      <div>
                        <label className="text-xs sm:text-sm font-medium text-muted-foreground block mb-2">Format de date</label>
                        <Select value={customization.dateFormat} onValueChange={(v) => updateCustomization({ dateFormat: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                            <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                            <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                            <SelectItem value="DD-MM-YYYY">DD-MM-YYYY</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs sm:text-sm font-medium text-muted-foreground block mb-2">Format d&apos;heure</label>
                        <Select value={customization.timeFormat} onValueChange={(v) => updateCustomization({ timeFormat: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="HH:mm">24h (HH:mm)</SelectItem>
                            <SelectItem value="hh:mm A">12h (hh:mm AM/PM)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Mise en page - Cuisine */}
                    <Collapsible open={expandedSections.kitchenLayout} onOpenChange={() => toggleSection('kitchenLayout')}>
                      <CollapsibleTrigger className="w-full flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/40 transition-colors">
                        <h4 className="font-medium text-sm">Mise en page</h4>
                        {expandedSections.kitchenLayout ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-3 space-y-4">
                      <div>
                        <label className="text-xs sm:text-sm font-medium text-muted-foreground block mb-2">Alignement de l&apos;en-tête</label>
                        <div className="flex gap-2">
                          <Button variant={customization.headerAlignment === 'left' ? 'default' : 'outline'} size="sm" className="flex-1" onClick={() => updateCustomization({ headerAlignment: 'left' })}><AlignLeft className="w-4 h-4 mr-2" />Gauche</Button>
                          <Button variant={customization.headerAlignment === 'center' ? 'default' : 'outline'} size="sm" className="flex-1" onClick={() => updateCustomization({ headerAlignment: 'center' })}><AlignCenter className="w-4 h-4 mr-2" />Centre</Button>
                          <Button variant={customization.headerAlignment === 'right' ? 'default' : 'outline'} size="sm" className="flex-1" onClick={() => updateCustomization({ headerAlignment: 'right' })}><AlignRight className="w-4 h-4 mr-2" />Droite</Button>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs sm:text-sm font-medium text-muted-foreground block mb-2">Style du nom des produits</label>
                        <Select value={customization.productNameStyle} onValueChange={(v: 'normal'|'uppercase'|'lowercase') => updateCustomization({ productNameStyle: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="uppercase">MAJUSCULES</SelectItem>
                            <SelectItem value="lowercase">minuscules</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs sm:text-sm font-medium text-muted-foreground block mb-2">Style des séparateurs</label>
                        <Select value={customization.separatorStyle} onValueChange={(v: 'dashes'|'dots'|'equals'|'line'|'none') => {
                          const chars: Record<string, string> = { dashes: '─', dots: '·', equals: '═', line: '─', none: ' ' };
                          updateCustomization({ separatorStyle: v, separatorChar: chars[v] });
                        }}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="dashes">Tirets (─)</SelectItem>
                            <SelectItem value="dots">Points (·)</SelectItem>
                            <SelectItem value="equals">Double traits (═)</SelectItem>
                            <SelectItem value="line">Ligne simple</SelectItem>
                            <SelectItem value="none">Aucun</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {customization.separatorStyle !== 'none' && (
                        <div>
                          <label className="text-xs sm:text-sm font-medium text-muted-foreground block mb-2">Caractère de séparation personnalisé</label>
                          <Input value={customization.separatorChar} onChange={(e) => updateCustomization({ separatorChar: e.target.value || '─' })} maxLength={1} className="w-32 font-mono text-2xl text-center" placeholder="─" />
                        </div>
                      )}
                      <div>
                        <label className="text-xs sm:text-sm font-medium text-muted-foreground block mb-2">Taille de police</label>
                        <Select value={customization.fontSize} onValueChange={(v: 'small'|'normal'|'large') => updateCustomization({ fontSize: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="small">Petite</SelectItem>
                            <SelectItem value="normal">Normale</SelectItem>
                            <SelectItem value="large">Grande</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs sm:text-sm font-medium text-muted-foreground block mb-2">Police de caractères</label>
                        <Select value={customization.fontFamily} onValueChange={(v: 'monospace'|'sans-serif'|'serif') => updateCustomization({ fontFamily: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="monospace">Monospace (Courier)</SelectItem>
                            <SelectItem value="sans-serif">Sans-serif (Arial)</SelectItem>
                            <SelectItem value="serif">Serif (Times)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Libellés - Cuisine */}
                    <Collapsible open={expandedSections.kitchenLabels} onOpenChange={() => toggleSection('kitchenLabels')}>
                      <CollapsibleTrigger className="w-full flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/40 transition-colors">
                        <h4 className="font-medium text-sm">Libellés personnalisés</h4>
                        {expandedSections.kitchenLabels ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-3 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <LabelInput label="Titre du ticket" value={customization.labelKitchenTicket} onChange={(v) => updateCustomization({ labelKitchenTicket: v })} />
                        <LabelInput label="Message de fin" value={customization.labelBonAppetit} onChange={(v) => updateCustomization({ labelBonAppetit: v })} />
                        <LabelInput label="Numéro de commande" value={customization.labelOrderNumber} onChange={(v) => updateCustomization({ labelOrderNumber: v })} />
                        <LabelInput label="Date" value={customization.labelDate} onChange={(v) => updateCustomization({ labelDate: v })} />
                        <LabelInput label="Heure" value={customization.labelTime} onChange={(v) => updateCustomization({ labelTime: v })} />
                        <LabelInput label="Type de commande" value={customization.labelOrderType} onChange={(v) => updateCustomization({ labelOrderType: v })} />
                        <LabelInput label="Caissier" value={customization.labelCashier} onChange={(v) => updateCustomization({ labelCashier: v })} />
                      </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </CollapsibleContent>
                </Collapsible>

            <div className="pt-4 border-t border-border">
              <Button variant="outline" className="w-full" onClick={async () => {
                const ok = await showDialog({ title: 'Réinitialiser', description: t('receipt.resetConfirm'), confirmText: 'Confirmer', cancelText: 'Annuler', variant: 'default' });
                if (ok) await updateSettings({ receiptCustomization: DirectPrinter.getDefaultCustomization() });
              }}>
                {t('receipt.resetCustomizations')}
              </Button>
            </div>
          </div>

          {/* Preview - droite (desktop) */}
          <div className="hidden lg:block w-[50%] lg:min-w-[600px] flex-shrink-0">
            <div className="sticky top-4">
              <div className="bg-background rounded-xl p-4 border border-border">
                <h3 className="font-semibold text-base mb-4 flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  {t('receipt.preview')}
                </h3>
                <Tabs defaultValue="receipt" className="w-full">
                  <TabsList className="w-full mb-4">
                    <TabsTrigger value="receipt" className="flex-1">{t('print.receipt')}</TabsTrigger>
                    <TabsTrigger value="kitchen" className="flex-1">{t('print.kitchenTicket')}</TabsTrigger>
                  </TabsList>
                  <TabsContent value="receipt" className="mt-0">
                    <div className="bg-white text-black p-6 rounded-lg shadow-inner overflow-auto max-h-[calc(100vh-300px)] max-w-full" style={{ fontFamily: customization.fontFamily === 'monospace' ? 'Courier New, monospace' : customization.fontFamily === 'sans-serif' ? 'Arial, sans-serif' : 'Times New Roman, serif', fontSize: customization.fontSize === 'small' ? '11px' : customization.fontSize === 'large' ? '15px' : '13px', lineHeight: '1.5', letterSpacing: '0.5px', minWidth: '300px' }}>
                      {renderReceiptHTML({ order: sampleOrder, settings, currency, customization, cashierName: 'Admin', amountReceived: sampleOrder.paymentMethod === 'cash' ? sampleOrder.total + 5 : undefined, change: sampleOrder.paymentMethod === 'cash' ? 5 : undefined, t, type: 'receipt' })}
                    </div>
                  </TabsContent>
                  <TabsContent value="kitchen" className="mt-0">
                    <div className="bg-white text-black p-6 rounded-lg shadow-inner overflow-auto max-h-[calc(100vh-300px)] max-w-full" style={{ fontFamily: customization.fontFamily === 'monospace' ? 'Courier New, monospace' : customization.fontFamily === 'sans-serif' ? 'Arial, sans-serif' : 'Times New Roman, serif', fontSize: customization.fontSize === 'small' ? '11px' : customization.fontSize === 'large' ? '15px' : '13px', lineHeight: '1.5', letterSpacing: '0.5px', minWidth: '300px' }}>
                      {renderReceiptHTML({ order: sampleOrder, settings, currency, customization, cashierName: 'Admin', t, type: 'kitchen' })}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>
        </div>

        {/* Preview mobile - en dessous */}
        <div className="lg:hidden mt-6">
          <div className="bg-background rounded-xl p-4 border border-border">
            <h3 className="font-semibold text-base mb-4 flex items-center gap-2"><Eye className="w-5 h-5" />{t('receipt.preview')}</h3>
            <Tabs defaultValue="receipt" className="w-full">
              <TabsList className="w-full mb-4">
                <TabsTrigger value="receipt" className="flex-1">{t('print.receipt')}</TabsTrigger>
                <TabsTrigger value="kitchen" className="flex-1">{t('print.kitchenTicket')}</TabsTrigger>
              </TabsList>
              <TabsContent value="receipt" className="mt-0">
                <div className="bg-white text-black p-6 rounded-lg shadow-inner overflow-auto max-h-96 max-w-full" style={{ fontFamily: customization.fontFamily === 'monospace' ? 'Courier New, monospace' : customization.fontFamily === 'sans-serif' ? 'Arial, sans-serif' : 'Times New Roman, serif', fontSize: customization.fontSize === 'small' ? '11px' : customization.fontSize === 'large' ? '15px' : '13px', lineHeight: '1.5', letterSpacing: '0.5px', minWidth: '300px' }}>
                  {renderReceiptHTML({ order: sampleOrder, settings, currency, customization, cashierName: 'Admin', amountReceived: sampleOrder.paymentMethod === 'cash' ? sampleOrder.total + 5 : undefined, change: sampleOrder.paymentMethod === 'cash' ? 5 : undefined, t, type: 'receipt' })}
                </div>
              </TabsContent>
              <TabsContent value="kitchen" className="mt-0">
                <div className="bg-white text-black p-6 rounded-lg shadow-inner overflow-auto max-h-96 max-w-full" style={{ fontFamily: customization.fontFamily === 'monospace' ? 'Courier New, monospace' : customization.fontFamily === 'sans-serif' ? 'Arial, sans-serif' : 'Times New Roman, serif', fontSize: customization.fontSize === 'small' ? '11px' : customization.fontSize === 'large' ? '15px' : '13px', lineHeight: '1.5', letterSpacing: '0.5px', minWidth: '300px' }}>
                  {renderReceiptHTML({ order: sampleOrder, settings, currency, customization, cashierName: 'Admin', t, type: 'kitchen' })}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </motion.div>
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
