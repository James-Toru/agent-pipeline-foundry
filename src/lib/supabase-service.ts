/**
 * Cookieless Supabase service client.
 *
 * Used by the orchestrator and routes that are called by external services
 * (VPS relay, webhooks) where no browser cookies are available.
 *
 * Uses the service role key directly — bypasses RLS, no cookie management.
 * For browser-initiated routes, use createSupabaseServerClient() instead.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

export async function createSupabaseServiceClient(): Promise<SupabaseClient> {
  if (cachedClient) return cachedClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || supabaseUrl === "your_supabase_project_url_here") {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is not set. Add your Supabase project URL to .env.local."
    );
  }

  if (
    !serviceRoleKey ||
    serviceRoleKey === "your_supabase_service_role_key_here"
  ) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Add your Supabase service role key to .env.local."
    );
  }

  cachedClient = createClient(supabaseUrl, serviceRoleKey);
  return cachedClient;
}
