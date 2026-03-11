/**
 * VPS-compatible Supabase server client.
 *
 * This replaces the Next.js-specific supabase-server.ts which uses
 * cookies() from next/headers. On the VPS we use the service role key
 * directly — no cookie management needed since this is a headless
 * backend service.
 *
 * The tsconfig path alias ensures that all imports of
 * "@/lib/supabase-server" within the VPS service resolve to this file
 * instead of the Next.js version.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  if (cachedClient) return cachedClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || supabaseUrl === "your_supabase_project_url_here") {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is not set. Add your Supabase project URL to .env."
    );
  }

  if (
    !serviceRoleKey ||
    serviceRoleKey === "your_supabase_service_role_key_here"
  ) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Add your Supabase service role key to .env."
    );
  }

  cachedClient = createClient(supabaseUrl, serviceRoleKey);
  return cachedClient;
}
