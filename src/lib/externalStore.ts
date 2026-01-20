import type { User } from "@/app/workspace/types";

export type AiProvider = "HUGGINGFACE" | "OPENAI" | "GEMINI";

type UserSnapshotCache = {
  key: string;
  value: User | null;
};

let cachedUserSnapshot: UserSnapshotCache = { key: "__init__", value: null };

export function subscribeToStorage(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const handler = (event: Event) => {
    if (event instanceof StorageEvent) {
      const key = event.key ?? "";
      if (
        key &&
        key !== "smartwork_user" &&
        key !== "smartwork_token" &&
        key !== "smartwork_ai_provider"
      ) {
        return;
      }
    }
    callback();
  };
  window.addEventListener("storage", handler);
  window.addEventListener("smartwork-storage", handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener("smartwork-storage", handler);
  };
}

export function subscribeToLocation(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("popstate", callback);
  return () => {
    window.removeEventListener("popstate", callback);
  };
}

export function getStoredUserSnapshot(): User | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem("smartwork_user") ?? "";
  const storedToken = window.localStorage.getItem("smartwork_token") ?? "";
  const cacheKey = `${stored}::${storedToken}`;
  if (cacheKey === cachedUserSnapshot.key) {
    return cachedUserSnapshot.value;
  }
  if (!stored || !storedToken) {
    cachedUserSnapshot = { key: cacheKey, value: null };
    return null;
  }
  try {
    const parsed = JSON.parse(stored) as User;
    cachedUserSnapshot = { key: cacheKey, value: parsed };
    return parsed;
  } catch {
    cachedUserSnapshot = { key: cacheKey, value: null };
    return null;
  }
}

export function getStoredAiProviderSnapshot(): AiProvider {
  if (typeof window === "undefined") return "HUGGINGFACE";
  const storedProvider = window.localStorage.getItem("smartwork_ai_provider") ?? "";
  if (
    storedProvider === "OPENAI" ||
    storedProvider === "HUGGINGFACE" ||
    storedProvider === "GEMINI"
  ) {
    return storedProvider;
  }
  return "HUGGINGFACE";
}

export function getJobUrlSnapshot(): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return params.get("jobUrl") ?? "";
}
