import { useState, useEffect } from 'react';
import { POSProvider, usePOS } from '@/contexts/POSContext';
import { useOrderReadyNotifications } from '@/hooks/useOrderReadyNotifications';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { MainNav } from '@/components/pos/MainNav';
import { OrderScreen } from '@/components/pos/OrderScreen';
import { OrdersScreen } from '@/components/pos/OrdersScreen';
import { ReportsScreen } from '@/components/pos/ReportsScreen';
import { SettingsScreen } from '@/components/pos/SettingsScreen';
import { LoginScreen } from '@/components/auth/LoginScreen';
import { SetupScreen } from '@/components/auth/SetupScreen';
import { LockScreen } from '@/components/auth/LockScreen';
import { GlobalVirtualKeyboard } from '@/components/ui/GlobalVirtualKeyboard';
import { GlobalNumericKeyboard } from '@/components/ui/GlobalNumericKeyboard';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

type View = 'order' | 'orders' | 'reports' | 'settings';

function POSApp() {
  const { isLoading, kioskMode, direction, settings } = usePOS();
  const { isAuthenticated, isLocked, isSetupRequired, canAccessView, user } = useAuth();
  const [activeView, setActiveView] = useState<View>('order');
  useOrderReadyNotifications();

  // Reset to accessible view if current view is not accessible
  useEffect(() => {
    if (isAuthenticated && !canAccessView(activeView)) {
      // Find first accessible view
      const views: View[] = ['order', 'orders', 'reports', 'settings'];
      const accessibleView = views.find(v => canAccessView(v));
      if (accessibleView) {
        setActiveView(accessibleView);
      }
    }
  }, [isAuthenticated, activeView, canAccessView]);

  // Show setup screen if no users exist
  if (isSetupRequired) {
    return (
      <>
        <SetupScreen />
        <GlobalVirtualKeyboard />
        <GlobalNumericKeyboard />
      </>
    );
  }

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return (
      <>
        <LoginScreen />
        <GlobalVirtualKeyboard />
        <GlobalNumericKeyboard />
      </>
    );
  }

  // Show lock screen if authenticated but locked
  if (isLocked) {
    return (
      <>
        <LockScreen />
        <GlobalVirtualKeyboard />
        <GlobalNumericKeyboard />
      </>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-lg font-medium text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  const uiScale = settings?.uiScale ?? 1.0;

  return (
    <div 
      className={cn(
        "min-h-screen bg-background",
        kioskMode && "kiosk-mode"
      )}
      dir={direction}
    >
      <div
        style={{
          transform: `scale(${uiScale})`,
          transformOrigin: 'top left',
          width: `${100 / uiScale}%`,
          height: `${100 / uiScale}%`,
        }}
        className="flex flex-col min-h-screen"
      >
        {/* Main Content */}
        <main className="flex-1 pb-20 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="h-full"
          >
            {activeView === 'order' && canAccessView('order') && <OrderScreen />}
            {activeView === 'orders' && canAccessView('orders') && <OrdersScreen />}
            {activeView === 'reports' && canAccessView('reports') && <ReportsScreen />}
            {activeView === 'settings' && canAccessView('settings') && <SettingsScreen />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Navigation */}
      <MainNav activeView={activeView} onViewChange={(v) => setActiveView(v as View)} />
      
        {/* Global Virtual Keyboard - Fixed at bottom */}
        <GlobalVirtualKeyboard />
        <GlobalNumericKeyboard />
      </div>
    </div>
  );
}

const Index = () => {
  return (
    <AuthProvider>
      <POSProvider>
        <POSApp />
      </POSProvider>
    </AuthProvider>
  );
};

export default Index;
