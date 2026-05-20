export function safeJsonParse<T>(str: string, fallback: T): T {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch (err) {
    console.error('Failed to parse JSON:', str, err);
    return fallback;
  }
}
