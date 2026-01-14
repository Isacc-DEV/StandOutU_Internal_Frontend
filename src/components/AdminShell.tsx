'use client';
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, UserPlus, Hash, Tags, FileText, UserX } from "lucide-react";
import TopNav from "./TopNav";

const links = [
  { href: "/admin/users", label: "Manage users", icon: Users },
  { href: "/admin/join-requests", label: "Join requests", icon: UserPlus },
  { href: "/admin/banned-users", label: "Banned users", icon: UserX },
  { href: "/admin/channels", label: "Channels", icon: Hash },
  { href: "/admin/label-aliases", label: "Label tags", icon: Tags },
  { href: "/admin/application-phrases", label: "Application phrases", icon: FileText },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#f4f8ff] via-[#eef2ff] to-white text-slate-900">
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
                  <p className="text-[11px] uppercase tracking-[0.26em] text-slate-400">Admin</p>
                  <h1 className="text-lg font-semibold text-slate-100">Administration</h1>
                </div>
              </div>
              <div className="space-y-1">
                {links.map((link) => {
                  const active = pathname.startsWith(link.href);
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                        active
                          ? 'bg-slate-700 text-white'
                          : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{link.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
          <section className="flex-1 px-4 py-6">{children}</section>
        </div>
      </div>
    </main>
  );
}
