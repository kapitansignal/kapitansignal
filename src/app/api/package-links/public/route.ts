import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { resolveBrandId } from "@/lib/brand-id";

function readDurationDays(row: Record<string, unknown>) {
  const explicit = Number(row.duration_days);
  if (Number.isFinite(explicit) && explicit > 0) return Math.round(explicit);

  const packageName = String(row.package_name ?? "");
  const taggedMatch = packageName.match(/(?:^|\D)(\d{1,4})\s*(?:d|day|days|hari)\b/i);
  if (taggedMatch) return Number(taggedMatch[1]);

  const numberMatch = packageName.match(/(?:^|\D)(\d{1,4})(?=\D|$)/);
  if (numberMatch) return Number(numberMatch[1]);

  return 0;
}

export async function GET(req: Request) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Missing admin env" }, { status: 500 });

  const brandId = resolveBrandId(req);
  const { data, error } = await admin
    .from("package_links")
    .select("*")
    .eq("brand_id", brandId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const targets: Record<string, string> = {};
  for (const row of data ?? []) {
    const record = row as Record<string, unknown>;
    const days = readDurationDays(record);
    const token = String(record.token ?? "");
    if ([7, 15, 30].includes(days) && token && !targets[String(days)]) {
      targets[String(days)] = `/r/${token}`;
    }
  }

  return NextResponse.json({ ok: true, data: targets });
}
