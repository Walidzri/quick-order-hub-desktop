import { usePOS } from '@/contexts/POSContext';
import { useAuth } from '@/contexts/AuthContext';
import { ShoppingCart, ClipboardList, BarChart3, Settings, Maximize2, Minimize2, LogOut, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  id: string;
  labelKey: string;
  icon: React.ReactNode;
}

const allNavItems: NavItem[] = [
  { id: 'order', labelKey: 'nav.newOrder', icon: <ShoppingCart className="w-6 h-6" /> },
  { id: 'orders', labelKey: 'nav.orders', icon: <ClipboardList className="w-6 h-6" /> },
  { id: 'reports', labelKey: 'nav.reports', icon: <BarChart3 className="w-6 h-6" /> },
  { id: 'settings', labelKey: 'nav.settings', icon: <Settings className="w-6 h-6" /> },
];

interface MainNavProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

export function MainNav({ activeView, onViewChange }: MainNavProps) {
  const { t, kioskMode, toggleKioskMode, settings } = usePOS();
  const { canAccessView, logout, lock, user } = useAuth();
  
  // Filter nav items based on permissions
  const navItems = allNavItems.filter(item => canAccessView(item.id));

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border shadow-lg safe-bottom">
      <div className="flex items-center justify-between px-1 sm:px-2">
        {/* Logo / Restaurant name / User name */}
        <div className="hidden md:flex items-center gap-3 px-4 min-w-[200px]">
          {settings?.logo && (
            <img 
              src={settings.logo} 
              alt="Logo" 
              className="w-20 h-20 object-contain"
            />
          )}
          <div className="flex flex-col">
            <span className="text-lg font-bold text-primary truncate">
              {settings?.restaurantName || 'FastFood POS'}
            </span>
            {user && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                <span className="text-xs text-muted-foreground truncate">
                  {user.name}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation items */}
        <div className="flex-1 flex items-center justify-center gap-0.5 sm:gap-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={cn(
                "flex flex-col items-center justify-center py-2 sm:py-3 px-2 sm:px-4 md:px-6 min-w-[60px] sm:min-w-[70px] md:min-w-[100px] transition-all duration-200",
                "hover:bg-accent/50 active:scale-95 rounded-xl",
                activeView === item.id && "bg-primary/10 text-primary"
              )}
            >
              <div className={cn(
                "p-1.5 sm:p-2 rounded-xl transition-colors",
                activeView === item.id && "bg-primary text-primary-foreground"
              )}>
                <div className="w-5 h-5 sm:w-6 sm:h-6">{item.icon}</div>
              </div>
              <span className="text-[10px] sm:text-xs mt-0.5 sm:mt-1 font-medium leading-tight">{t(item.labelKey)}</span>
            </button>
          ))}
        </div>

        {/* Kiosk toggle, Lock & Logout */}
        <div className="hidden md:flex items-center px-4 min-w-[200px] justify-end gap-2">
          <button
            onClick={toggleKioskMode}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200",
              "hover:bg-accent/50 active:scale-95",
              kioskMode && "bg-primary/10 text-primary"
            )}
            title={kioskMode ? t('settings.kioskOff') : t('settings.kioskOn')}
          >
            {kioskMode ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            <span className="text-sm font-medium">
              {kioskMode ? t('auth.exit') : t('auth.kiosk')}
            </span>
          </button>
          {user && (
            <>
              <button
                onClick={lock}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200",
                  "hover:bg-warning/10 active:scale-95 text-warning"
                )}
                title={t('auth.lock') || 'Verrouiller'}
              >
                <Lock className="w-5 h-5" />
              </button>
              <button
                onClick={logout}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200",
                  "hover:bg-destructive/10 active:scale-95 text-destructive"
                )}
                title={t('auth.logoutTitle')}
              >
                <LogOut className="w-5 h-5" />
                <span className="text-sm font-medium hidden lg:inline">
                  {t('auth.logout')}
                </span>
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
