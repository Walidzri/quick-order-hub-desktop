import { useState, useRef, useEffect } from 'react';
import { Calculator, X } from 'lucide-react';
import { Input } from './input';
import { cn } from '@/lib/utils';
import { getTranslation, Language } from '@/lib/i18n';

interface NumericInputProps {
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  min?: number;
  max?: number;
  step?: number;
  allowDecimal?: boolean;
  maxDecimals?: number;
  language?: Language;
}

export function NumericInput({
  value,
  onChange,
  placeholder,
  className,
  min,
  max,
  step,
  allowDecimal = true,
  maxDecimals = 2,
  language = 'fr-FR',
}: NumericInputProps) {
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [globalKeyboardVisible, setGlobalKeyboardVisible] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState<Language>(language);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Convert value to string
  const stringValue = typeof value === 'number' ? value.toString() : value;
  
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

    window.addEventListener('numeric-keyboard:show', handleShow);
    window.addEventListener('numeric-keyboard:hide', handleHide);

    return () => {
      window.removeEventListener('numeric-keyboard:show', handleShow);
      window.removeEventListener('numeric-keyboard:hide', handleHide);
    };
  }, []);

  // Emit show/hide events
  useEffect(() => {
    if (showKeyboard) {
      window.dispatchEvent(new CustomEvent('numeric-keyboard:show', { 
        detail: { 
          value: stringValue, 
          onChange, 
          placeholder, 
          allowDecimal,
          maxDecimals,
          language: currentLanguage 
        } 
      }));
    }
  }, [showKeyboard, placeholder, allowDecimal, maxDecimals, currentLanguage, stringValue, onChange]);

  // Update keyboard when value changes
  useEffect(() => {
    if (showKeyboard && globalKeyboardVisible) {
      window.dispatchEvent(new CustomEvent('numeric-keyboard:update', { 
        detail: { 
          value: stringValue, 
          onChange, 
          placeholder, 
          allowDecimal,
          maxDecimals
        } 
      }));
    }
  }, [stringValue, showKeyboard, globalKeyboardVisible, onChange, placeholder, allowDecimal, maxDecimals]);

  const handleFocus = () => {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouchDevice) {
      inputRef.current?.blur();
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative">
        <Input
          ref={inputRef}
          type="number"
          value={stringValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          className={cn(globalKeyboardVisible ? "pr-3" : "pr-10", className)}
          onFocus={handleFocus}
          onClick={handleClick}
        />
        {!globalKeyboardVisible && (
          <button
            type="button"
            onClick={toggleKeyboard}
            className={cn(
              "absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-colors",
              showKeyboard
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80"
            )}
            title={showKeyboard ? t('keyboard.hide') : t('keyboard.show')}
          >
            {showKeyboard ? (
              <X className="w-4 h-4" />
            ) : (
              <Calculator className="w-4 h-4" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
