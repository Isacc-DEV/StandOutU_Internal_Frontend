'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BookOpen, ClipboardList } from "lucide-react";
import TopNav from "./TopNav";
import { useRouter } from "next/navigation";

const links = [
  { href: "/work-book/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/work-book", label: "Work book", icon: BookOpen },
  { href: "/work-book/my-applications", label: "My applications", icon: ClipboardList },
];

export default function WorkbookShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#f8fafc] via-[#f1f5f9] to-white text-slate-900">
      <TopNav />
      <div className="mx-auto w-full min-h-screen pt-[57px]">
        <div className="grid min-h-screen gap-4 xl:grid-cols-[280px_1fr]">
          <section
            className="flex flex-col gap-2 bg-[#0b1224] text-slate-100"
            style={{ boxShadow: "0 10px 15px -3px rgba(99,102,241,0.5), -4px -1px 20px 2px #0b1224" }}
          >
            <div className="p-4 space-y-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.26em] text-slate-400">Workspace</p>
                <h1 className="text-lg font-semibold text-slate-100">Navigation</h1>
              </div>
              <div className="space-y-1">
                {links.map((link) => {
                  const Icon = link.icon;
                  const active =
                    pathname === link.href ||
                    pathname === `${link.href}/` ||
                    (link.href !== "/work-book" && pathname.startsWith(`${link.href}/`));
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                        active
                          ? "bg-slate-700 text-white"
                          : "text-slate-300 hover:bg-slate-800/50 hover:text-white"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="flex-1 text-left">{link.label}</span>
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
