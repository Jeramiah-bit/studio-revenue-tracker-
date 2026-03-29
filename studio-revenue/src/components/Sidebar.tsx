"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  FileInput,
  Database,
  Wallet,
  Scale,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/data-input", label: "Data Input", icon: FileInput },
  { href: "/data", label: "Data", icon: Database },
  { href: "/cash-flow", label: "Cash Flow", icon: Wallet },
  { href: "/payouts", label: "Payouts", icon: Scale },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  studioName: string;
  userEmail: string;
}

export function Sidebar({ studioName, userEmail }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo & Studio Name */}
      <div className="px-6 pt-8 pb-6">
        <h1 className="text-lg font-bold text-[#113069] tracking-tight">
          StudioRevenue
        </h1>
        <p className="text-xs text-[#445D99] mt-0.5 truncate">{studioName}</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/data" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[#004CED]/8 text-[#004CED]"
                  : "text-[#445D99] hover:bg-[#F2F3FF] hover:text-[#113069]"
              }`}
            >
              <item.icon className="w-[18px] h-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="px-4 py-5 mt-auto">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#004CED] to-[#0042D1] flex items-center justify-center text-white text-xs font-semibold">
            {userEmail.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#113069] truncate">
              {userEmail}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="text-[#445D99] hover:text-[#9E3F4E] transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-white/70 backdrop-blur-xl shadow-[0px_20px_40px_rgba(17,48,105,0.06)] text-[#113069]"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-[#113069]/20 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-[#F2F3FF] transform transition-transform duration-200 ease-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 text-[#445D99]"
        >
          <X className="w-5 h-5" />
        </button>
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-60 bg-[#F2F3FF] flex-shrink-0">
        {sidebarContent}
      </aside>
    </>
  );
}
