import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { VirtualKeyboard } from './virtual-keyboard';
import { X } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';
import { getTranslation, Language } from '@/lib/i18n';

interface KeyboardData {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  showQuickSuggestions?: boolean;
  quickSuggestions?: string[];
  language?: Language;
}

export function GlobalVirtualKeyboard() {
  const [keyboardData, setKeyboardData] = useState<KeyboardData | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [language, setLanguage] = useState<Language>('fr-FR');
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Get language from document or settings
  useEffect(() => {
    const detectLanguage = (): Language => {
      const htmlLang = document.documentElement.lang;
      const htmlDir = document.documentElement.dir;
      if (htmlDir === 'rtl' || htmlLang?.startsWith('ar')) return 'ar-DZ';
      if (htmlLang?.startsWith('en')) return 'en-US';
      return 'fr-FR';
    };
    setLanguage(detectLanguage());
    
    const observer = new MutationObserver(() => {
      setLanguage(detectLanguage());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['lang', 'dir']
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleShow = (e: CustomEvent<KeyboardData>) => {
      // Clear any pending hide timeout
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
      
      setKeyboardData(e.detail);
      setIsVisible(true);
    };

    const handleHide = () => {
      setIsVisible(false);
      // Clear data after animation
      hideTimeoutRef.current = setTimeout(() => {
        setKeyboardData(null);
        hideTimeoutRef.current = null;
      }, 300);
    };

    const handleUpdate = (e: CustomEvent<KeyboardData>) => {
      // Only update if keyboard is visible
      if (isVisible) {
        setKeyboardData(e.detail);
      }
    };

    window.addEventListener('virtual-keyboard:show', handleShow as EventListener);
    window.addEventListener('virtual-keyboard:hide', handleHide);
    window.addEventListener('virtual-keyboard:update', handleUpdate as EventListener);

    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      window.removeEventListener('virtual-keyboard:show', handleShow as EventListener);
      window.removeEventListener('virtual-keyboard:hide', handleHide);
      window.removeEventListener('virtual-keyboard:update', handleUpdate as EventListener);
    };
  }, [isVisible]);

  const handleClose = () => {
    setIsVisible(false);
    window.dispatchEvent(new CustomEvent('virtual-keyboard:hide'));
  };

  if (!keyboardData) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/10 z-[9998]"
          />
          
          {/* Keyboard Container - Fixed at bottom */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={cn(
              "fixed bottom-0 left-0 right-0 z-[9999] virtual-keyboard-container",
              "bg-background border-t-2 border-border shadow-2xl",
              "max-h-[75vh] overflow-y-auto"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-border bg-muted/50">
              <div className="flex-1 min-w-0 px-2">
                <p className="text-sm font-medium text-muted-foreground truncate mb-1">
                  {keyboardData.placeholder || getTranslation('keyboard.textInput', language)}
                </p>
                <div className="text-lg font-semibold break-words min-h-[1.5rem]">
                  {keyboardData.value || <span className="text-muted-foreground italic">{getTranslation('keyboard.typeText', language)}</span>}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                className="ml-2"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Keyboard */}
            <div className="p-4">
              <VirtualKeyboard
                value={keyboardData.value}
                onChange={keyboardData.onChange}
                placeholder={keyboardData.placeholder}
                showQuickSuggestions={keyboardData.showQuickSuggestions}
                quickSuggestions={keyboardData.quickSuggestions}
                onClose={handleClose}
                hideDisplay={true}
                language={keyboardData.language || language}
                className="max-w-4xl mx-auto"
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
