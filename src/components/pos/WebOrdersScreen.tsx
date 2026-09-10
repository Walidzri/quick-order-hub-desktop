import { useState, useEffect, useCallback, useRef } from 'react';
import { usePOS } from '@/contexts/POSContext';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import {
  Globe,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  ChefHat,
  Phone,
  MapPin,
  User,
  Loader2,
  RefreshCw,
  Package,
  Printer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/i18n';

interface WebOrder {
  id: string;
  orderNumber: string;
  status: string;
  type: string;
  lines: {
    id: string;
    productName: string;
    variantSize?: string;
    quantity: number;
    unitPrice: number;
    modifiers?: { optionName: string; priceAdjustment: number }[];
    note?: string;
  }[];
  subtotal: number;
  total: number;
  createdAt: string;
  updatedAt: string;
  deliveryAddress?: string;
  deliveryPhone?: string;
  deliveryCustomerName?: string;
  deliveryFee?: number;
  source?: string;
  web_order_id?: string;
  web_status?: string;
  web_customer_phone?: string;
  sentToKitchenAt?: string;
  kitchenReadyAt?: string;
}

type Tab = 'pending' | 'preparing' | 'ready' | 'delivery' | 'done';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'pending', label: 'En attente', icon: <Clock className="w-4 h-4" /> },
  { id: 'preparing', label: 'En préparation', icon: <ChefHat className="w-4 h-4" /> },
  { id: 'ready', label: 'Prêtes', icon: <CheckCircle className="w-4 h-4" /> },
  { id: 'delivery', label: 'En livraison', icon: <Truck className="w-4 h-4" /> },
  { id: 'done', label: 'Terminées', icon: <Package className="w-4 h-4" /> },
];

