/** Маскирует телефон в строке для логов (+79001234567 → +7900***4567). */
export function maskPhoneForLog(value: string): string {
  if (typeof value !== 'string') return String(value);
  return value.replace(/\+?7\d{9,10}/g, (m) => m.slice(0, 4) + '***' + m.slice(-4));
}

/** Рекурсивно маскирует телефоны в объекте (для body логов). */
export function maskPhonesInObject(obj: unknown): unknown {
  if (obj == null) return obj;
  if (typeof obj === 'string') return maskPhoneForLog(obj);
  if (Array.isArray(obj)) return obj.map(maskPhonesInObject);
  if (typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      const key = k.toLowerCase();
      out[k] =
        key === 'phone' || key === 'text' || key === 'message' || key === 'content'
          ? (typeof v === 'string' ? maskPhoneForLog(v) : maskPhonesInObject(v))
          : maskPhonesInObject(v);
    }
    return out;
  }
  return obj;
}
