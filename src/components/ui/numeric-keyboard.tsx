import { Delete, X, RotateCcw, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getTranslation, Language } from '@/lib/i18n';

interface NumericKeyboardProps {
  value: string;
  onChange: (value: string) => void;
  onClose?: () => void;
  placeholder?: string;
  className?: string;
  hideDisplay?: boolean;
  language?: Language;
  allowDecimal?: boolean;
  maxDecimals?: number;
}

const NUMERIC_KEYS = [
  ['7', '8', '9'],
  ['4', '5', '6'],
  ['1', '2', '3'],
  ['0', '.'],
];

export function NumericKeyboard({
  value,
  onChange,
  onClose,
  placeholder,
  className,
  hideDisplay = false,
  language = 'fr-FR',
  allowDecimal = true,
  maxDecimals = 2,
}: NumericKeyboardProps) {
  const t = (key: string) => getTranslation(key, language);
  const defaultPlaceholder = t('keyboard.typeText');

  const handleKeyPress = (key: string) => {
    // Handle decimal point (or dot for IP addresses)
    if (key === '.') {
      if (!allowDecimal) return;
      
      // For IP addresses (maxDecimals = 0), allow multiple dots
      const isIPAddress = maxDecimals === 0;
      
      if (!isIPAddress) {
        // For regular decimals, only allow one decimal point
        if (value.includes('.')) return;
        // If value is empty, add 0 before decimal
        if (value === '') {
          onChange('0.');
          return;
        }
      } else {
        // For IP addresses, limit to 3 dots (4 segments)
        const dotCount = (value.match(/\./g) || []).length;
        if (dotCount >= 3) return;
      }
      
      onChange(value + key);
      return;
    }

    // Handle numbers
    // Check decimal places limit (only for regular decimals, not IP)
    if (maxDecimals > 0 && value.includes('.')) {
      const decimalPart = value.split('.')[1] || '';
      if (decimalPart.length >= maxDecimals) {
        return; // Don't add more digits if max decimals reached
      }
    }
    
    onChange(value + key);
  };

  const handleBackspace = () => {
    if (value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const handleClearAll = () => {
    onChange('');
  };

  const handleConfirm = () => {
    if (onClose) {
      onClose();
    }
  };

  // Format display value with proper decimal handling
  const displayValue = value || '';

  return (
    <div className={cn("space-y-4", className)}>
      {/* Text Display - Hidden when used in global keyboard */}
      {!hideDisplay && (
        <div className="relative">
          <div className="w-full p-4 bg-background border-2 border-border rounded-xl text-2xl font-semibold min-h-[80px] break-words text-center flex items-center justify-center">
            {displayValue || <span className="text-muted-foreground">{placeholder || defaultPlaceholder}</span>}
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="absolute top-2 right-2 p-2 hover:bg-accent rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Keyboard */}
      <div className="bg-muted/30 p-3 rounded-xl space-y-2.5">
        {/* Numeric Keys */}
        {NUMERIC_KEYS.map((row, rowIndex) => {
          // Filter out decimal if not allowed
          const filteredRow = allowDecimal ? row : row.filter(key => key !== '.');
          
          return (
            <div key={rowIndex} className="flex justify-center gap-2">
              {filteredRow.map((key) => {
                // Special handling for 0 and . row
                if (rowIndex === 3 && key === '0') {
                  // If decimal is not in the row, make 0 take full width
                  const hasDecimal = filteredRow.includes('.');
                  return (
                    <button
                      key={key}
                      onClick={() => handleKeyPress(key)}
                      className={cn(
                        "h-16 text-2xl font-bold bg-background hover:bg-primary hover:text-primary-foreground active:scale-95 rounded-xl border-2 border-border transition-all shadow-md touch-target",
                        hasDecimal ? "flex-[2] max-w-[180px]" : "flex-1 max-w-[85px]"
                      )}
                    >
                      {key}
                    </button>
                  );
                }
                
                return (
                  <button
                    key={key}
                    onClick={() => handleKeyPress(key)}
                    className="flex-1 max-w-[85px] h-16 text-2xl font-bold bg-background hover:bg-primary hover:text-primary-foreground active:scale-95 rounded-xl border-2 border-border transition-all shadow-md touch-target"
                  >
                    {key}
                  </button>
                );
              })}
            </div>
          );
        })}

        {/* Bottom Row */}
        <div className="flex justify-center gap-2 items-center">
          {/* Backspace */}
          <button
            onClick={handleBackspace}
            className="min-w-[90px] h-16 flex items-center justify-center bg-background hover:bg-destructive hover:text-destructive-foreground active:scale-95 rounded-xl border-2 border-border transition-all shadow-md touch-target"
          >
            <Delete className="w-7 h-7" />
          </button>

          {/* Clear All */}
          <button
            onClick={handleClearAll}
            className="flex-1 max-w-[300px] h-16 text-base font-semibold bg-background hover:bg-destructive hover:text-destructive-foreground active:scale-95 rounded-xl border-2 border-destructive/50 transition-all shadow-md touch-target flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-5 h-5" />
            {t('keyboard.clearAll')}
          </button>

          {/* Confirm */}
          {onClose && (
            <button
              onClick={handleConfirm}
              className="flex-1 max-w-[300px] h-16 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 rounded-xl border-2 border-primary transition-all shadow-md touch-target flex items-center justify-center gap-2"
            >
              <Check className="w-5 h-5" />
              {t('keyboard.validate')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
