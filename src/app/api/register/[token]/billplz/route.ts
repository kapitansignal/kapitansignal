import { NextResponse } from "next/server";
import { resolveBrandId } from "@/lib/brand-id";
import { asPositiveInt, createBillplzBill, getBillplzConfig } from "@/lib/billplz";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function readDurationDays(row: Record<string, unknown>, fallback = 7) {
  const explicit = Number(row.duration_days);
  if (Number.isFinite(explicit) && explicit > 0) return Math.round(explicit);

  const match = String(row.package_name ?? "").match(/(?:^|\D)(\d{1,4})\s*d(?:ays?)?/i);
  if (match) return Number(match[1]);

  return fallback;
}

function mapAmountByDurationDays(durationDays: number) {
  if (durationDays <= 7) return asPositiveInt(process.env.BILLPLZ_AMOUNT_7_DAYS_CENTS, 4900);
  if (durationDays <= 15) return asPositiveInt(process.env.BILLPLZ_AMOUNT_15_DAYS_CENTS, 9900);
  return asPositiveInt(process.env.BILLPLZ_AMOUNT_30_DAYS_CENTS, 14900);
}

function mapPromoAmountByDurationDays(durationDays: number) {
  if (durationDays <= 7) return asPositiveInt(process.env.BILLPLZ_PROMO_AMOUNT_7_DAYS_CENTS, 0);
  if (durationDays <= 15) return asPositiveInt(process.env.BILLPLZ_PROMO_AMOUNT_15_DAYS_CENTS, 0);
  return asPositiveInt(process.env.BILLPLZ_PROMO_AMOUNT_30_DAYS_CENTS, 0);
}

function mapPromoAmountByDurationDaysFromDb(
  durationDays: number,
  settings: Record<string, unknown> | null,
) {
  if (!settings) return 0;
  if (durationDays <= 7) return asPositiveInt(String(settings.amount_7_days_cents ?? ""), 0);
  if (durationDays <= 15) return asPositiveInt(String(settings.amount_15_days_cents ?? ""), 0);
  return asPositiveInt(String(settings.amount_30_days_cents ?? ""), 0);
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const config = getBillplzConfig();
  if (!config) {
    return NextResponse.json({ error: "Billplz is not configured." }, { status: 400 });
  }

  const body = (await req.json()) as { name?: string; email?: string; phone?: string; promo_code?: string };
  const name = (body.name ?? "").trim().replace(/\s+/g, " ");
  const email = (body.email ?? "").trim().toLowerCase();
  const phone = (body.phone ?? "").trim();
  const promoCodeInput = (body.promo_code ?? "").trim();
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
    .select("*")
    .eq("brand_id", brandId)
    .eq("token", token)
    .maybeSingle();
  if (linkError) return NextResponse.json({ error: linkError.message }, { status: 500 });
  if (!linkData) return NextResponse.json({ error: "Invalid or inactive link" }, { status: 404 });

  const durationDays = readDurationDays(linkData as Record<string, unknown>);
  const baseAmountCents = mapAmountByDurationDays(durationDays);
  let dbPromoSettings: Record<string, unknown> | null = null;
  try {
    const { data } = await admin
      .from("promo_settings")
      .select("*")
      .eq("brand_id", brandId)
      .maybeSingle();
    dbPromoSettings = (data as Record<string, unknown> | null) ?? null;
  } catch {
    dbPromoSettings = null;
  }

  const expectedPromoCodeFromDb = String(dbPromoSettings?.promo_code ?? "").trim();
  const expectedPromoCode = expectedPromoCodeFromDb || (process.env.BILLPLZ_PROMO_CODE ?? "").trim();
  let amountCents = baseAmountCents;
  if (promoCodeInput) {
    if (!expectedPromoCode || promoCodeInput.toUpperCase() !== expectedPromoCode.toUpperCase()) {
      return NextResponse.json({ error: "Invalid promo code." }, { status: 400 });
    }
    const promoAmount =
      mapPromoAmountByDurationDaysFromDb(durationDays, dbPromoSettings) || mapPromoAmountByDurationDays(durationDays);
    if (promoAmount > 0) amountCents = promoAmount;
  }
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