export function WebOrdersScreen() {
  const { currency, settings } = usePOS();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('pending');
  const [orders, setOrders] = useState<WebOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:3002/api/web-orders');
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch {
      // silently ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 5000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  // Keep a ref to loadOrders so WS handler always uses the latest version
  const loadOrdersRef = useRef(loadOrders);
  loadOrdersRef.current = loadOrders;

  // WebSocket for real-time updates
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let debounceTimer: ReturnType<typeof setTimeout>;

    function connect() {
      ws = new WebSocket('ws://127.0.0.1:3002/ws/events');
      ws.onmessage = (event) => {
        try {
          const { type } = JSON.parse(event.data);
          // Only reload on order-related events
          if (type && (type.startsWith('order:') || type.startsWith('web-order:'))) {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
              loadOrdersRef.current();
            }, 300);
          }
        } catch {
          // Reload anyway on parse error
          loadOrdersRef.current();
        }
      };
      ws.onclose = () => {
        reconnectTimer = setTimeout(connect, 3000);
      };
    }
    connect();

    return () => {
      clearTimeout(reconnectTimer);
      clearTimeout(debounceTimer);
      ws?.close();
    };
  }, []);

  const isPreparing = (o: WebOrder) =>
    o.status === 'sentToKitchen' && !o.kitchenReadyAt;
  const isReady = (o: WebOrder) =>
    (o.status === 'ready' || !!o.kitchenReadyAt) && o.status !== 'paid' && o.status !== 'cancelled' && o.web_status !== 'delivering';
  const isDelivering = (o: WebOrder) =>
    o.web_status === 'delivering';
  const isToday = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  };
  const isDone = (o: WebOrder) =>
    (o.status === 'paid' || o.status === 'cancelled') && isToday(o.createdAt);

  const filteredOrders = orders.filter((o) => {
    switch (activeTab) {
      case 'pending':    return o.status === 'pending';
      case 'preparing':  return isPreparing(o);
      case 'ready':      return isReady(o);
      case 'delivery':   return isDelivering(o);
      case 'done':       return isDone(o);
      default:           return false;
    }
  });

  const pendingCount = orders.filter((o) => o.status === 'pending').length;
  const preparingCount = orders.filter(isPreparing).length;
  const readyCount = orders.filter(isReady).length;
  const deliveryCount = orders.filter(isDelivering).length;

  const counts: Record<Tab, number> = {
    pending: pendingCount,
    preparing: preparingCount,
    ready: readyCount,
    delivery: deliveryCount,
    done: orders.filter(isDone).length,
  };

  async function handleAccept(id: string) {
    setActionLoading(id);
    try {
      const res = await fetch(`http://localhost:3002/api/web-orders/${id}/accept`, { method: 'PATCH' });
      if (res.ok) {
        toast({ title: 'Commande acceptée', description: 'En préparation' });
        await loadOrders();
      }
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(id: string) {
    const reason = prompt('Raison du refus (optionnel) :');
    if (reason === null) return;
    setActionLoading(id);
    try {
      const res = await fetch(`http://localhost:3002/api/web-orders/${id}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || undefined }),
      });
      if (res.ok) {
        toast({ title: 'Commande refusée' });
        await loadOrders();
      }
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleMarkDelivering(id: string, webOrderId: string) {
    setActionLoading(id);
    try {
      // Update local status + sync to Supabase
      const res = await fetch(`http://localhost:3002/api/orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ready' }),
      });
      if (res.ok) {
        // Also update web_status to 'delivering'
        await fetch(`http://localhost:3002/api/web-orders/${id}/set-delivering`, { method: 'PATCH' });
        toast({ title: 'En livraison' });
        await loadOrders();
      }
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleMarkDelivered(id: string) {
    setActionLoading(id);
    try {
      const res = await fetch(`http://localhost:3002/api/orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paid' }),
      });
      if (res.ok) {
        toast({ title: 'Commande livrée' });
        await loadOrders();
      }
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleMarkPickedUp(id: string) {
    setActionLoading(id);
    try {
      const res = await fetch(`http://localhost:3002/api/orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paid' }),
      });
      if (res.ok) {
        toast({ title: 'Commande récupérée par le client' });
        await loadOrders();
      }
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  }

  async function handlePrint(order: WebOrder) {
    try {
      const res = await fetch('http://localhost:3002/api/print/receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order }),
      });
      if (res.ok) {
        toast({ title: 'Ticket envoyé à l\'imprimante' });
      } else {
        toast({ title: 'Erreur d\'impression', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Imprimante non disponible', variant: 'destructive' });
    }
  }

  function elapsed(createdAt: string) {
    const ms = Math.max(0, Date.now() - new Date(createdAt).getTime());
    const m = Math.floor(ms / 60000);
    if (m < 1) return 'À l\'instant';
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    return `${h}h${m % 60}min`;
  }

  if (!settings?.webOrdersEnabled) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
        <Globe className="w-16 h-16 opacity-30" />
        <p className="text-lg">Commandes web désactivées</p>
        <p className="text-sm">Activez le service dans Paramètres → Données → Commandes Web</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-3">
          <Globe className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold">Commandes Web</h1>
        </div>
        <Button variant="outline" size="sm" onClick={loadOrders}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.icon}
            {tab.label}
            {counts[tab.id] > 0 && (
              <span
                className={cn(
                  'px-1.5 py-0.5 text-xs font-bold rounded-full',
                  tab.id === 'pending'
                    ? 'bg-red-500 text-white animate-pulse'
                    : tab.id === 'preparing'
                    ? 'bg-amber-500 text-white'
                    : tab.id === 'ready'
                    ? 'bg-green-500 text-white'
                    : tab.id === 'delivery'
                    ? 'bg-purple-500 text-white'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {counts[tab.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <CheckCircle className="w-12 h-12 opacity-30 mb-2" />
            <p>Aucune commande dans cet onglet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                tab={activeTab}
                currency={currency}
                elapsed={elapsed}
                actionLoading={actionLoading}
                onAccept={handleAccept}
                onReject={handleReject}
                onMarkDelivering={handleMarkDelivering}
                onMarkPickedUp={handleMarkPickedUp}
                onPrint={handlePrint}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function OrderCard({
  order,
  tab,
  currency,
  elapsed,
  actionLoading,
  onAccept,
  onReject,
  onMarkDelivering,
  onMarkPickedUp,
  onPrint,
}: {
  order: WebOrder;
  tab: Tab;
  currency: string;
  elapsed: (d: string) => string;
  actionLoading: string | null;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onMarkDelivering: (id: string, webOrderId: string) => void;
  onMarkPickedUp: (id: string) => void;
  onPrint: (order: WebOrder) => void;
}) {
  const isLoading = actionLoading === order.id;
  const typeLabel: Record<string, string> = {
    'takeaway': 'À emporter',
    'delivery': 'Livraison',
    'dine-in': 'Sur place',
  };

  return (
    <div
      className={cn(
        'bg-card border rounded-xl p-4 flex flex-col gap-3',
        tab === 'pending' && 'border-l-4 border-l-amber-500',
        tab === 'preparing' && 'border-l-4 border-l-blue-500',
        tab === 'ready' && 'border-l-4 border-l-green-500',
        tab === 'delivery' && 'border-l-4 border-l-purple-500',
        tab === 'done' && 'border-l-4 border-l-muted-foreground opacity-70'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-2xl font-black">N°{order.orderNumber}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{elapsed(order.createdAt)}</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-500/10 text-emerald-600">
            WEB
          </span>
          <span
            className={cn(
              'px-2 py-0.5 text-xs font-bold rounded-full',
              order.type === 'delivery' && 'bg-amber-500/10 text-amber-600',
              order.type === 'takeaway' && 'bg-sky-500/10 text-sky-600',
              order.type === 'dine-in' && 'bg-violet-500/10 text-violet-600'
            )}
          >
            {typeLabel[order.type] || order.type}
          </span>
        </div>
      </div>

      {/* Customer info */}
      {(order.deliveryCustomerName || order.web_customer_phone || order.deliveryPhone) && (
        <div className="bg-muted/50 rounded-lg p-2.5 text-sm space-y-1">
          {order.deliveryCustomerName && (
            <div className="flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{order.deliveryCustomerName}</span>
            </div>
          )}
          {(order.web_customer_phone || order.deliveryPhone) && (
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-muted-foreground" />
              <a href={`tel:${order.web_customer_phone || order.deliveryPhone}`} className="text-primary hover:underline">
                {order.web_customer_phone || order.deliveryPhone}
              </a>
            </div>
          )}
          {order.deliveryAddress && (
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.deliveryAddress)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline text-xs"
              >
                {order.deliveryAddress}
              </a>
            </div>
          )}
        </div>
      )}

      {/* Items */}
      <div className="space-y-1.5">
        {order.lines.map((line) => (
          <div key={line.id} className="flex gap-2 text-sm">
            <span className="font-bold text-primary min-w-[24px]">×{line.quantity}</span>
            <div className="flex-1">
              <div className="font-medium">{line.productName}</div>
              {line.variantSize && (
                <div className="text-xs text-muted-foreground">{line.variantSize}</div>
              )}
              {line.modifiers && line.modifiers.length > 0 && (
                <div className="text-xs text-sky-500">
                  + {line.modifiers.map((m) => m.optionName).join(', ')}
                </div>
              )}
              {line.note && (
                <div className="text-xs text-amber-500">📝 {line.note}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="flex justify-between items-center pt-2 border-t text-sm">
        <span className="text-muted-foreground">
          {order.lines.reduce((s, l) => s + l.quantity, 0)} article(s)
        </span>
        <span className="font-bold text-lg">
          {formatCurrency(order.total, currency)}
        </span>
      </div>

      {/* Actions */}
      {tab === 'pending' && (
        <div className="flex gap-2">
          <Button
            className="flex-1 bg-green-600 hover:bg-green-700"
            onClick={() => onAccept(order.id)}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
            Accepter
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={() => onReject(order.id)}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
            Refuser
          </Button>
        </div>
      )}

      {tab === 'ready' && order.type === 'delivery' && (
        <Button
          className="w-full bg-purple-600 hover:bg-purple-700"
          onClick={() => onMarkDelivering(order.id, order.web_order_id || '')}
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4 mr-2" />}
          En livraison
        </Button>
      )}

      {tab === 'ready' && order.type === 'takeaway' && (
        <div className="flex gap-2">
          <Button
            className="flex-1 bg-green-600 hover:bg-green-700"
            onClick={() => onMarkPickedUp(order.id)}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4 mr-2" />}
            Client a récupéré
          </Button>
          <Button variant="outline" size="icon" onClick={() => onPrint(order)} title="Imprimer le ticket">
            <Printer className="w-4 h-4" />
          </Button>
        </div>
      )}

      {tab === 'preparing' && (
        <Button variant="outline" className="w-full" onClick={() => onPrint(order)}>
          <Printer className="w-4 h-4 mr-2" />
          Imprimer le ticket
        </Button>
      )}

      {tab === 'delivery' && (
        <div className="flex items-center gap-2">
          <p className="flex-1 text-sm text-purple-600 italic">Le livreur confirmera la réception</p>
          <Button variant="outline" size="icon" onClick={() => onPrint(order)} title="Imprimer le ticket">
            <Printer className="w-4 h-4" />
          </Button>
        </div>
      )}

      {tab === 'done' && (
        <Button variant="outline" className="w-full" onClick={() => onPrint(order)}>
          <Printer className="w-4 h-4 mr-2" />
          Imprimer le ticket
        </Button>
      )}
    </div>
  );
}
