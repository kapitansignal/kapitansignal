import { NextResponse } from "next/server";
import { resolveBrandId } from "@/lib/brand-id";
import { asPositiveInt, createBillplzBill, getBillplzConfig } from "@/lib/billplz";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function mapAmountByDurationDays(durationDays: number) {
  if (durationDays <= 7) return asPositiveInt(process.env.BILLPLZ_AMOUNT_7_DAYS_CENTS, 4900);
  if (durationDays <= 15) return asPositiveInt(process.env.BILLPLZ_AMOUNT_15_DAYS_CENTS, 9900);
  return asPositiveInt(process.env.BILLPLZ_AMOUNT_30_DAYS_CENTS, 14900);
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const config = getBillplzConfig();
  if (!config) {
    return NextResponse.json({ error: "Billplz is not configured." }, { status: 400 });
  }

  const body = (await req.json()) as { name?: string; email?: string; phone?: string };
  const name = (body.name ?? "").trim().replace(/\s+/g, " ");
  const email = (body.email ?? "").trim().toLowerCase();
  const phone = (body.phone ?? "").trim();
  if (!name || !email || !phone) {
    return NextResponse.json({ error: "name, email and phone are required" }, { status: 400 });
  }

  const { token } = await params;
  const url = new URL(req.url);
  const brandId = resolveBrandId(req);
  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Missing admin env" }, { status: 500 });
  }

  const { data: linkData, error: linkError } = await admin
    .from("package_links")
    .select("duration_days, package_name")
    .eq("brand_id", brandId)
    .eq("token", token)
    .maybeSingle();
  if (linkError) return NextResponse.json({ error: linkError.message }, { status: 500 });
  if (!linkData) return NextResponse.json({ error: "Invalid or inactive link" }, { status: 404 });

  const durationDays = Number(linkData.duration_days);
  const amountCents = mapAmountByDurationDays(durationDays);
  const packageName = String(linkData.package_name ?? "Package");
  const callbackUrl = `${url.origin}/api/register/${token}/billplz/confirm`;
  const redirectUrl = `${url.origin}/register/${token}`;
  const description = `${brandId.toUpperCase()} ${packageName} (${Number.isFinite(durationDays) ? durationDays : "-"} days)`;

  const created = await createBillplzBill(config, {
    name,
    email,
    mobile: phone,
    amountCents,
    description,
    callbackUrl,
    redirectUrl,
    reference1: brandId,
    reference2: token,
  });

  if (!created.ok) {
    return NextResponse.json(
      { error: (created.json.error as string | undefined) ?? "Failed to create Billplz bill." },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    id: created.json.id,
    url: created.json.url,
  });
}
