import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthClient } from "@/lib/supabase-auth";

/**
 * POST /api/auth/reset-password — Clear the must_reset_password flag.
 * The password itself is updated client-side via supabase.auth.updateUser().
 */
export async function POST() {
  const authClient = await createSupabaseAuthClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();

  const { error: profileError } = await supabase
    .from("user_profiles")
    .update({ must_reset_password: false })
    .eq("id", user.id);

  if (profileError) {
    return NextResponse.json(
      { error: profileError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
