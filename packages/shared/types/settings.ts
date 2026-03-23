export interface ReceiptCustomization {
  // Display options
  showOrderNumber: boolean;
  showDate: boolean;
  showTime: boolean;
  showOrderType: boolean;
  showPaymentMethod: boolean;
  showCashier: boolean;
  showProducts: boolean;
  showProductPrices: boolean;
  showModifiers: boolean;
  showNotes: boolean;
  showSubtotal: boolean;
  showDiscount: boolean;
  showTotal: boolean;
  showItemCount: boolean; // Afficher le nombre d'articles à côté du total
  showAmountReceived: boolean;
  showChange: boolean;
  showLogo: boolean; // Afficher le logo sur les reçus
  logoSize: number; // Taille du logo en pourcentage de la largeur de l'imprimante (50 = 50%, par défaut 50% = 288px)

  // Formatting options
  dateFormat: string; // "DD/MM/YYYY", "MM/DD/YYYY", etc.
  timeFormat: string; // "HH:mm", "hh:mm A", etc.

  // Layout options
  headerAlignment: 'left' | 'center' | 'right';
  restaurantNameStyle: 'normal' | 'uppercase' | 'lowercase';
  productNameStyle: 'normal' | 'uppercase' | 'lowercase';
  separatorStyle: 'dashes' | 'dots' | 'equals' | 'line' | 'none';
  separatorChar: string; // Custom separator character

  // Text options
  fontSize: 'small' | 'normal' | 'large';
  fontFamily: 'monospace' | 'sans-serif' | 'serif';

  // Custom labels
  labelOrderNumber: string;
  labelDate: string;
  labelTime: string;
  labelOrderType: string;
  labelPaymentMethod: string;
  labelCashier: string;
  labelSubtotal: string;
  labelDiscount: string;
  labelTotal: string;
  labelItemCount: string; // Libellé pour le nombre d'articles
  labelAmountReceived: string;
  labelChange: string;
  labelThankYou: string;

  // Kitchen ticket specific
  labelKitchenTicket: string;
  labelBonAppetit: string;
  kitchenLabelItemCount: string; // Libellé personnalisé pour le nombre d'articles sur le ticket cuisine
  kitchenShowItemCount: boolean; // Afficher le nombre d'articles sur le ticket cuisine
  kitchenShowOrderNumber: boolean;
  kitchenShowDate: boolean;
  kitchenShowTime: boolean;
  kitchenShowOrderType: boolean;
  kitchenShowCashier: boolean;
  kitchenShowProducts: boolean;
  kitchenShowProductPrices: boolean;
  kitchenShowModifiers: boolean;
  kitchenShowNotes: boolean;
}

export interface SavedReceiptTemplate {
  id: string;
  name: string;
  customization: ReceiptCustomization;
}

export interface Settings {
  id: string;
  language: string;
  currency: string;
  restaurantName: string;
  address: string;
  phone: string;
  logo?: string;
  receiptHeader: string;
  receiptFooter: string;
  showAddress: boolean;
  showPhone: boolean;
  darkMode: boolean;
  primaryColor: string;
  kioskMode: boolean;
  uiScale?: number; // UI scale factor (0.5 to 2.0, default: 1.0)
  receiptCustomization?: ReceiptCustomization;
  /** Modèles de ticket sauvegardés (mode rapide) */
  savedReceiptTemplates?: SavedReceiptTemplate[];
  /** Configuration de la sauvegarde automatique */
  backupEnabled?: boolean; // Activer/désactiver la sauvegarde automatique
  backupScheduleType?: 'interval' | 'daily' | 'weekly' | 'monthly'; // Type de planification
  backupInterval?: number; // Intervalle en minutes (pour type 'interval')
  backupDailyTime?: string; // Heure au format HH:MM (pour type 'daily', ex: "02:00")
  backupWeeklyDay?: number; // Jour de la semaine 0-6 (0=dimanche, pour type 'weekly')
  backupWeeklyTime?: string; // Heure au format HH:MM (pour type 'weekly')
  backupMonthlyDay?: number; // Jour du mois 1-31 (pour type 'monthly')
  backupMonthlyTime?: string; // Heure au format HH:MM (pour type 'monthly')
  backupDirectory?: string; // Répertoire de sauvegarde
  /** Paiement par carte */
  cardPaymentEnabled?: boolean; // Activer/désactiver le paiement par carte (défaut: false)
  /** Synchronisation cloud */
  cloudSyncEnabled?: boolean; // Activer/désactiver la sync vers le VPS (défaut: false)
}

export interface NumberingCounter {
  id: string;
  date: string;
  counter: number;
}

/** Valeur par défaut partagée — source de vérité unique (remplace les 3 définitions dupliquées) */
export const defaultReceiptCustomization: ReceiptCustomization = {
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
  showItemCount: true,
  showAmountReceived: true,
  showChange: true,
  showLogo: true,
  logoSize: 50, // 50% de la largeur de l'imprimante (288px par défaut)
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
  labelItemCount: 'ARTICLES',
  labelAmountReceived: 'MONTANT REÇU',
  labelChange: 'MONNAIE',
  labelThankYou: 'MERCI DE VOTRE VISITE !',
  labelKitchenTicket: 'TICKET CUISINE',
  labelBonAppetit: 'Bon appétit !',
  kitchenLabelItemCount: 'ARTICLES',
  kitchenShowItemCount: true,
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
