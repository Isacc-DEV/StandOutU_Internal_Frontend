export const URL_TABS_STORAGE_KEY = "UrlTabs";
export const PROFILE_TABS_STORAGE_KEY = "ProfileTabs";
export const LAST_PROFILE_STORAGE_KEY = "smartwork_last_profile_id";

export type UrlTabEntry = {
  url: string;
  isActive?: boolean;
};

export type ProfileTabStorageEntry = {
  link: string;
  cookie?: string | null;
  sessionStorage?: Record<string, string>;
  localStorage?: Record<string, string>;
};

export type ProfileTabsEntry = {
  profileId: string;
  lastVisitedLink?: string;
  storage?: ProfileTabStorageEntry[];
};

export const normalizeStoredUrl = (rawUrl: string): string => {
  try {
    const trimmed = rawUrl.trim();
    if (!trimmed) return "";
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return new URL(withScheme).toString();
  } catch {
    return rawUrl.trim();
  }
};

export const loadUrlTabsFromSession = (): {
  tabs: UrlTabEntry[];
  activeUrl: string | null;
} | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(URL_TABS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const tabs = parsed
      .map((tab) => ({
        url: typeof tab?.url === "string" ? tab.url : "",
        isActive: Boolean(tab?.isActive),
      }))
      .filter((tab) => Boolean(tab.url));
    if (!tabs.length) return null;
    const activeUrl = tabs.find((tab) => tab.isActive)?.url ?? tabs[0].url;
    return { tabs, activeUrl };
  } catch (err) {
    console.warn("Failed to read UrlTabs from session storage", err);
    return null;
  }
};

export const saveUrlTabsToSession = (tabs: UrlTabEntry[], activeUrl: string | null) => {
  if (typeof window === "undefined") return;
  try {
    const payload = tabs.map((tab) => ({
      url: tab.url,
      isActive: Boolean(activeUrl) && tab.url === activeUrl,
    }));
    window.sessionStorage.setItem(URL_TABS_STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn("Failed to save UrlTabs to session storage", err);
  }
};

export const loadProfileTabsFromSession = (): ProfileTabsEntry[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(PROFILE_TABS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is ProfileTabsEntry =>
        Boolean(entry) && typeof entry.profileId === "string"
    );
  } catch (err) {
    console.warn("Failed to read ProfileTabs from session storage", err);
    return [];
  }
};

export const saveProfileTabsToSession = (entries: ProfileTabsEntry[]) => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PROFILE_TABS_STORAGE_KEY, JSON.stringify(entries));
  } catch (err) {
    console.warn("Failed to save ProfileTabs to session storage", err);
  }
};

export const loadLastWorkspaceProfileId = (): string => {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(LAST_PROFILE_STORAGE_KEY) ?? "";
  } catch (err) {
    console.warn("Failed to read last workspace profile id", err);
    return "";
  }
};

export const saveLastWorkspaceProfileId = (profileId: string) => {
  if (typeof window === "undefined") return;
  if (!profileId) return;
  try {
    window.localStorage.setItem(LAST_PROFILE_STORAGE_KEY, profileId);
  } catch (err) {
    console.warn("Failed to save last workspace profile id", err);
  }
};
