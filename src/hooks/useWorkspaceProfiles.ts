import { useCallback, useEffect, useMemo, useState } from "react";
import type { Metrics, Profile, User } from "../app/workspace/types";
import { cleanBaseInfo } from "@/lib/resume";
import { loadLastWorkspaceProfileId } from "@/lib/workspace/storage";

type UseWorkspaceProfilesOptions = {
  api: <T = unknown>(path: string, init?: RequestInit) => Promise<T>;
  user: User | null;
  onProfileChange?: (profileId: string, profiles: Profile[]) => void;
};

export function useWorkspaceProfiles({ api, user, onProfileChange }: UseWorkspaceProfilesOptions) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  const selectedProfile = useMemo(
    () => profiles.find((p) => p.id === selectedProfileId),
    [profiles, selectedProfileId]
  );

  const refreshMetrics = useCallback(
    async (bidderId?: string) => {
      if (!bidderId && !user) return;
      const id = bidderId ?? user?.id;
      if (!id) return;
      try {
        const m = await api<Metrics>(`/metrics/my?bidderUserId=${id}`);
        setMetrics(m);
      } catch (err) {
        console.error(err);
      }
    },
    [api, user]
  );

  useEffect(() => {
    const fetchForUser = async () => {
      if (!user || user.role === "OBSERVER") return;
      try {
        const profs = await api<Profile[]>(`/profiles`);
        const visible =
          user.role === "BIDDER"
            ? profs.filter((p) => p.assignedBidderId === user.id)
            : profs;
        const normalized = visible.map((p) => ({
          ...p,
          baseInfo: cleanBaseInfo(p.baseInfo ?? {}),
          baseAdditionalBullets: p.baseAdditionalBullets ?? {},
        }));
        setProfiles(normalized);
        const storedProfileId = loadLastWorkspaceProfileId();
        const defaultProfileId =
          storedProfileId && normalized.some((profile) => profile.id === storedProfileId)
            ? storedProfileId
            : normalized[0]?.id ?? "";
        setSelectedProfileId(defaultProfileId);
        onProfileChange?.(defaultProfileId, normalized);
        void refreshMetrics(user.id);
      } catch (err) {
        console.error(err);
      }
    };
    void fetchForUser();
  }, [user, refreshMetrics, api, onProfileChange]);

  return {
    profiles,
    selectedProfileId,
    setSelectedProfileId,
    selectedProfile,
    metrics,
    refreshMetrics,
  };
}
