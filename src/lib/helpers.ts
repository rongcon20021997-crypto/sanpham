import { createClient } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Profile } from "./types";

export async function uploadFile(
  file: File,
  folder: string
): Promise<string | null> {
  const ext = file.name.split(".").pop() || "png";
  const fileName = `${folder}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${ext}`;
  const { error } = await supabase.storage
    .from("tshirt-assets")
    .upload(fileName, file, { cacheControl: "3600", upsert: false });
  if (error) {
    console.error("Upload error:", error.message);
    return null;
  }
  const { data } = supabase.storage
    .from("tshirt-assets")
    .getPublicUrl(fileName);
  return data.publicUrl;
}

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatDate(s: string): string {
  return new Date(s).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    });
}

export function usernameToEmail(username: string): string {
  const trimmed = username.trim().toLowerCase();
  if (trimmed.includes("@")) return trimmed;
  return `${trimmed}@gmail.com`;
}

export function emailToUsername(email: string): string {
  if (!email) return "";
  if (email.endsWith("@gmail.com")) return email.slice(0, -10);
  if (email.endsWith("@app.com")) return email.slice(0, -8);
  if (email.endsWith("@app.local")) return email.slice(0, -10);
  if (email.includes("@")) return email.split("@")[0];
  return email;
}

export async function fetchProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function callUserManagement<T>(payload: Record<string, unknown>): Promise<T> {
  const action = payload.action as string;

  if (action === "list") {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { data } as unknown as T;
  }

  if (action === "update") {
    const userId = payload.userId as string;
    const updates: Record<string, unknown> = {};
    if (payload.fullName !== undefined) updates.full_name = payload.fullName;
    if (payload.phone !== undefined) updates.phone = payload.phone;
    if (payload.role !== undefined) updates.role = payload.role;
    if (payload.status !== undefined) updates.status = payload.status;

    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return { data } as unknown as T;
  }

  if (action === "delete") {
    const userId = payload.userId as string;
    const { error } = await supabase
      .from("profiles")
      .delete()
      .eq("id", userId);
    if (error) throw error;
    return { data: { id: userId } } as unknown as T;
  }

  if (action === "create") {
    const email = payload.email as string;
    const password = payload.password as string;
    const fullName = (payload.fullName as string) || "";
    const phone = (payload.phone as string) || "";
    const role = (payload.role as string) || "staff";

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    });

    const { data: authData, error: authErr } = await tempClient.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (authErr) throw authErr;

    if (authData.user) {
      await supabase
        .from("profiles")
        .update({
          full_name: fullName || null,
          phone: phone || null,
          role: role || "staff",
        })
        .eq("id", authData.user.id);

      return { data: { id: authData.user.id, email } } as unknown as T;
    }
  }

  throw new Error("Action không hợp lệ");
}

