'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Check, Users } from "lucide-react";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/useAuth";
import ManagerShell from "../../../components/ManagerShell";

type BidderSummary = {
  id: string;
  userName: string;
  email: string;
  profiles: { id: string; displayName: string }[];
};

type Profile = {
  id: string;
  displayName: string;
  createdBy?: string | null;
  assignedManagerUserId?: string | null;
  assignedManagerName?: string | null;
  assignedBidderId?: string | null;
};

function getProfileManagerId(profile?: Profile | null) {
  return (profile?.assignedManagerUserId || profile?.createdBy || "").trim();
}

export default function ManagerBiddersPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [bidders, setBidders] = useState<BidderSummary[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [error, setError] = useState("");
  const [pendingAssign, setPendingAssign] = useState<{ bidderId: string; profileId: string } | null>(null);
  const [pendingUnassign, setPendingUnassign] = useState<{ bidderId: string; profileId: string } | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [confirmAssignOpen, setConfirmAssignOpen] = useState(false);
  const [confirmUnassignOpen, setConfirmUnassignOpen] = useState(false);
  const [profileSelectOpen, setProfileSelectOpen] = useState<string | null>(null);
  const [selectedProfileForAssign, setSelectedProfileForAssign] = useState<{
    bidderId: string;
    profileId: string;
  } | null>(null);
  const dropdownRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!profileSelectOpen) return;
      const dropdown = dropdownRefs.current.get(profileSelectOpen);
      if (dropdown && !dropdown.contains(event.target as Node)) {
        setProfileSelectOpen(null);
        setSelectedProfileForAssign(null);
      }
    }

    if (!profileSelectOpen) return;
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [profileSelectOpen]);

  const loadData = useCallback(async (authToken: string) => {
    try {
      const summaries = await api<BidderSummary[]>("/manager/bidders/summary", undefined, authToken);
      setBidders(summaries);
    } catch (err) {
      console.error(err);
      setError("Failed to load bidders.");
    }
  }, []);

  const loadProfiles = useCallback(async (authToken: string) => {
    try {
      const list = await api<Profile[]>("/profiles", undefined, authToken);
      setProfiles(list);
    } catch (err) {
      console.error(err);
      setError("Failed to load profiles.");
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user || !token) {
      router.replace("/auth");
      return;
    }
    if (user.role !== "MANAGER" && user.role !== "ADMIN") {
      router.replace("/workspace");
      return;
    }
    void loadData(token);
    void loadProfiles(token);
  }, [loadData, loadProfiles, loading, router, token, user]);

  const canManageProfile = useCallback(
    (profileId: string) => {
      if (!user?.id) return false;
      if (user.role === "ADMIN") return true;
      const profile = profiles.find((item) => item.id === profileId);
      return getProfileManagerId(profile) === user.id;
    },
    [profiles, user?.id, user?.role],
  );

  const profileById = useMemo(() => {
    const map = new Map<string, Profile>();
    profiles.forEach((profile) => {
      map.set(profile.id, profile);
    });
    return map;
  }, [profiles]);

  const globallyAssignedProfileIds = useMemo(
    () => new Set(bidders.flatMap((bidder) => bidder.profiles.map((profile) => profile.id))),
    [bidders],
  );

  const getAvailableProfiles = useCallback(
    (bidderId: string) => {
      const bidder = bidders.find((item) => item.id === bidderId);
      const bidderAssignedProfileIds = new Set(
        bidder?.profiles.map((profile) => profile.id) ?? [],
      );
      return profiles.filter((profile) => {
        const isOwnedByCurrentUser =
          user?.role === "ADMIN" || (user?.id ? getProfileManagerId(profile) === user.id : false);
        const assignedElsewhere =
          Boolean(profile.assignedBidderId) && profile.assignedBidderId !== bidderId;
        const assignedToAnotherBidder =
          globallyAssignedProfileIds.has(profile.id) && !bidderAssignedProfileIds.has(profile.id);
        return (
          isOwnedByCurrentUser &&
          !bidderAssignedProfileIds.has(profile.id) &&
          !assignedElsewhere &&
          !assignedToAnotherBidder
        );
      });
    },
    [bidders, globallyAssignedProfileIds, profiles, user?.id, user?.role],
  );

  async function handleAssign(bidderId: string, profileId: string) {
    if (!token || !user) return;
    if (!canManageProfile(profileId)) {
      setError("Only admins or the assigned manager can assign this profile to bidders.");
      return;
    }

    setAssigning(true);
    setError("");
    try {
      await api(
        "/assignments",
        {
          method: "POST",
          body: JSON.stringify({
            profileId,
            bidderUserId: bidderId,
            assignedBy: user.id,
          }),
        },
        token,
      );
      await Promise.all([loadData(token), loadProfiles(token)]);
      setConfirmAssignOpen(false);
      setPendingAssign(null);
      setProfileSelectOpen(null);
      setSelectedProfileForAssign(null);
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Failed to assign profile.";
      if (message.includes("already assigned")) {
        setError("Profile is already assigned to another bidder.");
      } else {
        setError(message);
      }
      setConfirmAssignOpen(false);
      setPendingAssign(null);
      setSelectedProfileForAssign(null);
    } finally {
      setAssigning(false);
    }
  }

  async function handleUnassign(profileId: string) {
    if (!token) return;
    if (!canManageProfile(profileId)) {
      setError("Only admins or the assigned manager can remove this profile from bidders.");
      return;
    }

    setAssigning(true);
    setError("");
    try {
      await api(`/assignments/${profileId}/unassign`, { method: "POST", body: "{}" }, token);
      await Promise.all([loadData(token), loadProfiles(token)]);
      setConfirmUnassignOpen(false);
      setPendingUnassign(null);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to unassign profile.");
      setConfirmUnassignOpen(false);
      setPendingUnassign(null);
    } finally {
      setAssigning(false);
    }
  }

  return (
    <ManagerShell>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <header className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/20">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-600">
                Manager
              </p>
              <h1 className="mt-1 text-4xl font-bold tracking-tight text-slate-900">
                Bidder roster
              </h1>
            </div>
          </div>
          <p className="max-w-2xl text-base leading-relaxed text-slate-600">
            Track bidder assignments. Managers can assign profiles they own; admins can assign any profile.
          </p>
        </header>

        <div className="space-y-6">
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="grid grid-cols-3 bg-slate-50 px-4 py-3 text-xs uppercase tracking-[0.14em] text-slate-600">
              <div>Name</div>
              <div>Profiles</div>
            </div>
            <div className="divide-y divide-slate-200">
              {bidders.length === 0 ? (
                <div className="px-4 py-6 text-sm text-slate-600">No bidders found.</div>
              ) : (
                bidders.map((bidder) => {
                  const availableProfiles = getAvailableProfiles(bidder.id);
                  return (
                    <div
                      key={bidder.id}
                      className="grid grid-cols-3 items-center px-4 py-3 text-sm text-slate-800"
                    >
                      <div className="font-semibold text-slate-900">{bidder.userName}</div>
                      <div className="relative flex flex-wrap items-center gap-2 text-slate-700">
                        {bidder.profiles.length === 0 ? (
                          <span className="text-xs text-slate-500">Unassigned</span>
                        ) : (
                          <div className="flex flex-wrap gap-1 text-xs">
                            {bidder.profiles.map((profile) => {
                              const fullProfile = profileById.get(profile.id);
                              const owned = canManageProfile(profile.id);
                              const managerLabel =
                                fullProfile?.assignedManagerName ||
                                getProfileManagerId(fullProfile) ||
                                "another manager";
                              return (
                                <span
                                  key={profile.id}
                                  className="group relative inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-slate-800"
                                  title={owned ? profile.displayName : `Managed by ${managerLabel}`}
                                >
                                  {profile.displayName}
                                  {owned ? (
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setPendingUnassign({
                                          bidderId: bidder.id,
                                          profileId: profile.id,
                                        });
                                        setConfirmUnassignOpen(true);
                                      }}
                                      className="ml-1 flex h-3 w-3 items-center justify-center rounded-full bg-slate-200 text-slate-600 opacity-0 transition-opacity hover:bg-slate-300 group-hover:opacity-100"
                                      title="Remove profile"
                                    >
                                      <X className="h-2 w-2" />
                                    </button>
                                  ) : null}
                                </span>
                              );
                            })}
                          </div>
                        )}

                        <div className="relative">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              if (availableProfiles.length === 0) return;
                              const nextState = profileSelectOpen === bidder.id ? null : bidder.id;
                              setProfileSelectOpen(nextState);
                              if (nextState === null) {
                                setSelectedProfileForAssign(null);
                              }
                            }}
                            disabled={availableProfiles.length === 0}
                            className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            title={
                              availableProfiles.length === 0
                                ? "No profiles you can assign"
                                : "Add profile"
                            }
                          >
                            <Plus className="h-3 w-3" />
                          </button>

                          {profileSelectOpen === bidder.id ? (
                            <div
                              ref={(element) => {
                                if (element) {
                                  dropdownRefs.current.set(bidder.id, element);
                                } else {
                                  dropdownRefs.current.delete(bidder.id);
                                }
                              }}
                              className="absolute left-0 top-full z-[100] mt-2 min-w-[220px] rounded-xl border border-slate-300 bg-white shadow-xl"
                            >
                              {availableProfiles.length > 0 ? (
                                <>
                                  <div className="max-h-60 overflow-y-auto p-1">
                                    {availableProfiles.map((profile) => {
                                      const isSelected =
                                        selectedProfileForAssign?.bidderId === bidder.id &&
                                        selectedProfileForAssign?.profileId === profile.id;
                                      return (
                                        <button
                                          key={profile.id}
                                          type="button"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            setSelectedProfileForAssign({
                                              bidderId: bidder.id,
                                              profileId: profile.id,
                                            });
                                          }}
                                          className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                                            isSelected
                                              ? "bg-slate-100 font-medium text-slate-900"
                                              : "text-slate-700 hover:bg-slate-50"
                                          }`}
                                        >
                                          {profile.displayName}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  {selectedProfileForAssign?.bidderId === bidder.id ? (
                                    <div className="border-t border-slate-200 p-2">
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          if (!selectedProfileForAssign) return;
                                          setPendingAssign(selectedProfileForAssign);
                                          setConfirmAssignOpen(true);
                                          setProfileSelectOpen(null);
                                          setSelectedProfileForAssign(null);
                                        }}
                                        className="w-full rounded-lg bg-[#6366f1] px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110"
                                      >
                                        Add
                                      </button>
                                    </div>
                                  ) : null}
                                </>
                              ) : (
                                <div className="p-3 text-xs text-slate-500">
                                  No profiles you can assign
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {confirmAssignOpen && pendingAssign ? (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4 py-6">
              <div
                className="w-full max-w-md rounded-3xl border-2 border-amber-200 bg-amber-50 p-6 shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="mb-4">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-amber-700">
                    Confirm assignment
                  </p>
                  <h3 className="mt-1 text-xl font-semibold text-amber-900">
                    Assign profile &quot;
                    {profiles.find((profile) => profile.id === pendingAssign.profileId)?.displayName || "Unknown"}
                    &quot; to {bidders.find((bidder) => bidder.id === pendingAssign.bidderId)?.userName || "Unknown"}?
                  </h3>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => {
                      setConfirmAssignOpen(false);
                      setPendingAssign(null);
                    }}
                    disabled={assigning}
                    className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-rose-300 bg-rose-500 text-white shadow-sm transition hover:border-rose-400 hover:bg-rose-600 disabled:opacity-60"
                    title="No, cancel"
                  >
                    <X className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => {
                      if (!pendingAssign) return;
                      void handleAssign(pendingAssign.bidderId, pendingAssign.profileId);
                    }}
                    disabled={assigning}
                    className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-emerald-300 bg-emerald-500 text-white shadow-sm transition hover:border-emerald-400 hover:bg-emerald-600 disabled:opacity-60"
                    title="Yes, confirm"
                  >
                    {assigning ? <span className="h-5 w-5 animate-spin">...</span> : <Check className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {confirmUnassignOpen && pendingUnassign ? (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4 py-6">
              <div
                className="w-full max-w-md rounded-3xl border-2 border-amber-200 bg-amber-50 p-6 shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="mb-4">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-amber-700">
                    Confirm removal
                  </p>
                  <h3 className="mt-1 text-xl font-semibold text-amber-900">
                    Remove profile &quot;
                    {bidders
                      .find((bidder) => bidder.id === pendingUnassign.bidderId)
                      ?.profiles.find((profile) => profile.id === pendingUnassign.profileId)?.displayName || "Unknown"}
                    &quot; from {bidders.find((bidder) => bidder.id === pendingUnassign.bidderId)?.userName || "Unknown"}?
                  </h3>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => {
                      setConfirmUnassignOpen(false);
                      setPendingUnassign(null);
                    }}
                    disabled={assigning}
                    className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-rose-300 bg-rose-500 text-white shadow-sm transition hover:border-rose-400 hover:bg-rose-600 disabled:opacity-60"
                    title="No, cancel"
                  >
                    <X className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => {
                      if (!pendingUnassign) return;
                      void handleUnassign(pendingUnassign.profileId);
                    }}
                    disabled={assigning}
                    className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-emerald-300 bg-emerald-500 text-white shadow-sm transition hover:border-emerald-400 hover:bg-emerald-600 disabled:opacity-60"
                    title="Yes, confirm"
                  >
                    {assigning ? <span className="h-5 w-5 animate-spin">...</span> : <Check className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </ManagerShell>
  );
}
