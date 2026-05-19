import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { resolveBrandId } from "@/lib/brand-id";

function parseDays(raw: string) {
  const days = Number(raw);
  if (!Number.isFinite(days)) return 0;
  return Math.round(days);
}

export async function GET(req: Request, { params }: { params: Promise<{ days: string }> }) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Missing admin env" }, { status: 500 });
  }

  const { days: daysParam } = await params;
  const days = parseDays(daysParam);
  if (![7, 15, 30].includes(days)) {
    return NextResponse.json({ error: "Unsupported package duration." }, { status: 400 });
  }

  const brandId = resolveBrandId(req);
  const { data, error } = await admin
    .from("package_links")
    .select("token, created_at")
    .eq("brand_id", brandId)
    .eq("duration_days", days)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data?.token) {
    return NextResponse.json(
      { error: `No active ${days}-day package link found. Please create one in Admin > Package Links.` },
      { status: 404 },
    );
  }

  const url = new URL(req.url);
  return NextResponse.redirect(`${url.origin}/register/${data.token}`);
}

