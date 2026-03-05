"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Cpu,
  Sparkles,
  GitBranch,
  LayoutTemplate,
  PlayCircle,
  BarChart2,
  Settings2,
} from "lucide-react";

const NAV_LINKS = [
  { href: "/", label: "Generate", icon: Sparkles, exact: true },
  { href: "/pipelines", label: "Pipelines", icon: GitBranch, exact: false },
  { href: "/templates", label: "Templates", icon: LayoutTemplate, exact: false },
  { href: "/runs", label: "Runs", icon: PlayCircle, exact: false },
  { href: "/analytics", label: "Analytics", icon: BarChart2, exact: false },
  { href: "/settings", label: "Settings", icon: Settings2, exact: false },
];

export default function NavBar() {
  const pathname = usePathname();

  function isActive(href: string, exact: boolean) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-white/6 bg-zinc-950/80 backdrop-blur-xl px-6 py-2.5">
      <Link
        href="/"
        className="flex items-center gap-2 text-base font-bold tracking-tight text-white"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-linear-to-b from-blue-500 to-blue-600 shadow-md shadow-blue-500/20">
          <Cpu className="size-4 text-white" />
        </div>
        Agent Foundry
      </Link>

      <div className="flex items-center gap-1">
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
      </div>
    </nav>
  );
}
