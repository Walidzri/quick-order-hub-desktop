import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, Lock, User as UserIcon, KeyRound, ChevronLeft, AlertCircle, Maximize2, Minimize2, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TouchInput } from '@/components/ui/touch-input';
import { useAuth } from '@/contexts/AuthContext';
import { usePOS } from '@/contexts/POSContext';
import { cn } from '@/lib/utils';
import { User } from '@/lib/database';
import { LANGUAGES, Language } from '@/lib/i18n';

type LoginMode = 'select' | 'password' | 'pin';

export function LoginScreen() {
  const { login, loginWithPin, users, loadUsers, getRemainingLockoutTime } = useAuth();
  const { kioskMode, toggleKioskMode, settings, updateSettings, t } = usePOS();
  const [mode, setMode] = useState<LoginMode>('select');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lockoutTime, setLockoutTime] = useState(0);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Check lockout timer
  useEffect(() => {
    if (selectedUser) {
      const checkLockout = async () => {
        const remaining = await getRemainingLockoutTime(selectedUser.id);
        setLockoutTime(remaining);
      };
      checkLockout();

      if (lockoutTime > 0) {
        const interval = setInterval(async () => {
          const remaining = await getRemainingLockoutTime(selectedUser.id);
          setLockoutTime(remaining);
        }, 1000);
        return () => clearInterval(interval);
      }
    }
  }, [selectedUser, lockoutTime, getRemainingLockoutTime]);

  const handleSelectUser = (user: User) => {
    setSelectedUser(user);
    setError('');
    setPin('');
    setPassword('');
    
    // Pour les non-admin, utiliser uniquement le PIN
    // Pour l'admin avec PIN, proposer le PIN d'abord, sinon le mot de passe
    if (user.role !== 'admin') {
      // Non-admin : toujours PIN
      setMode('pin');
    } else if (user.pin) {
      // Admin avec PIN : mode PIN d'abord
      setMode('pin');
    } else {
      // Admin sans PIN : mot de passe
      setMode('password');
    }
  };

  const handleBack = () => {
    setMode('select');
    setSelectedUser(null);
    setPassword('');
    setPin('');
    setError('');
    setLockoutTime(0);
  };

  const handlePasswordSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!password || isLoading) return;

    setError('');
    setIsLoading(true);

    try {
      const usernameToUse = selectedUser?.username || username;
      const result = await login(usernameToUse, password);
      if (!result.success) {
        setError(result.message || 'Erreur de connexion');
      }
    } catch (error) {
      setError('Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinSubmit = async () => {
    if (!selectedUser || pin.length < 4 || isLoading) return;

    setError('');
    setIsLoading(true);

    try {
      const result = await loginWithPin(selectedUser.id, pin);
      if (!result.success) {
        setError(result.message || 'Code PIN incorrect');
        setPin('');
      }
    } catch (error) {
      setError('Une erreur est survenue');
      setPin('');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-submit PIN when complete
  useEffect(() => {
    if (mode === 'pin' && pin.length >= 4 && pin.length <= 6 && selectedUser) {
      const timeout = setTimeout(() => {
        handlePinSubmit();
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [pin, mode, selectedUser]);

  const handlePinKeyPress = (key: string) => {
    if (lockoutTime > 0) return;
    
    if (key === 'backspace') {
      setPin(pin.slice(0, -1));
    } else if (key === 'clear') {
      setPin('');
    } else if (pin.length < 6) {
      setPin(pin + key);
      setError('');
    }
  };

  const formatLockoutTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-background flex items-center justify-center p-4 relative">
      {/* Toolbar - Fullscreen & Language */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-50">
        {/* Language Selector */}
        <div className="relative">
          <button
            onClick={() => setShowLanguageMenu(!showLanguageMenu)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-xl transition-all",
              "bg-card/80 backdrop-blur-sm border border-border",
              "hover:bg-accent/50 active:scale-95"
            )}
            title={t('settings.language')}
          >
            <Globe className="w-5 h-5" />
            <span className="text-sm font-medium hidden sm:inline">
              {LANGUAGES[settings?.language as Language || 'fr-FR']?.name || 'Français'}
            </span>
          </button>
          
          {/* Language Dropdown */}
          <AnimatePresence>
            {showLanguageMenu && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute right-0 mt-2 bg-card border border-border rounded-xl shadow-lg overflow-hidden min-w-[140px]"
              >
                {(Object.entries(LANGUAGES) as [Language, typeof LANGUAGES[Language]][]).map(([code, lang]) => (
                  <button
                    key={code}
                    onClick={() => {
                      updateSettings({ language: code });
                      setShowLanguageMenu(false);
                    }}
                    className={cn(
                      "w-full px-4 py-3 text-left text-sm transition-all",
                      "hover:bg-primary/10",
                      settings?.language === code && "bg-primary/10 text-primary font-medium"
                    )}
                  >
                    {lang.name}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        {/* Fullscreen Toggle */}
        <button
          onClick={toggleKioskMode}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-xl transition-all",
            "bg-card/80 backdrop-blur-sm border border-border",
            "hover:bg-accent/50 active:scale-95",
            kioskMode && "bg-primary/10 text-primary border-primary/50"
          )}
          title={kioskMode ? t('settings.kioskOff') : t('settings.kioskOn')}
        >
          {kioskMode ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          <span className="text-sm font-medium hidden sm:inline">
            {kioskMode ? t('auth.exit') : t('auth.kiosk')}
          </span>
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <AnimatePresence mode="wait">
          {/* User Selection Mode */}
          {mode === 'select' && (
            <motion.div
              key="select"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="bg-card rounded-2xl shadow-2xl p-8 space-y-6 border border-border"
            >
              <div className="text-center space-y-2">
                <div className="mx-auto w-16 h-16 bg-primary rounded-full flex items-center justify-center mb-4">
                  <LogIn className="w-8 h-8 text-primary-foreground" />
                </div>
                <h1 className="text-3xl font-bold">Connexion</h1>
                <p className="text-muted-foreground">Qui êtes-vous ?</p>
              </div>

              {/* User Grid - Hide admin, only show staff (chef, caissier) */}
              {users.filter(u => u.role !== 'admin').length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {users.filter(u => u.role !== 'admin').map((user, index) => (
                    <motion.button
                      key={user.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      onClick={() => handleSelectUser(user)}
                      className={cn(
                        "p-4 rounded-xl border-2 transition-all hover:scale-[1.02] active:scale-[0.98]",
                        "bg-background hover:bg-primary/5 border-border hover:border-primary"
                      )}
                    >
                      <div className="text-4xl mb-2">{user.avatar || '👤'}</div>
                      <div className="font-medium truncate">{user.name}</div>
                      <div className="text-xs text-muted-foreground capitalize">{user.role}</div>
                      {user.pin && (
                        <div className="mt-2 text-xs text-primary flex items-center justify-center gap-1">
                          <KeyRound className="w-3 h-3" />
                          PIN
                        </div>
                      )}
                    </motion.button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <UserIcon className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>Aucun utilisateur trouvé</p>
                </div>
              )}

              {/* Manual Login Option - For admin/technician */}
              <div className="pt-4 border-t border-border">
                <button
                  onClick={() => {
                    setMode('password');
                    setSelectedUser(null);
                  }}
                  className="w-full text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Accès administrateur
                </button>
              </div>
            </motion.div>
          )}

          {/* PIN Entry Mode */}
          {mode === 'pin' && selectedUser && (
            <motion.div
              key="pin"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-card rounded-2xl shadow-2xl overflow-hidden border border-border"
            >
              {/* Header */}
              <div className="p-6 text-center border-b border-border relative">
                <button
                  onClick={handleBack}
                  className="absolute left-4 top-4 p-2 hover:bg-accent rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                
                <div className="text-5xl mb-3">{selectedUser.avatar || '👤'}</div>
                <h2 className="text-xl font-bold">{selectedUser.name}</h2>
                <p className="text-sm text-muted-foreground">Entrez votre code PIN</p>
              </div>

              {/* PIN Display */}
              <div className="p-6">
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm text-center flex items-center justify-center gap-2"
                  >
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </motion.div>
                )}

                {lockoutTime > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mb-4 p-3 bg-warning/10 border border-warning/20 rounded-lg text-warning text-sm text-center"
                  >
                    Compte verrouillé : {formatLockoutTime(lockoutTime)}
                  </motion.div>
                )}

                <div className="flex justify-center gap-3 mb-6">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={cn(
                        "w-4 h-4 rounded-full transition-all",
                        i < pin.length
                          ? "bg-primary scale-110"
                          : "bg-muted"
                      )}
                    />
                  ))}
                </div>

                {/* PIN Keypad */}
                <div className="grid grid-cols-3 gap-3">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'backspace'].map((key) => (
                    <button
                      key={key}
                      onClick={() => handlePinKeyPress(key)}
                      disabled={lockoutTime > 0 || isLoading}
                      className={cn(
                        "h-16 rounded-xl font-bold text-2xl transition-all",
                        "bg-background hover:bg-primary hover:text-primary-foreground",
                        "border-2 border-border active:scale-95",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                        key === 'clear' && "text-sm text-muted-foreground",
                        key === 'backspace' && "text-sm"
                      )}
                    >
                      {key === 'backspace' ? '⌫' : key === 'clear' ? 'C' : key}
                    </button>
                  ))}
                </div>

                {/* Switch to password - only for admin */}
                {selectedUser.role === 'admin' && (
                  <button
                    onClick={() => setMode('password')}
                    className="w-full mt-4 text-sm text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-2"
                  >
                    <Lock className="w-4 h-4" />
                    Utiliser le mot de passe
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* Password Entry Mode */}
          {mode === 'password' && (
            <motion.div
              key="password"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-card rounded-2xl shadow-2xl p-8 space-y-6 border border-border"
            >
              {selectedUser ? (
                <div className="relative text-center space-y-2">
                  <button
                    onClick={handleBack}
                    className="absolute left-0 top-0 p-2 hover:bg-accent rounded-lg transition-colors"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <div className="text-5xl mb-3">{selectedUser.avatar || '👤'}</div>
                  <h1 className="text-2xl font-bold">{selectedUser.name}</h1>
                  <p className="text-muted-foreground text-sm">Entrez votre mot de passe</p>
                </div>
              ) : (
                <div className="relative text-center space-y-2">
                  <button
                    onClick={handleBack}
                    className="absolute left-0 top-0 p-2 hover:bg-accent rounded-lg transition-colors"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <div className="mx-auto w-16 h-16 bg-primary rounded-full flex items-center justify-center mb-4">
                    <LogIn className="w-8 h-8 text-primary-foreground" />
                  </div>
                  <h1 className="text-3xl font-bold">Connexion</h1>
                  <p className="text-muted-foreground">Connectez-vous pour accéder au système</p>
                </div>
              )}

              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm text-center flex items-center justify-center gap-2"
                  >
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </motion.div>
                )}

                {lockoutTime > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-3 bg-warning/10 border border-warning/20 rounded-lg text-warning text-sm text-center"
                  >
                    Compte verrouillé : {formatLockoutTime(lockoutTime)}
                  </motion.div>
                )}

                {!selectedUser && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <UserIcon className="w-4 h-4" />
                      Nom d'utilisateur
                    </label>
                    <TouchInput
                      type="text"
                      value={username}
                      onChange={setUsername}
                      placeholder="admin"
                      className="h-12 text-lg"
                      showQuickSuggestions={false}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Mot de passe
                  </label>
                  <TouchInput
                    type="password"
                    value={password}
                    onChange={setPassword}
                    placeholder="••••••••"
                    className="h-12 text-lg"
                    showQuickSuggestions={false}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || !password || (!selectedUser && !username) || lockoutTime > 0}
                  className="w-full h-14 text-lg font-semibold"
                  size="lg"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      Connexion...
                    </div>
                  ) : (
                    <>
                      <LogIn className="w-5 h-5 mr-2" />
                      Se connecter
                    </>
                  )}
                </Button>
              </form>

              {/* Switch to PIN if available */}
              {selectedUser?.pin && (
                <button
                  onClick={() => setMode('pin')}
                  className="w-full text-sm text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-2"
                >
                  <KeyRound className="w-4 h-4" />
                  Utiliser le code PIN
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
