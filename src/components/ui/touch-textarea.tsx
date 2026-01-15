import { useState, useRef, useEffect } from 'react';
import { Keyboard, X } from 'lucide-react';
import { Textarea } from './textarea';
import { cn } from '@/lib/utils';
import { getTranslation, Language } from '@/lib/i18n';

interface TouchTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  showQuickSuggestions?: boolean;
  quickSuggestions?: string[];
  language?: Language;
}

export function TouchTextarea({
  value,
  onChange,
  placeholder,
  rows = 2,
  className,
  showQuickSuggestions = true,
  quickSuggestions,
  language = 'fr-FR',
}: TouchTextareaProps) {
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [globalKeyboardVisible, setGlobalKeyboardVisible] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState<Language>(language);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Detect language from document
  useEffect(() => {
    const detectLanguage = (): Language => {
      const htmlLang = document.documentElement.lang;
      const htmlDir = document.documentElement.dir;
      if (htmlDir === 'rtl' || htmlLang?.startsWith('ar')) return 'ar-DZ';
      if (htmlLang?.startsWith('en')) return 'en-US';
      return 'fr-FR';
    };
    setCurrentLanguage(detectLanguage());
    
    const observer = new MutationObserver(() => {
      setCurrentLanguage(detectLanguage());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['lang', 'dir']
    });
    return () => observer.disconnect();
  }, []);
  
  const t = (key: string) => getTranslation(key, currentLanguage);

  // Listen to global keyboard visibility
  useEffect(() => {
    const handleShow = () => setGlobalKeyboardVisible(true);
    const handleHide = () => {
      setGlobalKeyboardVisible(false);
      setShowKeyboard(false);
    };

    window.addEventListener('virtual-keyboard:show', handleShow);
    window.addEventListener('virtual-keyboard:hide', handleHide);

    return () => {
      window.removeEventListener('virtual-keyboard:show', handleShow);
      window.removeEventListener('virtual-keyboard:hide', handleHide);
    };
  }, []);

  // Emit show/hide events
  useEffect(() => {
    if (showKeyboard) {
      window.dispatchEvent(new CustomEvent('virtual-keyboard:show', { 
        detail: { value, onChange, placeholder, showQuickSuggestions, quickSuggestions, language: currentLanguage } 
      }));
    }
  }, [showKeyboard, placeholder, showQuickSuggestions, quickSuggestions, currentLanguage]);

  // Update keyboard when value changes
  useEffect(() => {
    if (showKeyboard && globalKeyboardVisible) {
      window.dispatchEvent(new CustomEvent('virtual-keyboard:update', { 
        detail: { value, onChange, placeholder, showQuickSuggestions, quickSuggestions } 
      }));
    }
  }, [value, showKeyboard, globalKeyboardVisible, onChange, placeholder, showQuickSuggestions, quickSuggestions]);

  const handleFocus = () => {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouchDevice) {
      textareaRef.current?.blur();
      setShowKeyboard(true);
    }
  };

  const handleClick = () => {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouchDevice && !showKeyboard) {
      setShowKeyboard(true);
    }
  };

  const toggleKeyboard = () => {
    setShowKeyboard(!showKeyboard);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className={cn("resize-none", globalKeyboardVisible ? "pr-3" : "pr-10")}
          onFocus={handleFocus}
          onClick={handleClick}
        />
        {!globalKeyboardVisible && (
          <button
            type="button"
            onClick={toggleKeyboard}
            className={cn(
              "absolute bottom-2 right-2 p-2 rounded-lg transition-colors",
              showKeyboard
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80"
            )}
            title={showKeyboard ? t('keyboard.hide') : t('keyboard.show')}
          >
            {showKeyboard ? (
              <X className="w-4 h-4" />
            ) : (
              <Keyboard className="w-4 h-4" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
