import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-zinc-100">
      <h1 className="text-6xl font-bold text-zinc-700">404</h1>
      <p className="mt-4 text-lg text-zinc-400">Page not found.</p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200"
      >
        Go to Dashboard
      </Link>
    </div>
  );
}
