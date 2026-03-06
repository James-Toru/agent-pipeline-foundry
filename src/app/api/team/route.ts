import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getAuthUser, getUserRole } from "@/lib/supabase-auth";

// GET /api/team — List all team members (admin only)
export async function GET() {
  const role = await getUserRole();
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, email, role, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/team — Invite a new team member (admin only)
// Body: { email: string, password: string, role?: "admin" | "member" }
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = await getUserRole();
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { email, password, role: memberRole = "member" } = body;

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
  }

  if (!["admin", "member"].includes(memberRole)) {
    return NextResponse.json(
      { error: "Role must be admin or member" },
      { status: 400 }
    );
  }

  // Use the service role client to create the user via admin API
  const supabase = await createSupabaseServerClient();

  const { data: newUser, error: createError } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 400 });
  }

  // Update the auto-created profile's role if it's not the default
  if (memberRole !== "member" && newUser.user) {
    await supabase
      .from("user_profiles")
      .update({ role: memberRole })
      .eq("id", newUser.user.id);
  }

  return NextResponse.json({
    id: newUser.user?.id,
    email,
    role: memberRole,
  });
}

// DELETE /api/team — Remove a team member (admin only)
// Body: { userId: string }
export async function DELETE(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = await getUserRole();
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { userId } = body;

  if (!userId) {
    return NextResponse.json(
      { error: "userId is required" },
      { status: 400 }
    );
  }

  // Prevent self-deletion
  if (userId === user.id) {
    return NextResponse.json(
      { error: "Cannot remove yourself" },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();

  const { error: deleteError } =
    await supabase.auth.admin.deleteUser(userId);

  if (deleteError) {
    return NextResponse.json(
      { error: deleteError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
