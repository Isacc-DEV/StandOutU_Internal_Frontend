'use client';
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../lib/api";
import { ClientUser, saveAuth } from "../../lib/auth";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userName, setUserName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const path = mode === "signin" ? "/auth/login" : "/auth/signup";

      console.log("Submitting to", path);
      const body =
        mode === "signin" ? { email, password } : { email, password, userName: userName.trim() };
      const res = await api(path, {
        method: "POST",
        body: JSON.stringify(body),
      });
      
      if (mode === "signup") {
        // Signup returns message, not token - account is pending approval
        const { message } = res as { message?: string; user?: ClientUser };
        setError(message || "Account created. Please wait for admin approval before logging in.");
        // Clear form on success
        setEmail("");
        setPassword("");
        setUserName("");
        setMode("signin");
        return;
      }
      
      // Login flow
      const { user, token } = res as { user: ClientUser; token?: string };
      if (user && token) {
        saveAuth(user, token);
        router.replace("/workspace");
      }
    } catch (err) {
      console.error(err);
      if (err instanceof Error) {
        let message = err.message || "Authentication failed. Check your credentials.";
        try {
          const parsed = JSON.parse(err.message);
          if (parsed?.message) {
            message = parsed.message;
          }
        } catch {
          // Ignore JSON parse errors.
        }
        setError(message);
      } else {
        setError("Authentication failed. Check your credentials.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#0b1224] via-[#0f162b] to-[#111a32]">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-12">
        {/* Logo/Brand Section */}
        <div className="w-full text-center mb-8 space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-cyan-500 shadow-lg shadow-indigo-500/40 mb-2">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <p className="text-xs uppercase tracking-[0.3em] text-indigo-400 font-medium">
            SmartWork
          </p>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">
            {mode === "signin" ? "Welcome back" : "Get started"}
          </h1>
          <p className="text-sm text-slate-400">
            {mode === "signin" 
              ? "Sign in to your account to continue" 
              : "Create your account to get started"}
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="w-full mb-6 inline-flex rounded-xl border border-slate-700/80 bg-slate-800/80 backdrop-blur-sm p-1.5 shadow-sm shadow-slate-900/50">
          <button
            onClick={() => {
              setMode("signin");
              setError("");
            }}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
              mode === "signin"
                ? "bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-md shadow-indigo-500/50"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
            }`}
          >
            Sign in
          </button>
          <button
            onClick={() => {
              setMode("signup");
              setError("");
            }}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
              mode === "signup"
                ? "bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-md shadow-indigo-500/50"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
            }`}
          >
            Sign up
          </button>
        </div>

        {/* Form Card */}
        <form 
          onSubmit={handleSubmit} 
          className="w-full space-y-4 rounded-2xl border border-slate-700/80 bg-slate-800/90 backdrop-blur-sm p-8 shadow-xl shadow-slate-900/50"
        >
          {mode === "signup" && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide">
                User Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <input
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Enter your username"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-900/50 border border-slate-700 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                </svg>
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-900/50 border border-slate-700 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full pl-10 pr-12 py-3 rounded-xl bg-slate-900/50 border border-slate-700 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPassword ? (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.736m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-800/50 bg-gradient-to-r from-red-900/20 to-rose-900/20 px-4 py-3 text-sm text-red-400 flex items-start gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <svg className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="flex-1">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password || (mode === "signup" && !userName.trim())}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/50 transition-all duration-200 hover:shadow-xl hover:shadow-indigo-500/60 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-lg"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Please wait...
              </span>
            ) : (
              mode === "signin" ? "Sign in" : "Create account"
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="mt-6 text-xs text-slate-400 text-center">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </main>
  );
}
