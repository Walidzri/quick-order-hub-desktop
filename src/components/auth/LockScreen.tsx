import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, KeyRound, LogOut, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TouchInput } from '@/components/ui/touch-input';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

type UnlockMode = 'pin' | 'password';

export function LockScreen() {
  const { user, unlock, unlockWithPin, logout, getRemainingLockoutTime } = useAuth();
  
  // Pour les non-admin, toujours le mode PIN (ils n'ont pas de mot de passe)
  // Pour l'admin, PIN si disponible, sinon mot de passe
  const isAdmin = user?.role === 'admin';
  const defaultMode = isAdmin ? (user?.pin ? 'pin' : 'password') : 'pin';
  
  const [mode, setMode] = useState<UnlockMode>(defaultMode);
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lockoutTime, setLockoutTime] = useState(0);

  // Check lockout timer
  useEffect(() => {
    if (user) {
      const checkLockout = async () => {
        const remaining = await getRemainingLockoutTime(user.id);
        setLockoutTime(remaining);
      };
      checkLockout();

      if (lockoutTime > 0) {
        const interval = setInterval(async () => {
          const remaining = await getRemainingLockoutTime(user.id);
          setLockoutTime(remaining);
        }, 1000);
        return () => clearInterval(interval);
      }
    }
  }, [user, lockoutTime, getRemainingLockoutTime]);

  const handlePasswordSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!password || isLoading) return;

    setError('');
    setIsLoading(true);

    try {
      const result = await unlock(password);
      if (!result.success) {
        setError(result.message || 'Mot de passe incorrect');
        setPassword('');
      }
    } catch (error) {
      setError('Une erreur est survenue');
      setPassword('');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinSubmit = async () => {
    if (pin.length < 4 || isLoading) return;

    setError('');
    setIsLoading(true);

    try {
      const result = await unlockWithPin(pin);
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

  const handleLogout = () => {
    logout();
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <AnimatePresence mode="wait">
          {/* PIN Mode */}
          {mode === 'pin' && user.pin && (
            <motion.div
              key="pin"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-card rounded-2xl shadow-2xl overflow-hidden border border-border"
            >
              {/* Header */}
              <div className="p-6 text-center border-b border-border bg-gradient-to-r from-primary/10 to-primary/5">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.2 }}
                  className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-3"
                >
                  <span className="text-5xl">{user.avatar || '👤'}</span>
                </motion.div>
                <h2 className="text-xl font-bold">{user.name}</h2>
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mt-1">
                  <Lock className="w-4 h-4" />
                  Écran verrouillé
                </div>
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

                <p className="text-center text-muted-foreground mb-4">
                  Entrez votre code PIN pour déverrouiller
                </p>

                <div className="flex justify-center gap-3 mb-6">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <motion.div
                      key={i}
                      animate={{
                        scale: i < pin.length ? 1.2 : 1,
                        backgroundColor: i < pin.length ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
                      }}
                      className="w-4 h-4 rounded-full"
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
                        "h-14 rounded-xl font-bold text-xl transition-all",
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

                {/* Bouton OK — visible dès 4 chiffres */}
                {pin.length >= 4 && (
                  <button
                    onClick={handlePinSubmit}
                    disabled={isLoading || lockoutTime > 0}
                    className={cn(
                      "w-full mt-3 h-12 rounded-xl font-bold text-lg transition-all",
                      "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    {isLoading ? '...' : 'OK ✓'}
                  </button>
                )}

                {/* Actions */}
                <div className="mt-6 flex items-center justify-between">
                  {/* Le bouton mot de passe n'est disponible que pour l'admin */}
                  {isAdmin && (
                    <button
                      onClick={() => setMode('password')}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-2"
                    >
                      <Lock className="w-4 h-4" />
                      Mot de passe
                    </button>
                  )}
                  
                  <button
                    onClick={handleLogout}
                    className={cn(
                      "text-sm text-destructive hover:text-destructive/80 transition-colors flex items-center gap-2",
                      !isAdmin && "ml-auto"
                    )}
                  >
                    <LogOut className="w-4 h-4" />
                    Déconnexion
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Password Mode - uniquement pour l'admin */}
          {isAdmin && (mode === 'password' || !user.pin) && (
            <motion.div
              key="password"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-card rounded-2xl shadow-2xl p-8 space-y-6 border border-border"
            >
              {/* Header */}
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.2 }}
                  className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-3"
                >
                  <span className="text-5xl">{user.avatar || '👤'}</span>
                </motion.div>
                <h2 className="text-xl font-bold">{user.name}</h2>
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mt-1">
                  <Lock className="w-4 h-4" />
                  Écran verrouillé
                </div>
              </div>

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
                  disabled={isLoading || !password || lockoutTime > 0}
                  className="w-full h-12 text-lg font-semibold"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      Déverrouillage...
                    </div>
                  ) : (
                    <>
                      <Lock className="w-5 h-5 mr-2" />
                      Déverrouiller
                    </>
                  )}
                </Button>
              </form>

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-border">
                {user.pin && (
                  <button
                    onClick={() => setMode('pin')}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-2"
                  >
                    <KeyRound className="w-4 h-4" />
                    Code PIN
                  </button>
                )}
                
                <button
                  onClick={handleLogout}
                  className={cn(
                    "text-sm text-destructive hover:text-destructive/80 transition-colors flex items-center gap-2",
                    !user.pin && "ml-auto"
                  )}
                >
                  <LogOut className="w-4 h-4" />
                  Déconnexion
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
