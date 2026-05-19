import { NextResponse } from "next/server";
import { getBillplzBill, getBillplzConfig } from "@/lib/billplz";

function toBool(value: unknown) {
  return value === true || value === "true";
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const config = getBillplzConfig();
  if (!config) {
    return NextResponse.json({ error: "Billplz is not configured." }, { status: 400 });
  }

  const body = (await req.json()) as { bill_id?: string };
  const billId = (body.bill_id ?? "").trim();
  if (!billId) return NextResponse.json({ error: "bill_id is required" }, { status: 400 });

  const billRes = await getBillplzBill(config, billId);
  if (!billRes.ok) {
    return NextResponse.json({ error: "Unable to verify payment status." }, { status: 400 });
  }

  const paid = toBool(billRes.json.paid);
  if (!paid) return NextResponse.json({ error: "Payment has not been completed." }, { status: 400 });

  const name = String(billRes.json.name ?? "").trim();
  const email = String(billRes.json.email ?? "").trim().toLowerCase();
  const phone = String(billRes.json.mobile ?? "").trim();
  if (!name || !email || !phone) {
    return NextResponse.json({ error: "Bill data is incomplete (name/email/mobile)." }, { status: 400 });
  }

  const { token } = await params;
  const url = new URL(req.url);
  const registerRes = await fetch(`${url.origin}/api/register/${token}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, email, phone }),
  });
  const registerJson = (await registerRes.json()) as Record<string, unknown>;
  if (!registerRes.ok) {
    return NextResponse.json(
      { error: String(registerJson.error ?? "Failed to complete registration after payment.") },
      { status: registerRes.status },
    );
  }

  return NextResponse.json(registerJson);
}

