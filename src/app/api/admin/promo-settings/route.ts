import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { resolveBrandId } from "@/lib/brand-id";

function toInt(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

export async function GET(req: Request) {
  if (!isAdminAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Missing admin env" }, { status: 500 });
  const brandId = resolveBrandId(req);

  const { data, error } = await admin
    .from("promo_settings")
    .select("*")
    .eq("brand_id", brandId)
    .maybeSingle();
  if (error) {
    const msg = String(error.message ?? "");
    if (msg.toLowerCase().includes("could not find the table")) {
      return NextResponse.json({ ok: true, data: null, warning: "promo_settings table is missing" });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, data: data ?? null });
}

export async function PATCH(req: Request) {
  if (!isAdminAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Missing admin env" }, { status: 500 });
  const brandId = resolveBrandId(req);

  const body = (await req.json()) as {
    promo_code?: string | null;
    amount_7_days_cents?: number | string | null;
    amount_15_days_cents?: number | string | null;
    amount_30_days_cents?: number | string | null;
    is_active?: boolean;
  };

  const payload = {
    brand_id: brandId,
    promo_code: (body.promo_code ?? "").trim() || null,
    amount_7_days_cents: toInt(body.amount_7_days_cents),
    amount_15_days_cents: toInt(body.amount_15_days_cents),
    amount_30_days_cents: toInt(body.amount_30_days_cents),
    is_active: Boolean(body.is_active),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await admin
    .from("promo_settings")
    .upsert(payload, { onConflict: "brand_id" })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, data });
}
