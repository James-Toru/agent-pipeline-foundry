import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || supabaseUrl === "your_supabase_project_url_here") {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is not set. Add your Supabase project URL to .env.local."
    );
  }

  if (!supabaseAnonKey || supabaseAnonKey === "your_supabase_anon_key_here") {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. Add your Supabase anon key to .env.local."
    );
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
