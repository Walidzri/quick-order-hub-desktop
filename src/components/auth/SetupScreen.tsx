import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChefHat, User as UserIcon, Shield, Check, AlertCircle, Maximize2, Minimize2, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TouchInput } from '@/components/ui/touch-input';
import { useAuth } from '@/contexts/AuthContext';
import { usePOS } from '@/contexts/POSContext';
import { cn } from '@/lib/utils';
import { LANGUAGES, Language } from '@/lib/i18n';

export function SetupScreen() {
  const { saveUser, loadUsers } = useAuth();
  const { kioskMode, toggleKioskMode, settings, updateSettings, t } = usePOS();
  const [step, setStep] = useState(1);
  
  // Chef data
  const [chefName, setChefName] = useState('');
  const [chefUsername, setChefUsername] = useState('');
  const [chefPin, setChefPin] = useState('');
  const [chefConfirmPin, setChefConfirmPin] = useState('');
  
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);

  const validateStep1 = () => {
    if (!chefName.trim()) {
      setError('Le nom du chef est requis');
      return false;
    }
    if (!chefUsername.trim()) {
      setError('Le nom d\'utilisateur est requis');
      return false;
    }
    if (chefUsername.trim().length < 3) {
      setError('Le nom d\'utilisateur doit contenir au moins 3 caractères');
      return false;
    }
    setError('');
    return true;
  };

  const validateStep2 = () => {
    if (!chefPin) {
      setError('Le code PIN est requis');
      return false;
    }
    if (chefPin.length < 4 || chefPin.length > 6) {
      setError('Le code PIN doit contenir entre 4 et 6 chiffres');
      return false;
    }
    if (!/^\d+$/.test(chefPin)) {
      setError('Le code PIN ne doit contenir que des chiffres');
      return false;
    }
    if (chefPin !== chefConfirmPin) {
      setError('Les codes PIN ne correspondent pas');
      return false;
    }
    setError('');
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    }
  };

  const handleBack = () => {
    setError('');
    setStep(1);
  };

  const handleCreateChef = async () => {
    if (!validateStep2()) return;

    setIsLoading(true);
    setError('');

    try {
      await saveUser({
        id: `chef-${Date.now()}`,
        name: chefName.trim(),
        username: chefUsername.trim().toLowerCase(),
        password: '', // Les chefs n'ont pas de mot de passe
        pin: chefPin,
        role: 'chef',
        avatar: '👨‍🍳',
      });
      
      await loadUsers();
      
      // Clear any existing session to prevent auto-login
      localStorage.removeItem('pos_user');
      localStorage.removeItem('pos_session_id');
      
      // Setup complete - reload to go to login screen
      window.location.reload();
    } catch (error: any) {
      if (error.name === 'ConstraintError') {
        setError('Ce nom d\'utilisateur existe déjà');
      } else {
        setError('Erreur lors de la création du compte chef');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/20 via-background to-primary/5 flex items-center justify-center p-4 relative">
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
        className="w-full max-w-lg"
      >
        <div className="bg-card rounded-3xl shadow-2xl overflow-hidden border border-border">
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-8 text-white text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
              className="mx-auto w-20 h-20 bg-white/20 backdrop-blur rounded-full flex items-center justify-center mb-4"
            >
              <ChefHat className="w-10 h-10" />
            </motion.div>
            <h1 className="text-3xl font-bold">Configuration initiale</h1>
            <p className="text-white/80 mt-2">
              Créez le compte Chef de Cuisine
            </p>
          </div>

          {/* Progress Steps */}
          <div className="flex justify-center gap-4 py-4 bg-muted/30">
            {[1, 2].map((s) => (
              <div
                key={s}
                className={`flex items-center gap-2 ${s <= step ? 'text-primary' : 'text-muted-foreground'}`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    s < step
                      ? 'bg-primary text-primary-foreground'
                      : s === step
                      ? 'bg-primary/20 text-primary border-2 border-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {s < step ? <Check className="w-5 h-5" /> : s === 1 ? <UserIcon className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
                </div>
                {s < 2 && (
                  <div
                    className={`w-12 h-1 rounded ${s < step ? 'bg-primary' : 'bg-muted'}`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Content */}
          <div className="p-8">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm flex items-center gap-2"
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                {error}
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold">Identité du Chef</h2>
                  <p className="text-muted-foreground text-sm mt-1">
                    Le chef aura accès à la gestion des produits et de la cuisine
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <ChefHat className="w-4 h-4" />
                      Nom du chef
                    </label>
                    <TouchInput
                      value={chefName}
                      onChange={setChefName}
                      placeholder="Ex: Ahmed"
                      className="h-12 text-lg"
                      showQuickSuggestions={false}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <UserIcon className="w-4 h-4" />
                      Nom d'utilisateur
                    </label>
                    <TouchInput
                      value={chefUsername}
                      onChange={(v) => setChefUsername(v.toLowerCase().replace(/\s/g, ''))}
                      placeholder="Ex: chef"
                      className="h-12 text-lg"
                      showQuickSuggestions={false}
                    />
                    <p className="text-xs text-muted-foreground">
                      Sera affiché sur l'écran de connexion
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold">Code PIN du Chef</h2>
                  <p className="text-muted-foreground text-sm mt-1">
                    Le chef utilisera ce code pour se connecter rapidement
                  </p>
                </div>

                <div className="p-4 bg-primary/5 rounded-xl border border-primary/20">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-5 h-5 text-primary" />
                    <span className="font-medium">Code PIN d'authentification</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
                    Les chefs et caissiers utilisent uniquement un code PIN (pas de mot de passe)
                  </p>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">
                        Code PIN (4-6 chiffres)
                      </label>
                      <TouchInput
                        type="password"
                        value={chefPin}
                        onChange={(v) => setChefPin(v.replace(/\D/g, '').slice(0, 6))}
                        placeholder="••••"
                        className="h-14 text-xl text-center tracking-[0.5em]"
                        showQuickSuggestions={false}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">
                        Confirmer le code PIN
                      </label>
                      <TouchInput
                        type="password"
                        value={chefConfirmPin}
                        onChange={(v) => setChefConfirmPin(v.replace(/\D/g, '').slice(0, 6))}
                        placeholder="••••"
                        className="h-14 text-xl text-center tracking-[0.5em]"
                        showQuickSuggestions={false}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Navigation Buttons */}
            <div className="flex gap-3 mt-8">
              {step > 1 && (
                <Button
                  variant="outline"
                  onClick={handleBack}
                  className="flex-1 h-14 text-lg"
                >
                  Retour
                </Button>
              )}
              
              {step === 1 ? (
                <Button
                  onClick={handleNext}
                  className="flex-1 h-14 text-lg bg-orange-500 hover:bg-orange-600"
                >
                  Continuer
                </Button>
              ) : (
                <Button
                  onClick={handleCreateChef}
                  disabled={isLoading}
                  className="flex-1 h-14 text-lg bg-orange-500 hover:bg-orange-600"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Création...
                    </div>
                  ) : (
                    <>
                      <ChefHat className="w-5 h-5 mr-2" />
                      Créer le compte Chef
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
