const BILLPLZ_API_BASE = "https://www.billplz.com/api/v3";

type BillplzConfig = {
  apiKey: string;
  collectionId: string;
  xSignatureKey: string;
  amountCents: number;
};

type CreateBillArgs = {
  name: string;
  email: string;
  mobile: string;
  description: string;
  callbackUrl: string;
  redirectUrl: string;
  reference1: string;
  reference2: string;
};

function asPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value ?? "");
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

export function getBillplzConfig(): BillplzConfig | null {
  const apiKey = process.env.BILLPLZ_API_KEY?.trim() ?? "";
  const collectionId = process.env.BILLPLZ_COLLECTION_ID?.trim() ?? "";
  const xSignatureKey = process.env.BILLPLZ_X_SIGNATURE_KEY?.trim() ?? "";
  const amountCents = asPositiveInt(process.env.BILLPLZ_AMOUNT_CENTS, 0);
  if (!apiKey || !collectionId || !xSignatureKey || amountCents <= 0) return null;
  return { apiKey, collectionId, xSignatureKey, amountCents };
}

function withAuthHeaders(apiKey: string) {
  const token = Buffer.from(`${apiKey}:`).toString("base64");
  return {
    authorization: `Basic ${token}`,
  };
}

export async function createBillplzBill(config: BillplzConfig, args: CreateBillArgs) {
  const payload = new URLSearchParams({
    collection_id: config.collectionId,
    name: args.name,
    email: args.email,
    mobile: args.mobile,
    amount: String(config.amountCents),
    description: args.description,
    callback_url: args.callbackUrl,
    redirect_url: args.redirectUrl,
    reference_1_label: "Brand",
    reference_1: args.reference1,
    reference_2_label: "Token",
    reference_2: args.reference2,
  });

  const response = await fetch(`${BILLPLZ_API_BASE}/bills`, {
    method: "POST",
    headers: {
      ...withAuthHeaders(config.apiKey),
      "content-type": "application/x-www-form-urlencoded",
    },
    body: payload.toString(),
  });

  const json = (await response.json()) as Record<string, unknown>;
  return { ok: response.ok, json };
}

export async function getBillplzBill(config: BillplzConfig, billId: string) {
  const response = await fetch(`${BILLPLZ_API_BASE}/bills/${encodeURIComponent(billId)}`, {
    method: "GET",
    headers: withAuthHeaders(config.apiKey),
  });
  const json = (await response.json()) as Record<string, unknown>;
  return { ok: response.ok, json };
}

