import { useState, useEffect, useMemo, useCallback } from 'react';
import { usePOS } from '@/contexts/POSContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/i18n';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  ShoppingCart, 
  DollarSign, 
  Download,
  Calendar,
  Package,
  BarChart3,
  Users,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getDB, UserSession, User } from '@/lib/database';

type PeriodType = 'day' | 'week' | 'month' | 'year';

export function ReportsScreen() {
  const { orders, loadOrders, currency, t } = usePOS();
  const { users, hasPermission } = useAuth();
  const [period, setPeriod] = useState<PeriodType>('day');
  const [userSessions, setUserSessions] = useState<UserSession[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  const loadCashierStats = useCallback(async () => {
    try {
      const db = await getDB();
      // Check if userSessions store exists (for backward compatibility)
      if (db.objectStoreNames.contains('userSessions')) {
        const sessions = await db.getAll('userSessions');
        setUserSessions(sessions);
      } else {
        setUserSessions([]);
      }
      const usersList = await db.getAll('users');
      setAllUsers(usersList);
    } catch (error) {
      console.error('Failed to load cashier stats:', error);
      // Set empty arrays on error to prevent render issues
      setUserSessions([]);
      setAllUsers([]);
    }
  }, []);

  useEffect(() => {
    loadOrders();
    loadCashierStats();
  }, [loadOrders, loadCashierStats]);

  // Calculate period dates
  const now = new Date();
  let startDate: Date;
  let endDate: Date = new Date(now);
  endDate.setHours(23, 59, 59, 999);

  switch (period) {
    case 'day':
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'week':
      startDate = new Date(now);
      const dayOfWeek = startDate.getDay();
      const diff = startDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Monday
      startDate.setDate(diff);
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      startDate.setHours(0, 0, 0, 0);
      break;
    default:
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
  }

  // Filter orders by period
  const periodOrders = orders.filter(o => {
    const orderDate = new Date(o.createdAt);
    return orderDate >= startDate && orderDate <= endDate;
  });

  const paidOrders = periodOrders.filter(o => o.status === 'paid');
  const totalRevenue = paidOrders.reduce((sum, o) => sum + o.total, 0);
  const avgOrderValue = paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0;

  // Calculate cashier statistics
  interface CashierStats {
    user: User;
    totalWorkTime: number; // in milliseconds
    totalOrders: number;
    totalRevenue: number;
    avgOrderValue: number;
    sessions: UserSession[];
  }

  const cashierStats = useMemo(() => {
    const statsMap = new Map<string, CashierStats>();
    const cashiers = allUsers.filter(u => u.role === 'caissier');

    // Initialize stats for each cashier
    cashiers.forEach(cashier => {
      statsMap.set(cashier.id, {
        user: cashier,
        totalWorkTime: 0,
        totalOrders: 0,
        totalRevenue: 0,
        avgOrderValue: 0,
        sessions: [],
      });
    });

    // Calculate work time from sessions
    userSessions.forEach(session => {
      const sessionLoginDate = new Date(session.loginAt);
      if (sessionLoginDate >= startDate && sessionLoginDate <= endDate) {
        const stats = statsMap.get(session.userId);
        if (stats) {
          stats.sessions.push(session);
          
          // Calculate session duration
          const logoutTime = session.logoutAt ? new Date(session.logoutAt) : (session.isActive ? new Date() : new Date(session.loginAt));
          const loginTime = new Date(session.loginAt);
          const duration = logoutTime.getTime() - loginTime.getTime();
          stats.totalWorkTime += Math.max(0, duration);
        }
      }
    });

    // Calculate orders and revenue for each cashier
    paidOrders.forEach(order => {
      if (order.createdBy) {
        const stats = statsMap.get(order.createdBy);
        if (stats) {
          stats.totalOrders += 1;
          stats.totalRevenue += order.total;
        }
      }
    });

    // Calculate average order value
    statsMap.forEach((stats, _) => {
      stats.avgOrderValue = stats.totalOrders > 0 ? stats.totalRevenue / stats.totalOrders : 0;
    });

    return Array.from(statsMap.values()).filter(s => s.sessions.length > 0 || s.totalOrders > 0);
  }, [userSessions, paidOrders, allUsers, startDate, endDate]);

  const formatWorkTime = (ms: number): string => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}min`;
  };

  // Calculate top products
  interface ProductStats {
    name: string;
    totalQuantity: number;
    totalRevenue: number;
    orderCount: number;
  }

  const productStatsMap = new Map<string, ProductStats>();

  paidOrders.forEach(order => {
    order.lines.forEach(line => {
      const key = line.productName + (line.variantSize ? ` (${line.variantSize})` : '');
      
      if (!productStatsMap.has(key)) {
        productStatsMap.set(key, {
          name: key,
          totalQuantity: 0,
          totalRevenue: 0,
          orderCount: 0,
        });
      }

      const stats = productStatsMap.get(key)!;
      const lineTotal = (line.unitPrice + (line.modifiers?.reduce((sum, m) => sum + m.priceAdjustment, 0) || 0)) * line.quantity;
      
      stats.totalQuantity += line.quantity;
      stats.totalRevenue += lineTotal;
      stats.orderCount += 1;
    });
  });

  const topProducts = Array.from(productStatsMap.values())
    .sort((a, b) => b.totalQuantity - a.totalQuantity)
    .slice(0, 10); // Top 10

  const maxQuantity = topProducts.length > 0 ? topProducts[0].totalQuantity : 1;

  // Get period label
  const getPeriodLabel = (): string => {
    switch (period) {
      case 'day':
        return now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
      case 'week':
        const weekEnd = new Date(startDate);
        weekEnd.setDate(weekEnd.getDate() + 6);
        return `Semaine du ${startDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} au ${weekEnd.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`;
      case 'month':
        return now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      case 'year':
        return now.getFullYear().toString();
      default:
        return '';
    }
  };

  const stats = [
    {
      title: t('reports.totalOrders'),
      value: periodOrders.length,
      icon: <ShoppingCart className="w-6 h-6" />,
      color: 'bg-info/10 text-info',
    },
    {
      title: t('reports.paidOrders'),
      value: paidOrders.length,
      icon: <TrendingUp className="w-6 h-6" />,
      color: 'bg-success/10 text-success',
    },
    {
      title: t('reports.totalRevenue'),
      value: formatCurrency(totalRevenue, currency),
      icon: <DollarSign className="w-6 h-6" />,
      color: 'bg-primary/10 text-primary',
    },
    {
      title: t('reports.avgOrder'),
      value: formatCurrency(avgOrderValue, currency),
      icon: <Calendar className="w-6 h-6" />,
      color: 'bg-warning/10 text-warning',
    },
  ];

  const handleExportCSV = () => {
    const headers = ['Order Number', 'Date', 'Status', 'Items', 'Subtotal', 'Discount', 'Total', 'Payment Method'];
    const rows = periodOrders.map(o => [
      o.orderNumber,
      new Date(o.createdAt).toLocaleString(),
      o.status,
      o.lines.length,
      o.subtotal,
      o.discount,
      o.total,
      o.paymentMethod || '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(r => r.join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const periodSuffix = period === 'day' ? new Date().toISOString().split('T')[0] :
                         period === 'week' ? `week_${startDate.toISOString().split('T')[0]}` :
                         period === 'month' ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}` :
                         `${now.getFullYear()}`;
    a.download = `orders_${periodSuffix}.csv`;
    a.click();
  };

  return (
    <div className="h-full overflow-y-auto p-3 sm:p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">{t('reports.title')}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">{getPeriodLabel()}</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Period Selector */}
            <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
              {(['day', 'week', 'month', 'year'] as PeriodType[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    "px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors",
                    period === p
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {p === 'day' && 'Jour'}
                  {p === 'week' && 'Semaine'}
                  {p === 'month' && 'Mois'}
                  {p === 'year' && 'Année'}
                </button>
              ))}
            </div>
            <Button onClick={handleExportCSV} variant="outline" size="sm" className="text-xs sm:text-sm">
              <Download className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">{t('reports.exportCsv')}</span>
              <span className="sm:hidden">Export</span>
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card>
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">{stat.title}</p>
                      <p className="text-2xl sm:text-3xl font-bold mt-1">{stat.value}</p>
                    </div>
                    <div className={`p-2 sm:p-3 rounded-xl ${stat.color} flex-shrink-0`}>
                      {stat.icon}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Top Products */}
        {paidOrders.length > 0 && (
          <Card className="mb-4 sm:mb-6">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />
                {t('reports.mostOrdered')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              {topProducts.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Aucune donnée disponible
                </p>
              ) : (
                <div className="space-y-4">
                  {topProducts.map((product, index) => (
                    <motion.div
                      key={product.name}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="space-y-2"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                          <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs sm:text-sm">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm sm:text-base truncate">{product.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {product.orderCount} {product.orderCount > 1 ? t('reports.ordersPlural') : t('reports.orders')} • {formatCurrency(product.totalRevenue, currency)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                          <div className="text-right">
                            <div className="font-bold text-base sm:text-lg">{product.totalQuantity}</div>
                            <div className="text-xs text-muted-foreground">{t('reports.units')}</div>
                          </div>
                        </div>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(product.totalQuantity / maxQuantity) * 100}%` }}
                          transition={{ delay: index * 0.05 + 0.2, duration: 0.5 }}
                          className="h-full bg-primary rounded-full"
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Cashier Statistics */}
        {hasPermission('reports.view') && cashierStats.length > 0 && (
          <Card className="mb-4 sm:mb-6">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                {t('reports.cashierStats')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="space-y-4">
                {cashierStats
                  .sort((a, b) => b.totalRevenue - a.totalRevenue)
                  .map((stats, index) => (
                    <motion.div
                      key={stats.user.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="p-4 bg-muted/50 rounded-xl space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 flex-shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                            {stats.user.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-base sm:text-lg truncate">{stats.user.name}</div>
                            <div className="text-xs sm:text-sm text-muted-foreground truncate">
                              {stats.user.username}
                            </div>
                          </div>
                        </div>
                        <div className="text-left sm:text-right">
                          <div className="text-xl sm:text-2xl font-bold text-primary">
                            {formatCurrency(stats.totalRevenue, currency)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {stats.totalOrders} {stats.totalOrders > 1 ? t('reports.ordersPlural') : t('reports.orders')}
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pt-3 border-t border-border">
                        <div>
                          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {t('reports.workTime')}
                          </div>
                          <div className="font-semibold text-sm sm:text-base">{formatWorkTime(stats.totalWorkTime)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">
                            {t('reports.totalOrders')}
                          </div>
                          <div className="font-semibold text-sm sm:text-base">{stats.totalOrders}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">
                            {t('reports.avgOrder')}
                          </div>
                          <div className="font-semibold text-sm sm:text-base">{formatCurrency(stats.avgOrderValue, currency)}</div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Period Activity */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">
              {period === 'day' && t('reports.salesDay')}
              {period === 'week' && t('reports.salesWeek')}
              {period === 'month' && t('reports.salesMonth')}
              {period === 'year' && t('reports.salesYear')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <div className="space-y-4">
              {paidOrders.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  {t('reports.noSalesPeriod')}
                </p>
              ) : (
                paidOrders
                  .sort((a, b) => new Date(b.paidAt || b.createdAt).getTime() - new Date(a.paidAt || a.createdAt).getTime())
                  .map((order) => (
                  <div
                    key={order.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 bg-muted/50 rounded-lg gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm sm:text-base">{order.orderNumber}</div>
                      <div className="text-xs sm:text-sm text-muted-foreground">
                        {new Date(order.paidAt || order.createdAt).toLocaleString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          year: period === 'year' ? 'numeric' : undefined,
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                        {' • '}
                        {order.paymentMethod === 'cash' ? t('payment.cash') : t('payment.card')}
                      </div>
                    </div>
                    <div className="text-base sm:text-lg font-bold text-primary">
                      {formatCurrency(order.total, currency)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
