import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Auth-aware Supabase server client.
 * Uses the anon key + cookies so it respects RLS and sees the user's session.
 * Use this for auth checks. Use createSupabaseServerClient() (service role) for
 * admin operations that need to bypass RLS.
 */
export async function createSupabaseAuthClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          try {
            cookieStore.set(name, value, options);
          } catch {
            // Safe to ignore in Server Components
          }
        }
      },
    },
  });
}

/**
 * Get the current authenticated user, or null if not logged in.
 */
export async function getAuthUser() {
  const supabase = await createSupabaseAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Get the current user's role from user_profiles, or null.
 */
export async function getUserRole(): Promise<"admin" | "member" | null> {
  const user = await getAuthUser();
  if (!user) return null;

  const supabase = await createSupabaseAuthClient();
  const { data } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return (data?.role as "admin" | "member") ?? null;
}
