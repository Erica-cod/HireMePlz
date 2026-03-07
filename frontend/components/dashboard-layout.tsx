"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/profile", label: "Profile" },
  { href: "/dashboard/experiences", label: "Experiences" },
  { href: "/dashboard/stories", label: "Story Library" },
  { href: "/dashboard/answer-memory", label: "Answer Memory" },
  { href: "/dashboard/applications", label: "Applications" },
  { href: "/dashboard/jobs", label: "Job Matches" },
];

export function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  function handleLogout() {
    localStorage.removeItem("hiremeplz-token");
    router.push("/auth");
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r bg-white h-screen sticky top-0 p-4 flex flex-col">
        <Link href="/" className="text-xl font-bold mb-8 block">
          HireMePlz
        </Link>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
                pathname === item.href
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <button
          onClick={handleLogout}
          className="mt-auto text-sm text-gray-500 hover:text-gray-700 px-3 py-2"
        >
          Sign Out
        </button>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
