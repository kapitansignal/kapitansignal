import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type Incoming = {
  secret?: string;
  event?: "signal" | "price_update" | "signal_closed";
  pair?: string;
  symbol?: string;
  mode?: "scalping" | "intraday";
  strategy?: "scalping" | "intraday";
  type?: "buy" | "sell";
  side?: "buy" | "sell";
  entry_target?: number | string;
  entry?: number | string;
  live_price?: number | string;
  price?: number | string;
  sl?: number | string;
  stop_loss?: number | string;
  tp1?: number | string;
  tp2?: number | string;
  tp3?: number | string;
  outcome?: "tp1" | "tp2" | "tp3" | "be" | "sl";
  close_price?: number | string;
  status?: "active" | "closed";
};

const GOLD_PIPS_MULTIPLIER = 10;
const SIGNAL_DUPLICATE_COOLDOWN_SECONDS = Number(process.env.SIGNAL_DUPLICATE_COOLDOWN_SECONDS ?? "90");

function asNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalized(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  return v.length ? v : null;
}

function resolveBrandId(request: NextRequest): string {
  const fromEnv = (process.env.BRAND_ID ?? process.env.NEXT_PUBLIC_BRAND_ID ?? "").trim().toLowerCase();
  if (fromEnv) return fromEnv;

  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").trim().toLowerCase();
  if (!host) return "";

  if (host.includes("kapitan")) return "kapitan";
  return "";
}

