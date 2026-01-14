'use client';
import { useCallback, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Minus, Check } from "lucide-react";
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
};

export default function ManagerBiddersPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [bidders, setBidders] = useState<BidderSummary[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [error, setError] = useState("");
  const [pendingAssign, setPendingAssign] = useState<{bidderId: string, profileId: string} | null>(null);
  const [pendingUnassign, setPendingUnassign] = useState<{bidderId: string, profileId: string} | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [confirmAssignOpen, setConfirmAssignOpen] = useState(false);
  const [confirmUnassignOpen, setConfirmUnassignOpen] = useState(false);
  const [profileSelectOpen, setProfileSelectOpen] = useState<string | null>(null);
  const [selectedProfileForAssign, setSelectedProfileForAssign] = useState<{bidderId: string, profileId: string} | null>(null);
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
    if (profileSelectOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData(token);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProfiles(token);
  }, [loading, user, token, router, loadData, loadProfiles]);

  async function handleAssign(bidderId: string, profileId: string) {
    if (!token || !user) return;
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
      await loadData(token);
      setConfirmAssignOpen(false);
      setPendingAssign(null);
      setProfileSelectOpen(null);
      setSelectedProfileForAssign(null);
    } catch (err: any) {
      console.error(err);
      const message = err?.message || "Failed to assign profile.";
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

  async function handleUnassign(bidderId: string, profileId: string) {
    if (!token) return;
    setAssigning(true);
    setError("");
    try {
      await api(`/assignments/${profileId}/unassign`, { method: "POST", body: "{}" }, token);
      await loadData(token);
      setConfirmUnassignOpen(false);
      setPendingUnassign(null);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to unassign profile.");
      setConfirmUnassignOpen(false);
      setPendingUnassign(null);
    } finally {
      setAssigning(false);
    }
  }

  function getAvailableProfiles(bidderId: string) {
    const bidder = bidders.find(b => b.id === bidderId);
    const assignedProfileIds = new Set(bidder?.profiles.map(p => p.id) || []);
    return profiles.filter(p => !assignedProfileIds.has(p.id));
  }

  return (
    <ManagerShell>
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Manager</p>
          <h1 className="text-3xl font-semibold text-slate-900">Bidder roster</h1>
          <p className="text-sm text-slate-600">Track bidder assignments pulled from the database.</p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-400/50 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-3 bg-slate-50 px-4 py-3 text-xs uppercase tracking-[0.14em] text-slate-600">
            <div>Name</div>
            <div>Profiles</div>
          </div>
          <div className="divide-y divide-slate-200">
            {bidders.length === 0 ? (
              <div className="px-4 py-6 text-sm text-slate-600">No bidders found.</div>
            ) : (
              bidders.map((b) => {
                const availableProfiles = getAvailableProfiles(b.id);
                return (
                  <div key={b.id} className="grid grid-cols-3 items-center px-4 py-3 text-sm text-slate-800">
                    <div className="font-semibold text-slate-900">{b.userName}</div>
                    <div className="text-slate-700 flex items-center gap-2 flex-wrap relative">
                      {b.profiles.length === 0 ? (
                        <span className="text-slate-500 text-xs">Unassigned</span>
                      ) : (
                        <div className="flex flex-wrap gap-1 text-xs">
                          {b.profiles.map((p) => (
                            <span
                              key={p.id}
                              className="group relative inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-slate-800"
                            >
                              {p.displayName}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPendingUnassign({ bidderId: b.id, profileId: p.id });
                                  setConfirmUnassignOpen(true);
                                }}
                                className="ml-1 flex h-3 w-3 items-center justify-center rounded-full bg-slate-200 text-slate-600 opacity-0 transition-opacity hover:bg-slate-300 group-hover:opacity-100"
                                title="Remove profile"
                              >
                                <X className="h-2 w-2" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const newState = profileSelectOpen === b.id ? null : b.id;
                            console.log('Plus clicked, bidder:', b.id, 'availableProfiles:', availableProfiles.length, 'newState:', newState);
                            setProfileSelectOpen(newState);
                            if (newState === null) {
                              setSelectedProfileForAssign(null);
                            }
                          }}
                          className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-slate-400"
                          title="Add profile"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        {profileSelectOpen === b.id && (
                          <div 
                            ref={(el) => {
                              if (el) {
                                dropdownRefs.current.set(b.id, el);
                                console.log('Dropdown rendered for bidder:', b.id, 'availableProfiles:', availableProfiles.length);
                              } else {
                                dropdownRefs.current.delete(b.id);
                              }
                            }}
                            className="absolute left-0 top-full mt-2 z-[100] min-w-[200px] rounded-xl border-2 border-slate-300 bg-white shadow-xl"
                          >
                            {availableProfiles.length > 0 ? (
                              <>
                                <div className="max-h-60 overflow-y-auto p-1">
                                  {availableProfiles.map((profile) => {
                                    const isSelected = selectedProfileForAssign?.bidderId === b.id && selectedProfileForAssign?.profileId === profile.id;
                                    return (
                                      <button
                                        key={profile.id}
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedProfileForAssign({ bidderId: b.id, profileId: profile.id });
                                        }}
                                        className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                                          isSelected
                                            ? "bg-slate-100 text-slate-900 font-medium"
                                            : "text-slate-700 hover:bg-slate-50"
                                        }`}
                                      >
                                        {profile.displayName}
                                      </button>
                                    );
                                  })}
                                </div>
                                {selectedProfileForAssign?.bidderId === b.id && (
                                  <div className="border-t border-slate-200 p-2">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (selectedProfileForAssign) {
                                          setPendingAssign(selectedProfileForAssign);
                                          setConfirmAssignOpen(true);
                                          setProfileSelectOpen(null);
                                          setSelectedProfileForAssign(null);
                                        }
                                      }}
                                      className="w-full rounded-lg bg-[#6366f1] px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110"
                                    >
                                      Add
                                    </button>
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="p-3 text-xs text-slate-500">
                                No available profiles
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {confirmAssignOpen && pendingAssign && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4 py-6">
            <div
              className="w-full max-w-md rounded-3xl border-2 border-amber-200 bg-amber-50 p-6 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-amber-700">Confirm assignment</p>
                <h3 className="text-xl font-semibold text-amber-900 mt-1">
                  Assign profile "{profiles.find(p => p.id === pendingAssign.profileId)?.displayName || "Unknown"}" to {bidders.find(b => b.id === pendingAssign.bidderId)?.userName || "Unknown"}?
                </h3>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    setConfirmAssignOpen(false);
                    setPendingAssign(null);
                  }}
                  disabled={assigning}
                  className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-rose-300 bg-rose-500 text-white shadow-sm transition hover:bg-rose-600 hover:border-rose-400 disabled:opacity-60"
                  title="No, cancel"
                >
                  <X className="w-5 h-5" />
                </button>
                <button
                  onClick={() => {
                    if (pendingAssign) {
                      void handleAssign(pendingAssign.bidderId, pendingAssign.profileId);
                    }
                  }}
                  disabled={assigning}
                  className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-emerald-300 bg-emerald-500 text-white shadow-sm transition hover:bg-emerald-600 hover:border-emerald-400 disabled:opacity-60"
                  title="Yes, confirm"
                >
                  {assigning ? (
                    <span className="w-5 h-5 animate-spin">⏳</span>
                  ) : (
                    <Check className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {confirmUnassignOpen && pendingUnassign && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4 py-6">
            <div
              className="w-full max-w-md rounded-3xl border-2 border-amber-200 bg-amber-50 p-6 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-amber-700">Confirm removal</p>
                <h3 className="text-xl font-semibold text-amber-900 mt-1">
                  Remove profile "{bidders.find(b => b.id === pendingUnassign.bidderId)?.profiles.find(p => p.id === pendingUnassign.profileId)?.displayName || "Unknown"}" from {bidders.find(b => b.id === pendingUnassign.bidderId)?.userName || "Unknown"}?
                </h3>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    setConfirmUnassignOpen(false);
                    setPendingUnassign(null);
                  }}
                  disabled={assigning}
                  className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-rose-300 bg-rose-500 text-white shadow-sm transition hover:bg-rose-600 hover:border-rose-400 disabled:opacity-60"
                  title="No, cancel"
                >
                  <X className="w-5 h-5" />
                </button>
                <button
                  onClick={() => {
                    if (pendingUnassign) {
                      void handleUnassign(pendingUnassign.bidderId, pendingUnassign.profileId);
                    }
                  }}
                  disabled={assigning}
                  className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-emerald-300 bg-emerald-500 text-white shadow-sm transition hover:bg-emerald-600 hover:border-emerald-400 disabled:opacity-60"
                  title="Yes, confirm"
                >
                  {assigning ? (
                    <span className="w-5 h-5 animate-spin">⏳</span>
                  ) : (
                    <Check className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ManagerShell>
  );
}
