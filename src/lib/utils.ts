export function safeHostname(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return "N/A";
  }
}

export function normalizeTextForMatch(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMessage: string) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}
