// Currency formatting utilities driven by Localization Settings

const STORAGE_KEY = 'adminCurrencySettings';

export function setCurrencySettings(settings) {
  try {
    if (!settings || typeof settings !== 'object') return;
    const current = getCurrencySettings();
    const merged = { ...current, ...settings };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch (_) {}
}

export function getCurrencySettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { currency: 'INR', currencySymbol: '₹', decimalPlaces: 2, locale: 'en-IN' };
    const parsed = JSON.parse(raw);
    return {
      currency: parsed.currency || 'INR',
      currencySymbol: parsed.currencySymbol || '₹',
      decimalPlaces: typeof parsed.decimalPlaces === 'number' ? parsed.decimalPlaces : 2,
      locale: parsed.locale || 'en-IN',
    };
  } catch (_) {
    return { currency: 'INR', currencySymbol: '₹', decimalPlaces: 2, locale: 'en-IN' };
  }
}

export function formatCurrency(value) {
  const { currency, currencySymbol, decimalPlaces, locale } = getCurrencySettings();
  const num = Number(value || 0);
  try {
    if (currency) {
      return new Intl.NumberFormat(locale || undefined, { style: 'currency', currency, minimumFractionDigits: decimalPlaces, maximumFractionDigits: decimalPlaces }).format(num);
    }
  } catch (_) {}
  // Fallback to symbol + fixed
  return `${currencySymbol}${num.toFixed(decimalPlaces)}`;
}

