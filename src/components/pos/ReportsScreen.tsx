import { useState, useEffect, useMemo, useCallback } from 'react';
import { usePOS } from '@/contexts/POSContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/i18n';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  DollarSign,
  Download,
  ShoppingBag,
  BarChart3,
  Users,
  Clock,
  PieChart as PieChartIcon,
  Minus,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { UserSession, User, Order } from '@shared/types';
import { api } from '@/services/api';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

type PeriodType = 'day' | 'week' | 'month' | 'year';

interface CashierStats {
  user: User;
  totalWorkTime: number;
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  sessions: UserSession[];
}

interface ProductStats {
  name: string;
  totalQuantity: number;
  totalRevenue: number;
  orderCount: number;
}

interface CategoryStats {
  name: string;
  value: number;
  quantity: number;
  color: string;
}

const CHART_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#6366f1',
];

function csvEscape(val: unknown): string {
  const str = String(val ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function ReportsScreen() {
  const { loadOrdersByDateRange, currency, t, language } = usePOS();
  const { hasPermission } = useAuth();
  const [period, setPeriod] = useState<PeriodType>('day');
  const [userSessions, setUserSessions] = useState<UserSession[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [periodOrders, setPeriodOrders] = useState<Order[]>([]);
  const [prevPeriodOrders, setPrevPeriodOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAllOrders, setShowAllOrders] = useState(false);

  const loadCashierStats = useCallback(async () => {
    try {
      const [sessions, usersList] = await Promise.all([
        api.get<UserSession[]>('/api/auth/sessions'),
        api.get<User[]>('/api/users'),
      ]);
      setUserSessions(sessions);
      setAllUsers(usersList);
    } catch (error) {
      console.error('Failed to load cashier stats:', error);
      setUserSessions([]);
      setAllUsers([]);
    }
  }, []);

  // Calculate period dates with useMemo for stability
  const { startDate, endDate, prevStartDate, prevEndDate } = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date = new Date(now);
    end.setHours(23, 59, 59, 999);
    let prevStart: Date;
    let prevEnd: Date;

    switch (period) {
      case 'day':
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
        prevStart = new Date(start);
        prevStart.setDate(prevStart.getDate() - 1);
        prevEnd = new Date(prevStart);
        prevEnd.setHours(23, 59, 59, 999);
        break;
      case 'week':
        start = new Date(now);
        const dayOfWeek = start.getDay();
        const diff = start.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        start.setDate(diff);
        start.setHours(0, 0, 0, 0);
        prevStart = new Date(start);
        prevStart.setDate(prevStart.getDate() - 7);
        prevEnd = new Date(prevStart);
        prevEnd.setDate(prevEnd.getDate() + 6);
        prevEnd.setHours(23, 59, 59, 999);
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        start.setHours(0, 0, 0, 0);
        prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        prevStart.setHours(0, 0, 0, 0);
        prevEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        prevEnd.setHours(23, 59, 59, 999);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        start.setHours(0, 0, 0, 0);
        prevStart = new Date(now.getFullYear() - 1, 0, 1);
        prevStart.setHours(0, 0, 0, 0);
        prevEnd = new Date(now.getFullYear() - 1, 11, 31);
        prevEnd.setHours(23, 59, 59, 999);
        break;
      default:
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
        prevStart = new Date(start);
        prevStart.setDate(prevStart.getDate() - 1);
        prevEnd = new Date(prevStart);
        prevEnd.setHours(23, 59, 59, 999);
    }

    return { startDate: start, endDate: end, prevStartDate: prevStart, prevEndDate: prevEnd };
  }, [period]);

  // Load orders when period changes - OPTIMIZED: only loads needed date ranges
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // Load both periods in parallel for better performance
        const [current, previous] = await Promise.all([
          loadOrdersByDateRange(startDate, endDate),
          loadOrdersByDateRange(prevStartDate, prevEndDate),
        ]);
        setPeriodOrders(current);
        setPrevPeriodOrders(previous);
      } catch (error) {
        console.error('Failed to load orders:', error);
        setPeriodOrders([]);
        setPrevPeriodOrders([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
    loadCashierStats();
    setShowAllOrders(false);
  }, [startDate, endDate, prevStartDate, prevEndDate, loadOrdersByDateRange, loadCashierStats]);

  const paidOrders = periodOrders.filter(o => o.status === 'paid');
  const prevPaidOrders = prevPeriodOrders.filter(o => o.status === 'paid');
  
  const totalRevenue = paidOrders.reduce((sum, o) => sum + o.total, 0);
  const prevTotalRevenue = prevPaidOrders.reduce((sum, o) => sum + o.total, 0);
  
  const avgOrderValue = paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0;
  const prevAvgOrderValue = prevPaidOrders.length > 0 ? prevTotalRevenue / prevPaidOrders.length : 0;

  // Calculate percentage changes
  const calcChange = (current: number, previous: number): number | null => {
    if (previous === 0) return current > 0 ? 100 : null;
    return ((current - previous) / previous) * 100;
  };

  const ordersChange = calcChange(periodOrders.length, prevPeriodOrders.length);
  const paidOrdersChange = calcChange(paidOrders.length, prevPaidOrders.length);
  const revenueChange = calcChange(totalRevenue, prevTotalRevenue);
  const avgChange = calcChange(avgOrderValue, prevAvgOrderValue);

  // Calculate cashier statistics
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

  // Calculate top products (memoized)
  const productStatsMap = useMemo(() => {
    const map = new Map<string, ProductStats>();
    paidOrders.forEach(order => {
      order.lines.forEach(line => {
        const key = line.productName + (line.variantSize ? ` (${line.variantSize})` : '');
        if (!map.has(key)) {
          map.set(key, { name: key, totalQuantity: 0, totalRevenue: 0, orderCount: 0 });
        }
        const stats = map.get(key)!;
        const lineTotal = (line.unitPrice + (line.modifiers?.reduce((sum, m) => sum + m.priceAdjustment, 0) || 0)) * line.quantity;
        stats.totalQuantity += line.quantity;
        stats.totalRevenue += lineTotal;
        stats.orderCount += 1;
      });
    });
    return map;
  }, [paidOrders]);

  const topProducts = Array.from(productStatsMap.values())
    .sort((a, b) => b.totalQuantity - a.totalQuantity)
    .slice(0, 10);

  const maxQuantity = topProducts.length > 0 ? topProducts[0].totalQuantity : 1;

  // Calculate category breakdown for donut chart (memoized)
  const { categories: allCategories } = usePOS();

  const { categoryData, totalCategoryRevenue } = useMemo(() => {
    const map = new Map<string, CategoryStats>();
    paidOrders.forEach(order => {
      order.lines.forEach(line => {
        const categoryId = line.categoryId || 'unknown';
        const category = allCategories.find(c => c.id === categoryId);
        const categoryName = category?.name || t('reports.otherCategory');
        if (!map.has(categoryId)) {
          map.set(categoryId, {
            name: categoryName,
            value: 0,
            quantity: 0,
            color: CHART_COLORS[map.size % CHART_COLORS.length],
          });
        }
        const stats = map.get(categoryId)!;
        const lineTotal = (line.unitPrice + (line.modifiers?.reduce((sum, m) => sum + m.priceAdjustment, 0) || 0)) * line.quantity;
        stats.value += lineTotal;
        stats.quantity += line.quantity;
      });
    });
    const data = Array.from(map.values()).sort((a, b) => b.value - a.value);
    return { categoryData: data, totalCategoryRevenue: data.reduce((sum, c) => sum + c.value, 0) };
  }, [paidOrders, allCategories, t]);

  // Get locale based on language
  const getLocale = (): string => {
    switch (language) {
      case 'en-US': return 'en-US';
      case 'ar-DZ': return 'ar-DZ';
      default: return 'fr-FR';
    }
  };

  // Get period label
  const getPeriodLabel = (): string => {
    const now = new Date();
    const locale = getLocale();
    switch (period) {
      case 'day':
        return now.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
      case 'week':
        const weekEnd = new Date(startDate);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const startStr = startDate.toLocaleDateString(locale, { day: 'numeric', month: 'long' });
        const endStr = weekEnd.toLocaleDateString(locale, { day: 'numeric', month: 'long' });
        return t('period.weekOf').replace('{start}', startStr).replace('{end}', endStr);
      case 'month':
        return now.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
      case 'year':
        return now.getFullYear().toString();
      default:
        return '';
    }
  };

  // Render comparison badge
  const renderChange = (change: number | null) => {
    if (change === null) return null;
    const isPositive = change > 0;
    const isZero = Math.abs(change) < 0.1;
    
    if (isZero) {
      return (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Minus className="w-3 h-3" />
          0%
        </span>
      );
    }
    
    return (
      <span className={cn(
        "flex items-center gap-1 text-xs font-medium",
        isPositive ? "text-success" : "text-destructive"
      )}>
        {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {isPositive ? '+' : ''}{change.toFixed(1)}%
      </span>
    );
  };

  const stats = [
    {
      title: t('reports.totalOrders'),
      value: periodOrders.length,
      icon: <ShoppingCart className="w-6 h-6" />,
      color: 'bg-info/10 text-info',
      change: ordersChange,
    },
    {
      title: t('reports.paidOrders'),
      value: paidOrders.length,
      icon: <TrendingUp className="w-6 h-6" />,
      color: 'bg-success/10 text-success',
      change: paidOrdersChange,
    },
    {
      title: t('reports.totalRevenue'),
      value: formatCurrency(totalRevenue, currency),
      icon: <DollarSign className="w-6 h-6" />,
      color: 'bg-primary/10 text-primary',
      change: revenueChange,
    },
    {
      title: t('reports.avgOrder'),
      value: formatCurrency(avgOrderValue, currency),
      icon: <ShoppingBag className="w-6 h-6" />,
      color: 'bg-warning/10 text-warning',
      change: avgChange,
    },
  ];

  const handleExportCSV = () => {
    const now = new Date();
    const headers = ['N° Commande', 'Date', 'Statut', 'Articles', 'Sous-total', 'Remise', 'Total', 'Paiement'];
    const rows = periodOrders.map(o => [
      o.orderNumber,
      new Date(o.createdAt).toLocaleString(getLocale()),
      o.status,
      o.lines.length,
      o.subtotal,
      o.discount,
      o.total,
      o.paymentMethod || '',
    ]);

    const csv = [
      headers.map(csvEscape).join(','),
      ...rows.map(r => r.map(csvEscape).join(',')),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const periodSuffix = period === 'day' ? now.toISOString().split('T')[0] :
                         period === 'week' ? `semaine_${startDate.toISOString().split('T')[0]}` :
                         period === 'month' ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}` :
                         `${now.getFullYear()}`;
    a.download = `commandes_${periodSuffix}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full overflow-y-auto p-3 sm:p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold">{t('reports.title')}</h1>
              {isLoading && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
            </div>
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
                  {p === 'day' && t('period.day')}
                  {p === 'week' && t('period.week')}
                  {p === 'month' && t('period.month')}
                  {p === 'year' && t('period.year')}
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
              transition={{ delay: Math.min(index * 0.1, 0.3) }}
            >
              <Card>
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">{stat.title}</p>
                      <p className="text-2xl sm:text-3xl font-bold mt-1">{stat.value}</p>
                      {/* Comparison with previous period */}
                      <div className="mt-1">
                        {renderChange(stat.change)}
                      </div>
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

        {/* Category Breakdown - Donut Chart */}
        {categoryData.length > 0 && (
          <Card className="mb-4 sm:mb-6">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <PieChartIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                {t('reports.categoryBreakdown')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Donut Chart */}
                <div className="h-[250px] sm:h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        nameKey="name"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value, currency)}
                        labelFormatter={(name: string) => name}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Category Legend & Stats */}
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {categoryData.map((category, index) => {
                    const percentage = totalCategoryRevenue > 0 
                      ? ((category.value / totalCategoryRevenue) * 100).toFixed(1) 
                      : '0';
                    return (
                      <motion.div
                        key={category.name}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(index * 0.05, 0.3) }}
                        className="flex items-center justify-between p-2 sm:p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                          <div 
                            className="w-3 h-3 sm:w-4 sm:h-4 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: category.color }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{category.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {category.quantity} {t('reports.units')}
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="font-bold text-sm">{formatCurrency(category.value, currency)}</div>
                          <div className="text-xs text-muted-foreground">{percentage}%</div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
              <div className="space-y-4">
                {topProducts.map((product, index) => (
                    <motion.div
                      key={product.name}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(index * 0.05, 0.3) }}
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
                          transition={{ delay: Math.min(index * 0.05, 0.25) + 0.05, duration: 0.5 }}
                          className="h-full bg-primary rounded-full"
                        />
                      </div>
                    </motion.div>
                ))}
              </div>
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
                      transition={{ delay: Math.min(index * 0.1, 0.3) }}
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
            {paidOrders.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                {t('reports.noSalesPeriod')}
              </p>
            ) : (() => {
              const sorted = [...paidOrders].sort((a, b) =>
                new Date(b.paidAt || b.createdAt).getTime() - new Date(a.paidAt || a.createdAt).getTime()
              );
              const PAGE = 50;
              const visible = showAllOrders ? sorted : sorted.slice(0, PAGE);
              const remaining = sorted.length - PAGE;
              return (
                <div className="space-y-2">
                  {visible.map((order) => (
                    <div
                      key={order.id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 bg-muted/50 rounded-lg gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm sm:text-base">{order.orderNumber}</div>
                        <div className="text-xs sm:text-sm text-muted-foreground">
                          {new Date(order.paidAt || order.createdAt).toLocaleString(getLocale(), {
                            day: 'numeric',
                            month: 'short',
                            year: period === 'year' ? 'numeric' : undefined,
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {' • '}
                          {order.paymentMethod === 'cash' ? t('payment.cash') : t('payment.card')}
                        </div>
                      </div>
                      <div className="text-base sm:text-lg font-bold text-primary">
                        {formatCurrency(order.total, currency)}
                      </div>
                    </div>
                  ))}
                  {!showAllOrders && sorted.length > PAGE && (
                    <Button
                      variant="outline"
                      className="w-full mt-2"
                      onClick={() => setShowAllOrders(true)}
                    >
                      Voir les {remaining} commandes suivantes
                    </Button>
                  )}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
