import React from 'react';
import { Order, Settings, ReceiptCustomization } from '@/lib/database';
import { formatCurrency, Currency } from '@/lib/i18n';
import { DirectPrinter } from './printer';

interface ReceiptRendererProps {
  order: Order;
  settings: Settings;
  currency: Currency;
  customization: ReceiptCustomization;
  cashierName?: string;
  amountReceived?: number;
  change?: number;
  t: (key: string) => string;
  type?: 'receipt' | 'kitchen';
}

/**
 * Shared utility function to render receipt/ticket HTML
 * This ensures consistency across all previews, prints, and exports
 */
export function renderReceiptHTML({
  order,
  settings,
  currency,
  customization,
  cashierName = '',
  amountReceived,
  change,
  t,
  type = 'receipt'
}: ReceiptRendererProps): React.ReactElement {
  const isKitchen = type === 'kitchen';
  
  // Format date and time according to customization
  const dateObj = new Date(order.createdAt);
  const formattedDate = DirectPrinter.formatDate(dateObj, customization.dateFormat);
  const formattedTime = DirectPrinter.formatDate(dateObj, customization.timeFormat);
  
  const orderNumberDisplay = order.orderNumber;
  
  // Get separator character (use ASCII dash for compatibility)
  const separatorChar = customization.separatorStyle === 'none' ? '' : 
    (customization.separatorChar === '─' ? '-' : customization.separatorChar || '-');
  
  // Get alignment class
  const headerAlignClass = customization.headerAlignment === 'left' ? 'text-left' : 
                           customization.headerAlignment === 'right' ? 'text-right' : 
                           'text-center';
  
  // Get font styles
  const fontFamily = customization.fontFamily === 'monospace' ? 'Courier New, monospace' : 
                     customization.fontFamily === 'sans-serif' ? 'Arial, sans-serif' : 
                     'Times New Roman, serif';
  const fontSize = customization.fontSize === 'small' ? '11px' : 
                   customization.fontSize === 'large' ? '15px' : 
                   '13px';
  
  // Separator component that spans full width
  const Separator = () => {
    if (customization.separatorStyle === 'none') return null;
    return (
      <div 
        className="divider my-3 text-gray-400" 
        style={{ 
          fontFamily: 'monospace',
          width: '100%',
          display: 'block',
          lineHeight: '1',
          letterSpacing: '0',
          overflow: 'hidden',
          position: 'relative',
          height: '1em'
        }}
      >
        <div style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          whiteSpace: 'nowrap',
          overflow: 'hidden'
        }}>
          {separatorChar.repeat(500)}
        </div>
      </div>
    );
  };
  
  const typeLabel = order.type === 'dine-in' ? `[SUR PLACE]` : `[A EMPORTER]`;
  const paymentLabel = order.paymentMethod === 'cash' ? t('print.cash') : t('print.card');
  
  // Use kitchen-specific display options if it's a kitchen ticket
  const showOrderNumber = isKitchen ? customization.kitchenShowOrderNumber : customization.showOrderNumber;
  const showDate = isKitchen ? customization.kitchenShowDate : customization.showDate;
  const showTime = isKitchen ? customization.kitchenShowTime : customization.showTime;
  const showOrderType = isKitchen ? customization.kitchenShowOrderType : customization.showOrderType;
  const showCashier = isKitchen ? customization.kitchenShowCashier : customization.showCashier;
  const showProducts = isKitchen ? customization.kitchenShowProducts : customization.showProducts;
  const showProductPrices = isKitchen ? (customization.kitchenShowProductPrices) : customization.showProductPrices;
  const showModifiers = isKitchen ? customization.kitchenShowModifiers : customization.showModifiers;
  const showNotes = isKitchen ? customization.kitchenShowNotes : customization.showNotes;

  if (isKitchen) {
    return (
      <>
        {/* Kitchen Ticket Header */}
        <div className={`header ${headerAlignClass}`}>
          <div className="section-title">{customization.labelKitchenTicket}</div>
        </div>

        <Separator />

        {/* Order number #XXX large, centered, right below TICKET CUISINE */}
        {showOrderNumber && (
          <div className="text-center my-4">
            <span style={{ fontSize: '1.75rem', fontWeight: 700 }}>{orderNumberDisplay}</span>
          </div>
        )}
        {showOrderNumber && <Separator />}

        {/* Order Info - Conditional display based on kitchen customization (no order number here) */}
        {(showDate || showTime || showOrderType || showCashier) && (
          <>
            <div className="section">
              <div className="order-info">
                {showOrderType && (
                  <div><strong>{customization.labelOrderType}:</strong> {typeLabel}</div>
                )}
                {showDate && (
                  <div><strong>{customization.labelDate}:</strong> {formattedDate}</div>
                )}
                {showTime && (
                  <div><strong>{customization.labelTime}:</strong> {formattedTime}</div>
                )}
                {showCashier && cashierName && (
                  <div><strong>{customization.labelCashier}:</strong> {cashierName}</div>
                )}
              </div>
            </div>
            <Separator />
          </>
        )}

        {/* Order Lines - Conditional display */}
        {showProducts && order.lines.length > 0 && (
          <>
            <div className="section">
              {order.lines.map((line, index) => {
                const lineTotal = (line.unitPrice + line.modifiers.reduce((sum, m) => sum + m.priceAdjustment, 0)) * line.quantity;
                const productName = DirectPrinter.applyTextStyle(line.productName, customization.productNameStyle);
                return (
                  <div key={index} className="order-line">
                    <div className="line-header">
                      {line.quantity}x {productName}
                      {showModifiers && line.variantSize && ` (${line.variantSize})`}
                    </div>
                    {showModifiers && line.modifiers.length > 0 && (
                      <div className="line-details">
                        {line.modifiers.map((mod, modIndex) => (
                          <div key={modIndex}>+ (S) {mod.optionName}</div>
                        ))}
                      </div>
                    )}
                    {showNotes && line.note && (
                      <div className="line-details" style={{ fontStyle: 'italic', fontWeight: 'bold' }}>
                        [!] Note: {line.note}
                      </div>
                    )}
                    {showProductPrices && (
                      <div className="text-right mt-1 text-sm font-semibold">
                        {formatCurrency(lineTotal, currency)}
                      </div>
                    )}
                    {index < order.lines.length - 1 && customization.separatorStyle !== 'none' && (
                      <div 
                        className="mt-2 text-gray-400" 
                        style={{ 
                          fontFamily: 'monospace',
                          width: '100%',
                          display: 'block',
                          lineHeight: '1',
                          letterSpacing: '0',
                          overflow: 'hidden',
                          position: 'relative',
                          height: '1em'
                        }}
                      >
                        <div style={{
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden'
                        }}>
                          {customization.separatorChar.repeat(500)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <Separator />
          </>
        )}

        <div className={`footer ${headerAlignClass}`}>
          <div>{customization.labelBonAppetit}</div>
        </div>
      </>
    );
  }

  // Receipt rendering
  return (
    <>
      {/* Restaurant Header - With customizable alignment */}
      <div className={`header mb-4 ${headerAlignClass}`}>
        {settings?.logo && (
          <div className="mb-3">
            <img 
              src={settings.logo} 
              alt="Logo" 
              className="h-20 mx-auto object-contain"
            />
          </div>
        )}
        <div className="restaurant-name text-lg font-bold uppercase tracking-wide mb-1">
          {DirectPrinter.applyTextStyle(settings?.restaurantName || t('print.restaurant'), customization.restaurantNameStyle)}
        </div>
        {settings?.showAddress && settings?.address && (
          <div className="address text-xs mb-1">{settings.address}</div>
        )}
        {settings?.showPhone && settings?.phone && (
          <div className="phone text-xs">{settings.phone}</div>
        )}
      </div>

      <Separator />

      {/* Receipt Header Message (Bienvenue) */}
      {settings?.receiptHeader && (
        <>
          <div className={`section text-xs mb-3 ${headerAlignClass}`} style={{ whiteSpace: 'pre-line' }}>
            {settings.receiptHeader}
          </div>
          <Separator />
        </>
      )}

      {/* Order number #XXX large, centered, right below Bienvenue */}
      {customization.showOrderNumber && (
        <>
          <div className="text-center my-4">
            <span style={{ fontSize: '1.75rem', fontWeight: 700 }}>{orderNumberDisplay}</span>
          </div>
          <Separator />
        </>
      )}

      {/* Order Info - Conditional display (no order number here) */}
      {(customization.showDate || customization.showTime || customization.showOrderType || customization.showPaymentMethod || customization.showCashier) && (
        <>
          <div className="section mb-4">
            <div className="order-info text-xs space-y-1">
              {customization.showDate && (
                <div className="flex justify-between">
                  <span className="font-semibold">{customization.labelDate}:</span>
                  <span>{formattedDate}</span>
                </div>
              )}
              {customization.showTime && (
                <div className="flex justify-between">
                  <span className="font-semibold">{customization.labelTime}:</span>
                  <span>{formattedTime}</span>
                </div>
              )}
              {customization.showOrderType && (
                <div className="flex justify-between">
                  <span className="font-semibold">{customization.labelOrderType}:</span>
                  <span>{typeLabel}</span>
                </div>
              )}
              {customization.showPaymentMethod && (
                <div className="flex justify-between">
                  <span className="font-semibold">{customization.labelPaymentMethod}:</span>
                  <span>{paymentLabel}</span>
                </div>
              )}
              {customization.showCashier && cashierName && (
                <div className="flex justify-between">
                  <span className="font-semibold">{customization.labelCashier}:</span>
                  <span>{cashierName}</span>
                </div>
              )}
            </div>
          </div>
          <Separator />
        </>
      )}

      {/* Order Lines - Conditional display */}
      {customization.showProducts && order.lines.length > 0 && (
        <>
          <div className="section mb-4 space-y-3">
            {order.lines.map((line, index) => {
              const lineTotal = (line.unitPrice + line.modifiers.reduce((sum, m) => sum + m.priceAdjustment, 0)) * line.quantity;
              const productName = DirectPrinter.applyTextStyle(line.productName, customization.productNameStyle);
              return (
                <div key={index} className="order-line">
                  <div className="line-header font-semibold uppercase text-sm mb-1">
                    {line.quantity}x {productName}
                  </div>
                  {customization.showModifiers && line.variantSize && (
                    <div className="line-details text-xs ml-3 text-gray-600">
                      Taille: {line.variantSize}
                    </div>
                  )}
                  {customization.showModifiers && line.modifiers.length > 0 && (
                    <div className="line-details text-xs ml-3 text-gray-600 space-y-0.5">
                      {line.modifiers.map((mod, modIndex) => (
                        <div key={modIndex}>+ (S) {mod.optionName}</div>
                      ))}
                    </div>
                  )}
                  {customization.showNotes && line.note && (
                    <div className="line-details text-xs ml-3 text-amber-700 font-semibold italic mt-1">
                      ⚠ NOTE: {line.note}
                    </div>
                  )}
                  {customization.showProductPrices && (
                    <div className="text-right mt-1 text-sm font-semibold">
                      {formatCurrency(lineTotal, currency)}
                    </div>
                  )}
                  {index < order.lines.length - 1 && customization.separatorStyle !== 'none' && (
                    <div 
                      className="mt-2 text-gray-400" 
                      style={{ 
                        fontFamily: 'monospace',
                        width: '100%',
                        display: 'block',
                        lineHeight: '1',
                        letterSpacing: '0',
                        overflow: 'hidden',
                        position: 'relative',
                        height: '1em'
                      }}
                    >
                      <div style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden'
                      }}>
                        {customization.separatorChar.repeat(500)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <Separator />
        </>
      )}

      {/* Totals - Conditional display */}
      {(customization.showSubtotal || customization.showDiscount || customization.showTotal || customization.showAmountReceived || customization.showChange) && (
        <>
          <div className="totals space-y-2 mb-4">
            {customization.showSubtotal && (
              <div className="total-line flex justify-between text-xs">
                <span>{customization.labelSubtotal}</span>
                <span>{formatCurrency(order.subtotal, currency)}</span>
              </div>
            )}
            {customization.showDiscount && order.discount > 0 && (
              <div className="total-line flex justify-between text-xs text-green-700">
                <span>{customization.labelDiscount}</span>
                <span>-{formatCurrency(order.discount, currency)}</span>
              </div>
            )}
            {customization.showTotal && (
              <>
                <div className="divider border-t border-gray-400 my-2"></div>
                <div className="total-line flex justify-between text-base font-bold uppercase">
                  <span>{customization.labelTotal}</span>
                  <span>{formatCurrency(order.total, currency)}</span>
                </div>
              </>
            )}
            {order.paymentMethod === 'cash' && amountReceived && change !== undefined && (
              <>
                <div className="divider border-t border-gray-400 my-2"></div>
                {customization.showAmountReceived && (
                  <div className="total-line flex justify-between text-xs">
                    <span>{customization.labelAmountReceived}:</span>
                    <span>{formatCurrency(amountReceived, currency)}</span>
                  </div>
                )}
                {customization.showChange && change > 0 && (
                  <div className="total-line flex justify-between text-xs">
                    <span>{customization.labelChange}:</span>
                    <span>{formatCurrency(change, currency)}</span>
                  </div>
                )}
              </>
            )}
          </div>
          <Separator />
        </>
      )}

      {/* Receipt Footer */}
      {settings?.receiptFooter && (
        <>
          <div className={`footer text-xs mb-3 ${headerAlignClass}`} style={{ whiteSpace: 'pre-line' }}>
            {settings.receiptFooter}
          </div>
          <Separator />
        </>
      )}

      <div className={`footer mt-4 ${headerAlignClass}`}>
        <div className="text-sm font-semibold uppercase tracking-wide mb-2">
          {customization.labelThankYou}
        </div>
      </div>
    </>
  );
}
