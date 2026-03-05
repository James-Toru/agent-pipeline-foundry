import Link from "next/link";
import { Home, SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-zinc-100 animate-fade-up">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-900 ring-1 ring-white/6 mb-6">
        <SearchX className="size-8 text-zinc-500" />
      </div>

      <p className="text-[80px] font-bold leading-none tracking-tighter text-transparent bg-clip-text bg-linear-to-b from-zinc-600 to-zinc-800 select-none mb-4">
        404
      </p>

      <h1 className="text-lg font-semibold text-white mb-1">Page not found</h1>
      <p className="text-sm text-zinc-500 mb-8">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>

      <Link
        href="/"
        className="flex items-center gap-2 rounded-xl bg-linear-to-b from-zinc-700 to-zinc-800 hover:from-zinc-600 hover:to-zinc-700 px-5 py-2.5 text-sm font-medium text-white ring-1 ring-white/8 shadow-lg transition-all duration-200"
      >
        <Home className="size-4" />
        Back to Dashboard
      </Link>
    </div>
  );
}
