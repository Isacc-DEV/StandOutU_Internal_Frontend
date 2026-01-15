'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Link2, BarChart3, Clock, RefreshCw, Globe, MapPin } from "lucide-react";
import TopNav from "../../components/TopNav";
import { useAuth } from "../../lib/useAuth";
import { fetchCountries, fetchJobLinks } from "./api";
import JobLinksFilters from "./components/JobLinksFilters";
import JobLinksList from "./components/JobLinksList";
import type { Country, DateRangeKey, JobLink } from "./types";
import { buildSinceIso, useDebouncedValue } from "./utils";
import { handleError } from "../../lib/errorHandler";

const DEFAULT_RANGE: DateRangeKey = "7d";
const DEFAULT_LIMIT = 50;

export default function JobLinksPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [countries, setCountries] = useState<Country[]>([]);
  const [links, setLinks] = useState<JobLink[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [selectedCountryId, setSelectedCountryId] = useState("all");
  const [range, setRange] = useState<DateRangeKey>(DEFAULT_RANGE);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [offset, setOffset] = useState(0);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const debouncedSearch = useDebouncedValue(search, 300);
  const since = useMemo(() => buildSinceIso(range), [range]);
  
  // Find country IDs for EU and US
  const euCountry = useMemo(() => 
    countries.find(c => c.name === "EU" || c.name === "Europe"), 
    [countries]
  );
  const usCountry = useMemo(() => 
    countries.find(c => c.name === "US" || c.name === "United States"), 
    [countries]
  );
  
  const parsedCountryId = useMemo(() => {
    if (selectedCountryId === "all") return undefined;
    if (selectedCountryId === "eu" && euCountry) return euCountry.id;
    if (selectedCountryId === "us" && usCountry) return usCountry.id;
    return undefined;
  }, [selectedCountryId, euCountry, usCountry]);

  useEffect(() => {
    if (loading) return;
    if (!user || !token) {
      router.replace("/auth");
    }
  }, [loading, user, token, router]);

  useEffect(() => {
    if (!token || user?.role === "OBSERVER") return;
    let active = true;
    const loadCountries = async () => {
      try {
        const result = await fetchCountries(token);
        if (!active) return;
        setCountries(result);
      } catch (err) {
        if (!active) return;
        handleError(err, 'An error occurred while loading countries. Please contact the administrator.');
      }
    };
    void loadCountries();
    return () => {
      active = false;
    };
  }, [token, user?.role]);

  useEffect(() => {
    setOffset(0);
  }, [debouncedSearch, selectedCountryId, range, limit]);

  const loadLinks = useCallback(async () => {
    if (!token || user?.role === "OBSERVER") return;
    setLoadingLinks(true);
    try {
      const response = await fetchJobLinks(
        {
          limit,
          offset,
          search: debouncedSearch || undefined,
          countryId: parsedCountryId,
          since
        },
        token
      );
      setLinks(Array.isArray(response.items) ? response.items : []);
      setTotal(typeof response.total === "number" ? response.total : 0);
      setLastUpdatedAt(new Date());
    } catch (err) {
      handleError(err, 'An error occurred while loading job links. Please contact the administrator.');
      setLinks([]);
      setTotal(0);
    } finally {
      setLoadingLinks(false);
    }
  }, [token, user?.role, limit, offset, debouncedSearch, parsedCountryId, since]);

  useEffect(() => {
    void loadLinks();
  }, [loadLinks]);

  const handleReset = () => {
    setSearch("");
    setSelectedCountryId("all");
    setRange(DEFAULT_RANGE);
    setLimit(DEFAULT_LIMIT);
    setOffset(0);
  };

  const handleOpenLink = useCallback(
    (url: string) => {
      router.push(`/workspace?jobUrl=${encodeURIComponent(url)}`);
    },
    [router]
  );

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = total === 0 ? 1 : Math.floor(offset / limit) + 1;
  const showingStart = total === 0 ? 0 : offset + 1;
  const showingEnd = Math.min(offset + links.length, total);
  const canPrev = offset > 0;
  const canNext = offset + limit < total;

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-[#f8fafc] via-[#f1f5f9] to-white text-slate-900">
        <TopNav />
        <div className="mx-auto w-full min-h-screen pt-[57px]">
          <div className="grid gap-4 min-h-screen xl:grid-cols-[280px_1fr]">
            <section
              className="flex flex-col gap-2 bg-[#0b1224] text-slate-100"
              style={{ boxShadow: '0 10px 15px -3px rgba(99,102,241,0.5), -4px -1px 20px 2px #0b1224' }}
            >
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.26em] text-slate-400">Job Links</p>
                    <h1 className="text-lg font-semibold text-slate-100">Filters</h1>
                  </div>
                </div>
              </div>
            </section>
            <section className="flex-1 px-4 py-6">
              <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-16 text-center text-sm text-slate-600">
                Loading job links...
              </div>
            </section>
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-[#f8fafc] via-[#f1f5f9] to-white text-slate-900">
        <TopNav />
        <div className="mx-auto w-full min-h-screen pt-[57px]">
          <div className="grid gap-4 min-h-screen xl:grid-cols-[280px_1fr]">
            <section
              className="flex flex-col gap-2 bg-[#0b1224] text-slate-100"
              style={{ boxShadow: '0 10px 15px -3px rgba(99,102,241,0.5), -4px -1px 20px 2px #0b1224' }}
            >
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.26em] text-slate-400">Job Links</p>
                    <h1 className="text-lg font-semibold text-slate-100">Filters</h1>
                  </div>
                </div>
              </div>
            </section>
            <section className="flex-1 px-4 py-6">
              <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-16 text-center text-sm text-slate-600">
                Redirecting to login...
              </div>
            </section>
          </div>
        </div>
      </main>
    );
  }

  if (user.role === "OBSERVER") {
    return (
      <main className="min-h-screen bg-gradient-to-b from-[#f8fafc] via-[#f1f5f9] to-white text-slate-900">
        <TopNav />
        <div className="mx-auto w-full min-h-screen pt-[57px]">
          <div className="grid gap-4 min-h-screen xl:grid-cols-[280px_1fr]">
            <section
              className="flex flex-col gap-2 bg-[#0b1224] text-slate-100"
              style={{ boxShadow: '0 10px 15px -3px rgba(99,102,241,0.5), -4px -1px 20px 2px #0b1224' }}
            >
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.26em] text-slate-400">Job Links</p>
                    <h1 className="text-lg font-semibold text-slate-100">Filters</h1>
                  </div>
                </div>
              </div>
            </section>
            <section className="flex-1 px-4 py-6">
              <div className="mx-auto w-full max-w-2xl">
                <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-lg">
                  <div className="mb-6">
                    <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                      <svg
                        className="h-10 w-10"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                      </svg>
                    </div>
                    <h1 className="mb-2 text-3xl font-bold text-slate-900">
                      Access Restricted
                    </h1>
                    <p className="text-slate-600">
                      You do not have permission to access job links.
                    </p>
                  </div>

                  <div className="mb-6 rounded-2xl bg-slate-50 p-6 text-left">
                    <h2 className="mb-3 text-sm font-semibold text-slate-900">
                      Why can't I access this page?
                    </h2>
                    <p className="mb-4 text-sm text-slate-600">
                      Your current role (
                      <span className="font-semibold text-slate-900">
                        {user.role}
                      </span>
                      ) has view-only permissions. Job link access requires an active
                      bidder or manager role.
                    </p>
                    <h2 className="mb-3 text-sm font-semibold text-slate-900">
                      How to get access
                    </h2>
                    <ul className="space-y-2 text-sm text-slate-600">
                      <li className="flex items-start gap-2">
                        <span className="mt-0.5 text-blue-600">{">"}</span>
                        <span>Contact your administrator to upgrade your role</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="mt-0.5 text-blue-600">{">"}</span>
                        <span>Request access through your manager</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="mt-0.5 text-blue-600">{">"}</span>
                        <span>Email support with your access request</span>
                      </li>
                    </ul>
                  </div>

                  <div className="flex justify-center gap-3">
                    <button
                      onClick={() => router.push("/")}
                      className="rounded-2xl bg-slate-900 px-6 py-3 font-semibold text-white transition hover:bg-slate-800"
                    >
                      Go to Dashboard
                    </button>
                    <button
                      onClick={() => router.push("/workspace")}
                      className="rounded-2xl border border-slate-200 px-6 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Go to Workspace
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#f8fafc] via-[#f1f5f9] to-white text-slate-900">
      <TopNav />
      <div className="mx-auto w-full min-h-screen pt-[57px]">
        <div className="grid gap-4 min-h-screen xl:grid-cols-[280px_1fr]">
          {/* Left Sidebar */}
          <section
            className="flex flex-col gap-2 bg-[#0b1224] text-slate-100"
            style={{ boxShadow: '0 10px 15px -3px rgba(99,102,241,0.5), -4px -1px 20px 2px #0b1224' }}
          >
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.26em] text-slate-400">Job Links</p>
                  <h1 className="text-lg font-semibold text-slate-100">Select the region</h1>
                </div>
              </div>
              <div className="space-y-1">
                <button
                  onClick={() => setSelectedCountryId("all")}
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                    selectedCountryId === "all"
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                  }`}
                >
                  <Globe className="w-5 h-5" />
                  <span>All</span>
                </button>
                <button
                  onClick={() => setSelectedCountryId("eu")}
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                    selectedCountryId === "eu"
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                  }`}
                >
                  <MapPin className="w-5 h-5" />
                  <span>EU</span>
                </button>
                <button
                  onClick={() => setSelectedCountryId("us")}
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                    selectedCountryId === "us"
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                  }`}
                >
                  <MapPin className="w-5 h-5" />
                  <span>US</span>
                </button>
              </div>
            </div>
          </section>
          
          {/* Main Content */}
          <section className="flex-1 px-4 py-6">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <header className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20">
              <Link2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">
                Job Links
              </p>
              <h1 className="mt-1 text-4xl font-bold tracking-tight text-slate-900">
                Fresh Jobs Feed
              </h1>
            </div>
          </div>
          <p className="max-w-2xl text-base leading-relaxed text-slate-600">
            Browse new job links and jump straight to the source page. Use filters
            to narrow by country, time range, or keyword.
          </p>
        </header>

        <section className="grid gap-5 md:grid-cols-3">
          <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/50 px-6 py-5 shadow-sm transition-all duration-300 hover:border-emerald-200 hover:shadow-md">
            <div className="absolute right-4 top-4 opacity-10 transition-opacity group-hover:opacity-20">
              <Link2 className="h-16 w-16 text-emerald-500" />
            </div>
            <div className="relative">
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                  <Link2 className="h-4 w-4" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                  Total Links
                </span>
              </div>
              <div className="text-3xl font-bold text-slate-900">{total.toLocaleString()}</div>
              <div className="mt-2 text-sm font-medium text-slate-500">
                Showing <span className="text-slate-700">{showingStart}</span> - <span className="text-slate-700">{showingEnd}</span>
              </div>
            </div>
          </div>
          <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/50 px-6 py-5 shadow-sm transition-all duration-300 hover:border-blue-200 hover:shadow-md">
            <div className="absolute right-4 top-4 opacity-10 transition-opacity group-hover:opacity-20">
              <BarChart3 className="h-16 w-16 text-blue-500" />
            </div>
            <div className="relative">
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                  <BarChart3 className="h-4 w-4" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                  Page
                </span>
              </div>
              <div className="text-3xl font-bold text-slate-900">
                {currentPage} <span className="text-lg font-normal text-slate-400">/ {totalPages}</span>
              </div>
              <div className="mt-2 text-sm font-medium text-slate-500">
                <span className="text-slate-700">{limit}</span> per page
              </div>
            </div>
          </div>
          <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/50 px-6 py-5 shadow-sm transition-all duration-300 hover:border-purple-200 hover:shadow-md">
            <div className="absolute right-4 top-4 opacity-10 transition-opacity group-hover:opacity-20">
              <Clock className="h-16 w-16 text-purple-500" />
            </div>
            <div className="relative">
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
                  <Clock className="h-4 w-4" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                  Last Updated
                </span>
              </div>
              <div className="text-3xl font-bold text-slate-900">
                {lastUpdatedAt ? (
                  <>
                    {lastUpdatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </>
                ) : (
                  <span className="text-lg font-normal text-slate-400">-</span>
                )}
              </div>
              <div className="mt-2 text-sm font-medium text-slate-500">
                {lastUpdatedAt ? lastUpdatedAt.toLocaleDateString() : "Not loaded yet"}
              </div>
            </div>
          </div>
        </section>

        <JobLinksFilters
          search={search}
          onSearchChange={setSearch}
          range={range}
          onRangeChange={setRange}
          pageSize={limit}
          onPageSizeChange={setLimit}
          onReset={handleReset}
          onRefresh={loadLinks}
          loading={loadingLinks}
        />

        <JobLinksList
          items={links}
          loading={loadingLinks}
          startIndex={offset}
          onOpenLink={handleOpenLink}
        />

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/30 px-6 py-5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600">
              Showing <span className="font-semibold text-slate-900">{showingStart}</span> - <span className="font-semibold text-slate-900">{showingEnd}</span> of <span className="font-semibold text-slate-900">{total.toLocaleString()}</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={!canPrev}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition-all duration-200 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:bg-white disabled:hover:text-slate-700 disabled:hover:shadow-sm"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2">
              <span className="text-sm font-semibold text-slate-700">
                Page {currentPage} of {totalPages}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setOffset(offset + limit)}
              disabled={!canNext}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition-all duration-200 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:bg-white disabled:hover:text-slate-700 disabled:hover:shadow-sm"
              aria-label="Next page"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