const BRAND_DEFAULT_DISTANCE_MULTIPLIER: Partial<Record<string, number>> = {
  richjoker: 0.5,
  shinobi: 0.5,
};

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function getDefaultBrandPriceDistanceMultiplier(brandId: string) {
  const fallback = BRAND_DEFAULT_DISTANCE_MULTIPLIER[brandId] ?? 1;
  const envKey = `HQ_BRAND_${brandId.toUpperCase()}_PRICE_DISTANCE_MULTIPLIER`;
  const envRaw = process.env[envKey];
  if (!envRaw || envRaw.trim().length === 0) return fallback;
  const parsed = Number(envRaw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function readStoredSignalPriceDistanceMultiplier(settings: unknown) {
  const bag = asObject(settings);
  const snake = asNumber(bag.signal_price_distance_multiplier);
  const camel = asNumber(bag.signalPriceDistanceMultiplier);
  const value = snake ?? camel;
  if (value === null || value <= 0) return null;
  return value;
}

function scaleLevelFromEntry(entry: number, level: number, multiplier: number) {
  const scaled = entry + (level - entry) * multiplier;
  return Number(scaled.toFixed(5));
}

function scaleSignalLevelsForBrand(args: {
  entryTarget: number;
  sl: number;
  tp1: number;
  tp2: number;
  tp3: number | null;
  multiplier: number;
}) {
  if (Math.abs(args.multiplier - 1) < 0.000001) {
    return { sl: args.sl, tp1: args.tp1, tp2: args.tp2, tp3: args.tp3 };
  }
  return {
    sl: scaleLevelFromEntry(args.entryTarget, args.sl, args.multiplier),
    tp1: scaleLevelFromEntry(args.entryTarget, args.tp1, args.multiplier),
    tp2: scaleLevelFromEntry(args.entryTarget, args.tp2, args.multiplier),
    tp3: args.tp3 === null ? null : scaleLevelFromEntry(args.entryTarget, args.tp3, args.multiplier),
  };
}

export async function POST(req: NextRequest) {
  const expectedSecret = process.env.TRADINGVIEW_WEBHOOK_SECRET;
  if (!expectedSecret) {
    return NextResponse.json({ error: "Server missing TRADINGVIEW_WEBHOOK_SECRET" }, { status: 500 });
  }

  let body: Incoming;
  try {
    body = (await req.json()) as Incoming;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const suppliedSecret = body.secret ?? req.headers.get("x-webhook-secret") ?? "";
  if (suppliedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized webhook" }, { status: 401 });
  }

  const pair = String(body.pair ?? body.symbol ?? "XAUUSD").trim().toUpperCase();
  const event = (normalized(body.event) ?? "signal") as "signal" | "price_update" | "signal_closed";
  const mode = (normalized(body.mode) ?? normalized(body.strategy) ?? "scalping") as "scalping" | "intraday";
  const type = (normalized(body.type) ?? normalized(body.side) ?? "buy") as "buy" | "sell";
  const entryTarget = asNumber(body.entry_target ?? body.entry);
  const livePrice = asNumber(body.live_price ?? body.price);
  const sl = asNumber(body.sl ?? body.stop_loss);
  const tp1 = asNumber(body.tp1);
  const tp2 = asNumber(body.tp2);
  const tp3 = asNumber(body.tp3);
  const status = body.status ?? "active";

  if (!["scalping", "intraday"].includes(mode)) {
    return NextResponse.json(
      { error: "mode/strategy must be scalping or intraday", received_mode: body.mode ?? body.strategy ?? null },
      { status: 400 },
    );
  }

  if (!["signal", "price_update", "signal_closed"].includes(event)) {
    return NextResponse.json(
      { error: "event must be signal, price_update or signal_closed", received_event: body.event ?? null },
      { status: 400 },
    );
  }

  if (event === "signal" && !["buy", "sell"].includes(type)) {
    return NextResponse.json(
      { error: "type/side must be buy or sell", received_type: body.type ?? body.side ?? null },
      { status: 400 },
    );
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Server missing Supabase admin env vars" }, { status: 500 });
  }
  const brandId = resolveBrandId(req);
  if (!brandId) {
    return NextResponse.json({ error: "Server missing BRAND_ID / NEXT_PUBLIC_BRAND_ID" }, { status: 500 });
  }
  const defaultSignalPriceDistanceMultiplier = getDefaultBrandPriceDistanceMultiplier(brandId);
  let signalPriceDistanceMultiplier = defaultSignalPriceDistanceMultiplier;
  const { data: scalingRule, error: scalingRuleError } = await admin
    .from("brand_publish_rules")
    .select("settings")
    .eq("brand_id", brandId)
    .maybeSingle();

  if (scalingRuleError) {
    console.warn("[webhook/tradingview] Failed loading brand signal scaling:", scalingRuleError.message);
  } else {
    const storedMultiplier = readStoredSignalPriceDistanceMultiplier(scalingRule?.settings);
    if (storedMultiplier !== null) signalPriceDistanceMultiplier = storedMultiplier;
  }

  if (event === "price_update") {
    if (livePrice === null) {
      return NextResponse.json({ error: "live_price (or price) is required for price_update" }, { status: 400 });
    }

    const { data: current, error: currentError } = await admin
      .from("signals")
      .select("id, mode, type:action, entry_target:entry, tp1:take_profit_1, tp2:take_profit_2, tp3:take_profit_3, sl:stop_loss, max_floating_pips")
      .eq("brand_id", brandId)
      .eq("pair", pair)
      .eq("mode", mode)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (currentError) {
      return NextResponse.json({ error: currentError.message }, { status: 500 });
    }

    if (!current) {
      return NextResponse.json({ ok: false, reason: "no_active_signal_found", pair, mode }, { status: 404 });
    }

    const points = current.type === "buy" ? livePrice - Number(current.entry_target) : Number(current.entry_target) - livePrice;
    const currentPips = points * GOLD_PIPS_MULTIPLIER;
    const maxFloatingPips = Math.max(Number(current.max_floating_pips ?? 0), currentPips);

    let hitOutcome: "tp1" | "tp2" | "tp3" | "sl" | null = null;
    if (current.type === "buy") {
      if (livePrice <= Number(current.sl)) hitOutcome = "sl";
      else if (current.tp3 !== null && livePrice >= Number(current.tp3)) hitOutcome = "tp3";
      else if (livePrice >= Number(current.tp2)) hitOutcome = "tp2";
      else if (livePrice >= Number(current.tp1)) hitOutcome = "tp1";
    } else {
      if (livePrice >= Number(current.sl)) hitOutcome = "sl";
      else if (current.tp3 !== null && livePrice <= Number(current.tp3)) hitOutcome = "tp3";
      else if (livePrice <= Number(current.tp2)) hitOutcome = "tp2";
      else if (livePrice <= Number(current.tp1)) hitOutcome = "tp1";
    }

    if (hitOutcome) {
      const realizedPips = currentPips;
      const peakPips = Math.max(maxFloatingPips, realizedPips);
      const historyPips = Math.max(realizedPips, peakPips);

      const { error: closeError } = await admin
        .from("signals")
        .update({
          live_price: livePrice,
          max_floating_pips: peakPips,
          status: "closed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", current.id);
      if (closeError) return NextResponse.json({ error: closeError.message }, { status: 500 });

      const { data: logData, error: logError } = await admin
        .from("performance_logs")
        .insert({
          brand_id: brandId,
          signal_id: current.id,
          pair,
          mode: current.mode,
          action: current.type,
          outcome: hitOutcome,
          points: historyPips,
          price: livePrice,
          net_pips: historyPips,
          peak_pips: peakPips,
        })
        .select("id")
        .single();
      if (logError) return NextResponse.json({ error: logError.message }, { status: 500 });

      return NextResponse.json({
        ok: true,
        event,
        auto_closed: true,
        signal_id: current.id,
        performance_log_id: logData.id,
        outcome: hitOutcome,
        realized_pips: realizedPips,
        peak_pips: peakPips,
        stored_history_pips: historyPips,
      });
    }

    const { error: updateError } = await admin
      .from("signals")
      .update({ live_price: livePrice, max_floating_pips: maxFloatingPips, updated_at: new Date().toISOString() })
      .eq("id", current.id);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, event, signal_id: current.id, live_price: livePrice, pair, mode });
  }

  if (event === "signal_closed") {
    const closePrice = asNumber(body.close_price ?? body.live_price ?? body.price);
    const outcome = (normalized(body.outcome) ?? "tp1") as "tp1" | "tp2" | "tp3" | "be" | "sl";

    if (!["tp1", "tp2", "tp3", "be", "sl"].includes(outcome)) {
      return NextResponse.json({ error: "outcome must be tp1, tp2, tp3, be or sl" }, { status: 400 });
    }

    if (closePrice === null) {
      return NextResponse.json({ error: "close_price (or live_price/price) is required for signal_closed" }, { status: 400 });
    }

    const { data: current, error: currentError } = await admin
      .from("signals")
      .select("id, type:action, entry_target:entry, max_floating_pips")
      .eq("brand_id", brandId)
      .eq("pair", pair)
      .eq("mode", mode)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (currentError) return NextResponse.json({ error: currentError.message }, { status: 500 });
    if (!current) return NextResponse.json({ ok: false, reason: "no_active_signal_found", pair, mode }, { status: 404 });

    const points = current.type === "buy" ? closePrice - Number(current.entry_target) : Number(current.entry_target) - closePrice;
    const realizedPips = points * GOLD_PIPS_MULTIPLIER;
    const peakPips = Math.max(Number(current.max_floating_pips ?? 0), realizedPips);
    const historyPips = Math.max(realizedPips, peakPips);

    const { error: closeError } = await admin
      .from("signals")
      .update({ live_price: closePrice, status: "closed", max_floating_pips: peakPips, updated_at: new Date().toISOString() })
      .eq("id", current.id);
    if (closeError) return NextResponse.json({ error: closeError.message }, { status: 500 });

    const { data: logData, error: logError } = await admin
      .from("performance_logs")
      .insert({
        brand_id: brandId,
        signal_id: current.id,
        pair,
        mode,
        action: current.type,
        outcome,
        points: historyPips,
        price: closePrice,
        net_pips: historyPips,
        peak_pips: peakPips,
      })
      .select("id")
      .single();
    if (logError) return NextResponse.json({ error: logError.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      event,
      signal_id: current.id,
      performance_log_id: logData.id,
      realized_pips: realizedPips,
      peak_pips: peakPips,
      stored_history_pips: historyPips,
    });
  }

  if (entryTarget === null || livePrice === null || sl === null || tp1 === null || tp2 === null) {
    return NextResponse.json(
      { error: "entry_target (or entry), live_price (or price), sl (or stop_loss), tp1, tp2 are required numbers" },
      { status: 400 },
    );
  }
  const scaledSignalLevels = event === "signal"
    ? scaleSignalLevelsForBrand({
      entryTarget,
      sl,
      tp1,
      tp2,
      tp3,
      multiplier: signalPriceDistanceMultiplier,
    })
    : null;
  const signalSl = scaledSignalLevels?.sl ?? sl;
  const signalTp1 = scaledSignalLevels?.tp1 ?? tp1;
  const signalTp2 = scaledSignalLevels?.tp2 ?? tp2;
  const signalTp3 = scaledSignalLevels?.tp3 ?? tp3;

  if (event === "signal") {
    const cooldownFromIso = new Date(Date.now() - Math.max(10, SIGNAL_DUPLICATE_COOLDOWN_SECONDS) * 1000).toISOString();
    const { data: maybeDup, error: dupError } = await admin
      .from("signals")
      .select("id, entry_target:entry, created_at, status")
      .eq("brand_id", brandId)
      .eq("pair", pair)
      .eq("mode", mode)
      .eq("action", type)
      .eq("status", "active")
      .gte("created_at", cooldownFromIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (dupError) {
      return NextResponse.json({ error: dupError.message }, { status: 500 });
    }

    if (maybeDup && Math.abs(Number(maybeDup.entry_target) - entryTarget) < 0.05) {
      return NextResponse.json({
        ok: true,
        duplicate_ignored: true,
        reason: "cooldown_active",
        signal_id: maybeDup.id,
        cooldown_seconds: Math.max(10, SIGNAL_DUPLICATE_COOLDOWN_SECONDS),
      });
    }
  }

  // On new signal event, archive previous active signal (same pair + mode) into performance history
  // so history remains continuous even when no explicit signal_closed/TP/SL event is sent.
  if (event === "signal") {
    const { data: previous } = await admin
      .from("signals")
      .select("id, type:action, entry_target:entry, live_price, max_floating_pips, created_at")
      .eq("brand_id", brandId)
      .eq("pair", pair)
      .eq("mode", mode)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (previous) {
      const closePrice = Number(previous.live_price);
      const points =
        previous.type === "buy"
          ? closePrice - Number(previous.entry_target)
          : Number(previous.entry_target) - closePrice;
      const realizedPips = points * GOLD_PIPS_MULTIPLIER;
      const peakPips = Math.max(Number(previous.max_floating_pips ?? 0), realizedPips);
      const outcome: "tp1" | "sl" = peakPips > 0 ? "tp1" : "sl";

      await admin
        .from("signals")
        .update({ status: "closed", updated_at: new Date().toISOString() })
        .eq("id", previous.id);

      await admin.from("performance_logs").insert({
        brand_id: brandId,
        signal_id: previous.id,
        pair,
        mode,
        action: previous.type,
        outcome,
        points: realizedPips,
        price: closePrice,
        net_pips: realizedPips,
        peak_pips: peakPips,
      });
    }
  }

  const { data, error } = await admin
    .from("signals")
    .insert({
      brand_id: brandId,
      pair,
      mode,
      action: type,
      entry: entryTarget,
      live_price: livePrice,
      stop_loss: signalSl,
      take_profit_1: signalTp1,
      take_profit_2: signalTp2,
      take_profit_3: signalTp3,
      max_floating_pips: 0,
      status,
      updated_at: new Date().toISOString(),
    })
    .select("id, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, signal_id: data.id, created_at: data.created_at });
}


