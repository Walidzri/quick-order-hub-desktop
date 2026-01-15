import { useState, useRef, useEffect } from 'react';
import { Network, X } from 'lucide-react';
import { Input } from './input';
import { cn } from '@/lib/utils';
import { getTranslation, Language } from '@/lib/i18n';

interface IPInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  language?: Language;
}

export function IPInput({
  value,
  onChange,
  placeholder = '192.168.1.100',
  className,
  language = 'fr-FR',
}: IPInputProps) {
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [globalKeyboardVisible, setGlobalKeyboardVisible] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState<Language>(language);
  const inputRef = useRef<HTMLInputElement>(null);
  
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

  // Custom handler for IP address input
  const handleIPChange = (newValue: string) => {
    // Only allow numbers and dots
    let cleaned = newValue.replace(/[^0-9.]/g, '');
    
    // Prevent multiple consecutive dots
    cleaned = cleaned.replace(/\.\.+/g, '.');
    
    // Split by dots to validate each segment
    const parts = cleaned.split('.');
    
    // Limit to 4 parts
    if (parts.length > 4) {
      // Take only first 4 parts
      cleaned = parts.slice(0, 4).join('.');
    }
    
    // Validate each segment (0-255)
    const validParts = parts.slice(0, 4).map((part, index) => {
      // Remove leading zeros except for single zero
      let trimmed = part.replace(/^0+/, '') || '0';
      
      // Limit segment length to 3 digits
      if (trimmed.length > 3) {
        trimmed = trimmed.slice(0, 3);
      }
      
      // Validate numeric value (0-255)
      const num = parseInt(trimmed);
      if (!isNaN(num)) {
        if (num > 255) {
          return '255';
        }
        return num.toString();
      }
      
      return trimmed;
    });
    
    // Reconstruct IP, but preserve trailing dot if user is typing
    let result = validParts.join('.');
    
    // If original ended with a dot and we have less than 4 parts, preserve it
    if (cleaned.endsWith('.') && validParts.length < 4 && validParts[validParts.length - 1] !== '') {
      result += '.';
    }
    
    onChange(result);
  };

  // Emit show/hide events with IP-specific handler
  useEffect(() => {
    if (showKeyboard) {
      // Create a wrapper onChange that handles IP formatting
      const ipOnChange = (newValue: string) => {
        handleIPChange(newValue);
      };
      
      window.dispatchEvent(new CustomEvent('numeric-keyboard:show', { 
        detail: { 
          value, 
          onChange: ipOnChange, 
          placeholder, 
          allowDecimal: true, // Allow dots for IP
          maxDecimals: 0, // 0 indicates IP address (allows multiple dots)
          language: currentLanguage 
        } 
      }));
    }
  }, [showKeyboard, placeholder, currentLanguage, value]);

  // Update keyboard when value changes
  useEffect(() => {
    if (showKeyboard && globalKeyboardVisible) {
      const ipOnChange = (newValue: string) => {
        handleIPChange(newValue);
      };
      
      window.dispatchEvent(new CustomEvent('numeric-keyboard:update', { 
        detail: { 
          value, 
          onChange: ipOnChange, 
          placeholder, 
          allowDecimal: true, // Allow dots for IP
          maxDecimals: 0 // 0 indicates IP address (allows multiple dots)
        } 
      }));
    }
  }, [value, showKeyboard, globalKeyboardVisible, placeholder]);

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
    handleIPChange(e.target.value);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          placeholder={placeholder}
          className={cn(globalKeyboardVisible ? "pr-3" : "pr-10", "font-mono", className)}
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
              <Network className="w-4 h-4" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
