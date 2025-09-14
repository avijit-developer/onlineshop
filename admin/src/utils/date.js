// Lightweight date formatting utilities with dynamic localization settings

const STORAGE_KEY = 'adminLocalizationSettings';

export function setLocalizationSettings(localization) {
  try {
    if (!localization || typeof localization !== 'object') return;
    const current = getLocalizationSettings();
    const merged = { ...current, ...localization };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch (_) {}
}

export function getLocalizationSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { dateFormat: 'MM/DD/YYYY', timeFormat: '12' };
    const parsed = JSON.parse(raw);
    return {
      dateFormat: parsed.dateFormat || 'MM/DD/YYYY',
      timeFormat: parsed.timeFormat || '12',
    };
  } catch (_) {
    return { dateFormat: 'MM/DD/YYYY', timeFormat: '12' };
  }
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatWithPattern(date, pattern) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  const DD = pad2(d.getDate());
  const MM = pad2(d.getMonth() + 1);
  const YYYY = String(d.getFullYear());
  return pattern.replace(/DD/g, DD).replace(/MM/g, MM).replace(/YYYY/g, YYYY);
}

export function formatDate(date) {
  if (!date) return '-';
  const { dateFormat } = getLocalizationSettings();
  return formatWithPattern(date, dateFormat);
}

export function formatTime(date) {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  const { timeFormat } = getLocalizationSettings();
  let hours = d.getHours();
  const minutes = pad2(d.getMinutes());
  if (String(timeFormat) === '12') {
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${pad2(hours)}:${minutes} ${ampm}`;
  }
  return `${pad2(hours)}:${minutes}`;
}

export function formatDateTime(date) {
  const d = formatDate(date);
  const t = formatTime(date);
  if (d === '-' && t === '-') return '-';
  if (d === '-') return t;
  if (t === '-') return d;
  return `${d} ${t}`;
}

