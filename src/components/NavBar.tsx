"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-6 py-3">
      <Link href="/" className="text-base font-bold tracking-tight text-white">
        Agent Foundry
      </Link>
      <div className="flex items-center gap-6">
        <Link
          href="/"
          className={`text-sm transition-colors ${
            pathname === "/"
              ? "text-white"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Generate
        </Link>
        <Link
          href="/pipelines"
          className={`text-sm transition-colors ${
            pathname.startsWith("/pipelines")
              ? "text-white"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Pipelines
        </Link>
        <Link
          href="/runs"
          className={`text-sm transition-colors ${
            pathname.startsWith("/runs")
              ? "text-white"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Runs
        </Link>
      </div>
    </nav>
  );
}
