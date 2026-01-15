import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Delete, X, RotateCcw, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getTranslation, Language } from '@/lib/i18n';

interface VirtualKeyboardProps {
  value: string;
  onChange: (value: string) => void;
  onClose?: () => void;
  placeholder?: string;
  showQuickSuggestions?: boolean;
  quickSuggestions?: string[];
  className?: string;
  hideDisplay?: boolean;
  language?: Language;
}

// QWERTY layout (English, Arabic, etc.)
const LOWER_CASE_QWERTY = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];

const UPPER_CASE_QWERTY = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

// AZERTY layout (French)
const LOWER_CASE_AZERTY = [
  ['a', 'z', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['q', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm'],
  ['w', 'x', 'c', 'v', 'b', 'n'],
];

const UPPER_CASE_AZERTY = [
  ['A', 'Z', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['Q', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M'],
  ['W', 'X', 'C', 'V', 'B', 'N'],
];

const NUMBERS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
];

const DEFAULT_QUICK_SUGGESTIONS = [
  'Sans oignon',
  'Sans tomate',
  'Sans sauce',
  'Extra sauce',
  'Bien cuit',
  'Pas trop cuit',
  'Sans piment',
  'Avec piment',
  'À emporter',
  'Sur place',
];

export function VirtualKeyboard({
  value,
  onChange,
  onClose,
  placeholder,
  showQuickSuggestions = true,
  quickSuggestions = DEFAULT_QUICK_SUGGESTIONS,
  className,
  hideDisplay = false,
  language = 'fr-FR',
}: VirtualKeyboardProps) {
  const [isUpperCase, setIsUpperCase] = useState(false);
  const [isNumbers, setIsNumbers] = useState(false);
  
  const t = (key: string) => getTranslation(key, language);
  const defaultPlaceholder = t('keyboard.typeText');

  // Determine keyboard layout based on language
  const isFrench = language === 'fr-FR';
  const LOWER_CASE = isFrench ? LOWER_CASE_AZERTY : LOWER_CASE_QWERTY;
  const UPPER_CASE = isFrench ? UPPER_CASE_AZERTY : UPPER_CASE_QWERTY;

  const currentLayout = isNumbers ? NUMBERS : (isUpperCase ? UPPER_CASE : LOWER_CASE);

  // Simple handler: always append to end
  const handleKeyPress = (key: string) => {
    onChange(value + key);
    if (isUpperCase && !isNumbers) {
      setIsUpperCase(false);
    }
  };

  const handleBackspace = () => {
    if (value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const handleSpace = () => {
    handleKeyPress(' ');
  };

  const handleEnter = () => {
    handleKeyPress('\n');
  };

  const handleClearAll = () => {
    onChange('');
  };

  const handleConfirm = () => {
    if (onClose) {
      onClose();
    }
  };

  const handleQuickSuggestion = (suggestion: string) => {
    onChange(suggestion);
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Quick Suggestions */}
      {showQuickSuggestions && quickSuggestions && quickSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {quickSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => handleQuickSuggestion(suggestion)}
              className="px-3 py-1.5 text-sm bg-muted hover:bg-primary/10 hover:text-primary rounded-lg border border-border transition-colors touch-target"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Text Display - Hidden when used in global keyboard */}
      {!hideDisplay && (
        <div className="relative">
          <div className="w-full p-4 bg-background border-2 border-border rounded-xl text-lg min-h-[80px] break-words">
            {value || <span className="text-muted-foreground">{placeholder || defaultPlaceholder}</span>}
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
      <div className="bg-muted/30 p-3 rounded-xl space-y-2.5 virtual-keyboard-container">
        {/* Main Layout */}
        {currentLayout.map((row, rowIndex) => (
          <div key={rowIndex} className="flex justify-center gap-2">
            {row.map((key) => (
              <button
                key={key}
                onClick={() => handleKeyPress(key)}
                className="flex-1 max-w-[85px] h-16 text-xl font-bold bg-background hover:bg-primary hover:text-primary-foreground active:scale-95 rounded-xl border-2 border-border transition-all shadow-md touch-target"
              >
                {key}
              </button>
            ))}
          </div>
        ))}

        {/* Bottom Row */}
        <div className="flex justify-center gap-2 items-center">
          {/* Numbers/ABC Toggle */}
          <button
            onClick={() => {
              setIsNumbers(!isNumbers);
              setIsUpperCase(false);
            }}
            className="min-w-[90px] h-16 text-base font-bold bg-background hover:bg-primary hover:text-primary-foreground active:scale-95 rounded-xl border-2 border-border transition-all shadow-md touch-target"
          >
            {isNumbers ? 'ABC' : '123'}
          </button>

          {/* Shift */}
          {!isNumbers && (
            <button
              onClick={() => setIsUpperCase(!isUpperCase)}
              className={cn(
                "min-w-[90px] h-16 text-2xl font-bold rounded-xl border-2 border-border transition-all shadow-md touch-target active:scale-95",
                isUpperCase
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-primary hover:text-primary-foreground"
              )}
            >
              ⇧
            </button>
          )}

          {/* Space */}
          <button
            onClick={handleSpace}
            className="flex-1 max-w-[300px] h-16 text-lg font-semibold bg-background hover:bg-primary hover:text-primary-foreground active:scale-95 rounded-xl border-2 border-border transition-all shadow-md touch-target"
          >
            {t('keyboard.space')}
          </button>

          {/* Enter */}
          <button
            onClick={handleEnter}
            className="min-w-[90px] h-16 text-base font-semibold bg-background hover:bg-primary hover:text-primary-foreground active:scale-95 rounded-xl border-2 border-border transition-all shadow-md touch-target"
          >
            {t('keyboard.enter')}
          </button>

          {/* Backspace */}
          <button
            onClick={handleBackspace}
            className="min-w-[90px] h-16 flex items-center justify-center bg-background hover:bg-destructive hover:text-destructive-foreground active:scale-95 rounded-xl border-2 border-border transition-all shadow-md touch-target"
          >
            <Delete className="w-7 h-7" />
          </button>
        </div>

        {/* Action Row */}
        <div className="flex justify-center gap-2 mt-2">
          <button
            onClick={handleClearAll}
            className="flex-1 max-w-[300px] h-14 text-base font-semibold bg-background hover:bg-destructive hover:text-destructive-foreground active:scale-95 rounded-xl border-2 border-destructive/50 transition-all shadow-md touch-target flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-5 h-5" />
            {t('keyboard.clearAll')}
          </button>
          {onClose && (
            <button
              onClick={handleConfirm}
              className="flex-1 max-w-[300px] h-14 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 rounded-xl border-2 border-primary transition-all shadow-md touch-target flex items-center justify-center gap-2"
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
