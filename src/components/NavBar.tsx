"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Cpu,
  Compass,
  Sparkles,
  GitBranch,
  LayoutTemplate,
  PlayCircle,
  BarChart2,
  Settings2,
  Menu,
  X,
} from "lucide-react";
import UserMenu from "@/components/UserMenu";

const NAV_LINKS = [
  { href: "/discover", label: "Discover", icon: Compass, exact: false },
  { href: "/", label: "Generate", icon: Sparkles, exact: true },
  { href: "/templates", label: "Templates", icon: LayoutTemplate, exact: false },
  { href: "/pipelines", label: "Pipelines", icon: GitBranch, exact: false },
  { href: "/runs", label: "Runs", icon: PlayCircle, exact: false },
  { href: "/analytics", label: "Analytics", icon: BarChart2, exact: false },
  { href: "/settings", label: "Settings", icon: Settings2, exact: false },
];

export default function NavBar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    }
    if (mobileOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [mobileOpen]);

  // Hide NavBar on login page
  if (pathname === "/login") return null;

  function isActive(href: string, exact: boolean) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  return (
    <nav ref={menuRef} className="sticky top-0 z-50 border-b border-white/6 bg-zinc-950/80 backdrop-blur-xl">
      <div className="flex items-center justify-between px-4 py-2.5 sm:px-6">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 text-base font-bold tracking-tight text-white"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-linear-to-b from-blue-500 to-blue-600 shadow-md shadow-blue-500/20">
            <Cpu className="size-4 text-white" />
          </div>
          Agent Foundry
        </Link>

        {/* Desktop nav */}
        <div className="hidden lg:flex items-center gap-1">
          {NAV_LINKS.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150 ${
                  active
                    ? "bg-zinc-800 text-white shadow-sm"
                    : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300"
                }`}
              >
                <Icon className="size-3.5" />
                {label}
              </Link>
            );
          })}
          <div className="ml-2 border-l border-white/6 pl-2">
            <UserMenu />
          </div>
        </div>

        {/* Mobile: user menu + hamburger */}
        <div className="flex items-center gap-2 lg:hidden">
          <UserMenu />
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-white/6 bg-zinc-950/95 backdrop-blur-xl px-4 pb-4 pt-2 animate-fade-up">
          <div className="space-y-1">
            {NAV_LINKS.map(({ href, label, icon: Icon, exact }) => {
              const active = isActive(href, exact);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                    active
                      ? "bg-zinc-800 text-white"
                      : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                  }`}
                >
                  <Icon className="size-4" />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
