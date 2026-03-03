import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, KeyRound, AlertCircle, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TouchInput } from '@/components/ui/touch-input';
import { NumericInput } from '@/components/ui/numeric-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { User, UserRole } from '@shared/types';
import { generateUUID, cn } from '@/lib/utils';

const AVATARS = ['👨‍💼', '👩‍💼', '🧑‍💻', '👨‍🍳', '👩‍🍳', '🧑‍🍳', '👤', '👥', '🙂', '😊', '🤠', '😎'];

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  existingUsers: User[]; // To check if admin already exists
  onSave: (user: Omit<User, 'createdAt' | 'lastLogin'> & { createdAt?: Date; lastLogin?: Date; pin?: string }) => Promise<void>;
  t: (key: string) => string;
}

export function UserModal({ isOpen, onClose, user, existingUsers, onSave, t }: UserModalProps) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('caissier');
  const [avatar, setAvatar] = useState('👤');
  const [usePin, setUsePin] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');

  // Check if an admin already exists (excluding the current user if editing)
  const existingAdmin = existingUsers.find(u => u.role === 'admin' && u.id !== user?.id);
  const isEditingAdmin = user?.role === 'admin';
  const canSelectAdmin = !existingAdmin || isEditingAdmin;
  
  // Pour les rôles non-admin, seul le PIN est utilisé (pas de mot de passe)
  const isAdminRole = role === 'admin';

  useEffect(() => {
    if (user) {
      setName(user.name);
      setUsername(user.username);
      setPassword(''); // Don't show password
      setConfirmPassword('');
      setRole(user.role);
      setAvatar(user.avatar || '👤');
      // Pour les non-admin, le PIN est toujours actif
      setUsePin(user.role === 'admin' ? !!user.pin : true);
      setPin('');
      setConfirmPin('');
    } else {
      setName('');
      setUsername('');
      setPassword('');
      setConfirmPassword('');
      // Default to caissier since admin might not be available
      setRole('caissier');
      setAvatar('🧑‍💻');
      // Pour les non-admin (par défaut caissier), le PIN est obligatoire
      setUsePin(true);
      setPin('');
      setConfirmPin('');
    }
    setError('');
  }, [user, isOpen]);
  
  // Quand le rôle change, mettre à jour usePin
  useEffect(() => {
    if (role !== 'admin') {
      setUsePin(true); // Forcer le PIN pour les non-admin
    }
  }, [role]);

  const handleSubmit = async () => {
    // Validation
    if (!name.trim()) {
      setError('Le nom est requis');
      return;
    }
    if (!username.trim()) {
      setError('Le nom d\'utilisateur est requis');
      return;
    }
    
    // Pour l'admin : mot de passe requis (sauf en édition)
    if (isAdminRole) {
      if (!user && !password.trim()) {
        setError('Le mot de passe est requis');
        return;
      }
      if (password.trim()) {
        if (password.length < 6) {
          setError('Le mot de passe doit contenir au moins 6 caractères');
          return;
        }
        if (password !== confirmPassword) {
          setError('Les mots de passe ne correspondent pas');
          return;
        }
      }
    }
    
    // Pour les non-admin : PIN obligatoire
    if (!isAdminRole) {
      if (!user && !pin.trim()) {
        setError('Le code PIN est requis');
        return;
      }
      if (!user?.pin && !pin.trim()) {
        setError('Le code PIN est requis');
        return;
      }
    }
    
    // PIN validation (si fourni)
    if (pin.trim()) {
      if (pin.length < 4 || pin.length > 6) {
        setError('Le code PIN doit contenir entre 4 et 6 chiffres');
        return;
      }
      if (!/^\d+$/.test(pin)) {
        setError('Le code PIN ne doit contenir que des chiffres');
        return;
      }
      if (pin !== confirmPin) {
        setError('Les codes PIN ne correspondent pas');
        return;
      }
    }

    try {
      await onSave({
        id: user?.id || generateUUID(),
        username: username.trim().toLowerCase(),
        password: isAdminRole ? (password.trim() || undefined) : undefined, // Mot de passe seulement pour admin
        pin: pin.trim() ? pin.trim() : undefined,
        role,
        name: name.trim(),
        avatar,
        createdAt: user?.createdAt,
        lastLogin: user?.lastLogin,
      });
    } catch (error: any) {
      if (error.name === 'ConstraintError') {
        setError('Ce nom d\'utilisateur existe déjà');
      } else {
        setError('Erreur lors de la sauvegarde');
      }
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="bg-card rounded-2xl w-full max-w-md max-h-[95vh] sm:max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-xl font-bold">
              {user ? t('users.edit') : t('users.add')}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-accent rounded-xl transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-100px)]">
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                {error}
              </div>
            )}

            {/* Avatar Selection */}
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-2">
                Avatar
              </label>
              <div className="flex flex-wrap gap-2">
                {AVATARS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAvatar(a)}
                    className={cn(
                      "w-12 h-12 text-2xl rounded-xl border-2 transition-all hover:scale-105",
                      avatar === a
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-2">
                {t('users.name')} *
              </label>
              <TouchInput
                value={name}
                onChange={setName}
                placeholder={t('users.namePlaceholder')}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-2">
                {t('users.username')} *
              </label>
              <TouchInput
                value={username}
                onChange={(v) => setUsername(v.toLowerCase().replace(/\s/g, ''))}
                placeholder={t('users.usernamePlaceholder')}
                className="mt-1"
                disabled={!!user} // Can't change username when editing
              />
              {user && (
                <p className="text-xs text-muted-foreground mt-1">
                  Le nom d'utilisateur ne peut pas être modifié
                </p>
              )}
            </div>

            {/* Mot de passe uniquement pour l'admin */}
            {isAdminRole && (
              <>
                <div>
                  <label className="text-sm font-medium text-muted-foreground block mb-2">
                    {user ? t('users.newPassword') : t('users.password')} {!user && '*'}
                  </label>
                  <TouchInput
                    type="password"
                    value={password}
                    onChange={setPassword}
                    placeholder={user ? t('users.newPasswordPlaceholder') : t('users.passwordPlaceholder')}
                    className="mt-1"
                  />
                  {user && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Laissez vide pour conserver le mot de passe actuel
                    </p>
                  )}
                </div>

                {password.trim() && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground block mb-2">
                      {t('users.confirmPassword')} {!user && '*'}
                    </label>
                    <TouchInput
                      type="password"
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                      placeholder={t('users.confirmPasswordPlaceholder')}
                      className="mt-1"
                    />
                  </div>
                )}
              </>
            )}

            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-2">
                {t('users.role')} *
              </label>
              <Select 
                value={role} 
                onValueChange={(value) => setRole(value as UserRole)}
                disabled={isEditingAdmin} // Can't change admin's role
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {canSelectAdmin ? (
                    <SelectItem value="admin">{t('users.roleAdmin')}</SelectItem>
                  ) : (
                    <SelectItem value="admin" disabled className="opacity-50">
                      {t('users.roleAdmin')} (unique)
                    </SelectItem>
                  )}
                  <SelectItem value="caissier">{t('users.roleCaissier')}</SelectItem>
                  <SelectItem value="chef">{t('users.roleChef')}</SelectItem>
                </SelectContent>
              </Select>
              {!canSelectAdmin && !isEditingAdmin && (
                <p className="text-xs text-warning mt-2 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Un seul administrateur est autorisé
                </p>
              )}
              {isEditingAdmin && (
                <p className="text-xs text-muted-foreground mt-1">
                  Le rôle administrateur ne peut pas être modifié
                </p>
              )}
            </div>

            {/* PIN Section */}
            <div className="pt-4 border-t border-border">
              {/* Pour les non-admin : PIN obligatoire */}
              {!isAdminRole ? (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-5 h-5 text-primary" />
                    <label className="text-sm font-semibold">Code PIN (authentification)</label>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Les caissiers et chefs utilisent uniquement le code PIN pour se connecter
                  </p>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground block mb-2">
                        Code PIN (4-6 chiffres) *
                      </label>
                      <NumericInput
                        value={pin}
                        onChange={(v) => setPin(v.replace(/\D/g, '').slice(0, 6))}
                        placeholder="0000"
                        className="mt-1 text-center text-lg tracking-[0.3em]"
                        masked
                        allowDecimal={false}
                        maxDecimals={0}
                      />
                      {user?.pin && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Laissez vide pour conserver le PIN actuel
                        </p>
                      )}
                    </div>
                    
                    {pin.trim() && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground block mb-2">
                          Confirmer le code PIN *
                        </label>
                        <NumericInput
                          value={confirmPin}
                          onChange={(v) => setConfirmPin(v.replace(/\D/g, '').slice(0, 6))}
                          placeholder="0000"
                          className="mt-1 text-center text-lg tracking-[0.3em]"
                          masked
                          allowDecimal={false}
                          maxDecimals={0}
                        />
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* Pour l'admin : PIN optionnel */
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-muted-foreground" />
                      <label className="text-sm font-medium">Code PIN rapide (optionnel)</label>
                    </div>
                    <Switch
                      checked={usePin}
                      onCheckedChange={setUsePin}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Permet un déverrouillage rapide de l'écran avec un code à 4-6 chiffres
                  </p>
                  
                  {usePin && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground block mb-2">
                          Code PIN {!user?.pin && '*'}
                        </label>
                        <NumericInput
                          value={pin}
                          onChange={(v) => setPin(v.replace(/\D/g, '').slice(0, 6))}
                          placeholder="0000"
                          className="mt-1 text-center tracking-[0.3em]"
                          masked
                          allowDecimal={false}
                          maxDecimals={0}
                        />
                        {user?.pin && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Laissez vide pour conserver le PIN actuel
                          </p>
                        )}
                      </div>
                      
                      {pin.trim() && (
                        <div>
                          <label className="text-sm font-medium text-muted-foreground block mb-2">
                            Confirmer le code PIN
                          </label>
                          <NumericInput
                            value={confirmPin}
                            onChange={(v) => setConfirmPin(v.replace(/\D/g, '').slice(0, 6))}
                            placeholder="0000"
                            className="mt-1 text-center tracking-[0.3em]"
                            masked
                            allowDecimal={false}
                            maxDecimals={0}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex gap-3 pt-4 flex-shrink-0 sticky bottom-0 bg-card">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1"
              >
                {t('general.cancel')}
              </Button>
              <Button
                onClick={handleSubmit}
                className="flex-1"
              >
                {t('general.save')}
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
