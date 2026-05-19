const DEFAULT_BRAND_ID = "kapitan";

export function resolveBrandId(req?: Request): string {
  const fromEnv = (process.env.BRAND_ID ?? process.env.NEXT_PUBLIC_BRAND_ID ?? "").trim().toLowerCase();
  if (fromEnv) return fromEnv;

  const host = req
    ? (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").trim().toLowerCase()
    : "";

  if (host.includes("kapitan")) return "kapitan";

  return DEFAULT_BRAND_ID;
}
