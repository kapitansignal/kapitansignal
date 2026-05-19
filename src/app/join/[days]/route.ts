import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { resolveBrandId } from "@/lib/brand-id";

function parseDays(raw: string) {
  const days = Number(raw);
  if (!Number.isFinite(days)) return 0;
  return Math.round(days);
}

function readDurationDays(row: Record<string, unknown>) {
  const explicit = Number(row.duration_days);
  if (Number.isFinite(explicit) && explicit > 0) return Math.round(explicit);

  const match = String(row.package_name ?? "").match(/(?:^|\D)(\d{1,4})\s*d(?:ays?)?/i);
  if (match) return Number(match[1]);

  return 0;
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
    .select("*")
    .eq("brand_id", brandId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const links = Array.isArray(data) ? data : [];
  const matched = links.find((row) => readDurationDays((row as Record<string, unknown>)) === days) as
    | { token?: string }
    | undefined;

  if (!matched?.token) {
    return NextResponse.json(
      { error: `No active ${days}-day package link found. Please create one in Admin > Package Links.` },
      { status: 404 },
    );
  }

  const url = new URL(req.url);
  return NextResponse.redirect(`${url.origin}/register/${matched.token}`);
}
