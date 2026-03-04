import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createSupabaseServerClient() {
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

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, serviceRoleKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          try {
            cookieStore.set(name, value, options);
          } catch {
            // setAll can fail when called from a Server Component.
            // This is safe to ignore if middleware is refreshing sessions.
          }
        }
      },
    },
  });
}
