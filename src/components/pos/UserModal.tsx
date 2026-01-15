import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TouchInput } from '@/components/ui/touch-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, UserRole } from '@/lib/database';
import { generateUUID } from '@/lib/utils';

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onSave: (user: Omit<User, 'createdAt' | 'lastLogin'> & { createdAt?: Date; lastLogin?: Date }) => Promise<void>;
  t: (key: string) => string;
}

export function UserModal({ isOpen, onClose, user, onSave, t }: UserModalProps) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('caissier');
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setName(user.name);
      setUsername(user.username);
      setPassword(''); // Don't show password
      setConfirmPassword('');
      setRole(user.role);
    } else {
      setName('');
      setUsername('');
      setPassword('');
      setConfirmPassword('');
      setRole('caissier');
    }
    setError('');
  }, [user, isOpen]);

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
    if (!user && !password.trim()) {
      setError('Le mot de passe est requis');
      return;
    }
    if (password.trim()) {
      if (password.length < 4) {
        setError('Le mot de passe doit contenir au moins 4 caractères');
        return;
      }
      if (password !== confirmPassword) {
        setError('Les mots de passe ne correspondent pas');
        return;
      }
    }

    try {
      await onSave({
        id: user?.id || generateUUID(),
        username: username.trim().toLowerCase(),
        password: password.trim() || undefined, // undefined si vide (gardera l'ancien lors de l'édition)
        role,
        name: name.trim(),
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
          <div className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                {error}
              </div>
            )}

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
                onChange={setUsername}
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

            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-2">
                {t('users.role')} *
              </label>
              <Select value={role} onValueChange={(value) => setRole(value as UserRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">{t('users.roleAdmin')}</SelectItem>
                  <SelectItem value="caissier">{t('users.roleCaissier')}</SelectItem>
                  <SelectItem value="chef">{t('users.roleChef')}</SelectItem>
                </SelectContent>
              </Select>
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
