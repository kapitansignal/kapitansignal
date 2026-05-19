import { NextResponse } from "next/server";
import { resolveBrandId } from "@/lib/brand-id";
import { createBillplzBill, getBillplzConfig } from "@/lib/billplz";

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
  const callbackUrl = `${url.origin}/api/register/${token}/billplz/confirm`;
  const redirectUrl = `${url.origin}/register/${token}`;
  const description = `${brandId.toUpperCase()} Registration`;

  const created = await createBillplzBill(config, {
    name,
    email,
    mobile: phone,
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

