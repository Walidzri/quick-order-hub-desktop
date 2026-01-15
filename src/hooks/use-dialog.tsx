import { useState, useCallback } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DialogOptions {
  title?: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
}

export function useDialog() {
  const [dialog, setDialog] = useState<{
    open: boolean;
    options: DialogOptions;
    resolve: ((value: boolean) => void) | null;
  }>({
    open: false,
    options: { description: '' },
    resolve: null,
  });

  const showDialog = useCallback((options: DialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialog({
        open: true,
        options: {
          title: options.title || 'Confirmation',
          description: options.description,
          confirmText: options.confirmText || 'Confirmer',
          cancelText: options.cancelText || 'Annuler',
          variant: options.variant || 'default',
        },
        resolve,
      });
    });
  }, []);

  const showAlert = useCallback((message: string, title?: string): Promise<void> => {
    return new Promise((resolve) => {
      setDialog({
        open: true,
        options: {
          title: title || 'Information',
          description: message,
          confirmText: 'OK',
          cancelText: undefined,
          variant: 'default',
        },
        resolve: () => {
          resolve();
          return true;
        },
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (dialog.resolve) {
      dialog.resolve(true);
    }
    setDialog({ open: false, options: { description: '' }, resolve: null });
  }, [dialog.resolve]);

  const handleCancel = useCallback(() => {
    if (dialog.resolve) {
      dialog.resolve(false);
    }
    setDialog({ open: false, options: { description: '' }, resolve: null });
  }, [dialog.resolve]);

  const DialogComponent = (
    <AlertDialog open={dialog.open} onOpenChange={(open) => !open && handleCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{dialog.options.title}</AlertDialogTitle>
          <AlertDialogDescription>{dialog.options.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {dialog.options.cancelText && (
            <AlertDialogCancel onClick={handleCancel}>{dialog.options.cancelText}</AlertDialogCancel>
          )}
          <AlertDialogAction
            onClick={handleConfirm}
            className={dialog.options.variant === 'destructive' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
          >
            {dialog.options.confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return {
    showDialog,
    showAlert,
    DialogComponent,
  };
}
