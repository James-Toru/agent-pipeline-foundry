import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getUserRole } from "@/lib/supabase-auth";

export async function GET() {
  const role = await getUserRole();
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createSupabaseServerClient();

  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("id, email, role, created_at")
    .order("created_at", { ascending: true });

  // Use service role client for auth admin access
  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: authUsers } = await serviceClient.auth.admin.listUsers();

  const users =
    profiles?.map((profile) => {
      const authUser = authUsers?.users.find((u) => u.id === profile.id);
      return {
        ...profile,
        last_sign_in_at: authUser?.last_sign_in_at ?? null,
      };
    }) ?? [];

  return NextResponse.json({ users });
}
