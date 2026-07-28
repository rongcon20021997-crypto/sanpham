import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface Body {
  action: "list" | "create" | "update" | "delete";
  userId?: string;
  email?: string;
  password?: string;
  fullName?: string;
  phone?: string;
  role?: "admin" | "staff";
  status?: "active" | "disabled";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Authenticate caller via their JWT
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } =
      await supabase.auth.getUser(token);

    if (authError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check caller is admin
    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (!callerProfile || callerProfile.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Forbidden — admin role required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: Body = await req.json();

    // ---- LIST ----
    if (body.action === "list") {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, phone, role, status, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- CREATE ----
    if (body.action === "create") {
      const { email, password, fullName, phone, role } = body;
      if (!email || !password) {
        return new Response(
          JSON.stringify({ error: "Email and password are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const { data: authData, error: createError } =
        await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName || "" },
        });
      if (createError) throw createError;

      const newId = authData.user.id;
      // Update profile with extra fields
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: fullName || null,
          phone: phone || null,
          role: role || "staff",
        })
        .eq("id", newId);
      if (profileError) throw profileError;

      return new Response(
        JSON.stringify({ data: { id: newId, email } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- UPDATE ----
    if (body.action === "update") {
      const { userId, fullName, phone, role, status } = body;
      if (!userId) {
        return new Response(
          JSON.stringify({ error: "userId is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const updates: Record<string, string> = {};
      if (fullName !== undefined) updates.full_name = fullName;
      if (phone !== undefined) updates.phone = phone;
      if (role !== undefined) updates.role = role;
      if (status !== undefined) updates.status = status;

      const { data, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", userId)
        .select("id, email, full_name, phone, role, status, created_at")
        .maybeSingle();
      if (error) throw error;

      // If disabling user, ban them in auth; if enabling, unban
      if (status === "disabled") {
        await supabase.auth.admin.updateUserById(userId, { ban_duration: "8760h" });
      } else if (status === "active") {
        await supabase.auth.admin.updateUserById(userId, { ban_duration: "none" });
      }

      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- DELETE ----
    if (body.action === "delete") {
      const { userId } = body;
      if (!userId) {
        return new Response(
          JSON.stringify({ error: "userId is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) throw error;
      return new Response(JSON.stringify({ data: { id: userId } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
