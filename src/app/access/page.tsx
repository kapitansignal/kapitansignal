"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { AlertTriangle, BarChart3, CalendarClock, Clipboard, Eye, EyeOff, Moon, Package, ShieldCheck, Signal, Sun, Timer, User } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import { resolveBrandId } from "@/lib/brand-id";
import type { PerformanceLog, Signal as TradingSignal, SignalMode } from "@/lib/types";

type Tab = "signal" | "performance";
type RangePreset = "day" | "week" | "month" | "custom";
type DesignVariant = "tactical" | "executive";
type LiveAlertKind = "signal" | "tp" | "sl";

type LiveAlert = {
  id: string;
  kind: LiveAlertKind;
  title: string;
  message: string;
  createdAt: number;
};

const SESSION_MINUTES = 120;
const SCALPING_INTERVAL_SECONDS = 30 * 60;
const INTRADAY_INTERVAL_SECONDS = 4 * 60 * 60;
const GOLD_PIPS_MULTIPLIER = 10;
const PERFORMANCE_DEFAULT_PAGE_SIZE = 10;
const ACCESS_KEY_STORAGE_KEY = "kapitan-access-key";
const THEME_STORAGE_KEY = "kapitan-theme-v2";

function fmt(value: number) {
  return value.toFixed(2);
}

function pipGain(signal: TradingSignal) {
  const points = signal.type === "buy"
    ? signal.live_price - signal.entry_target
    : signal.entry_target - signal.live_price;
  return points * GOLD_PIPS_MULTIPLIER;
}

function readNumber(value: unknown, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeSignal(row: Record<string, unknown>): TradingSignal {
  const entry = readNumber(row.entry_target ?? row.entry);
  return {
    ...(row as Partial<TradingSignal>),
    id: String(row.id ?? `signal-${Date.now()}`),
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
    mode: row.mode === "intraday" ? "intraday" : "scalping",
    type: row.type === "sell" || row.action === "sell" ? "sell" : "buy",
    pair: String(row.pair ?? "XAUUSD"),
    entry_target: entry,
    live_price: readNumber(row.live_price, entry),
    sl: readNumber(row.sl ?? row.stop_loss),
    tp1: readNumber(row.tp1 ?? row.take_profit_1),
    tp2: readNumber(row.tp2 ?? row.take_profit_2),
    tp3: row.tp3 === null || row.take_profit_3 === null ? null : readNumber(row.tp3 ?? row.take_profit_3),
    max_floating_pips: row.max_floating_pips === null || row.max_floating_pips === undefined ? null : readNumber(row.max_floating_pips),
    status: row.status === "active" ? "active" : "closed",
  };
}

function normalizePerformanceLog(row: Record<string, unknown>): PerformanceLog {
  const peak = row.peak_pips ?? row.points ?? null;
  return {
    ...(row as Partial<PerformanceLog>),
    id: String(row.id ?? `performance-${Date.now()}`),
    created_at: String(row.created_at ?? new Date().toISOString()),
    mode: row.mode === "intraday" ? "intraday" : "scalping",
    type: row.type === "sell" || row.action === "sell" ? "sell" : "buy",
    outcome: row.outcome === "tp1" || row.outcome === "tp2" || row.outcome === "tp3" || row.outcome === "sl" || row.outcome === "be" ? row.outcome : "be",
    net_pips: readNumber(row.net_pips ?? row.points),
    peak_pips: peak === null || peak === undefined ? null : readNumber(peak),
  };
}

function formatClock(totalSeconds: number) {
  const seconds = Math.max(0, totalSeconds);
  const hh = Math.floor(seconds / 3600);
  const mm = Math.floor((seconds % 3600) / 60);
  const ss = seconds % 60;
  if (hh > 0) return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

async function getFingerprint(): Promise<string> {
  const raw = [navigator.userAgent, navigator.language, screen.width, screen.height, Intl.DateTimeFormat().resolvedOptions().timeZone].join("|");
  const encoded = new TextEncoder().encode(raw);
  const hash = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function Home() {
  const supabase = getSupabaseClient();
  const brandId = useMemo(() => resolveBrandId(), []);
  const [authorized, setAuthorized] = useState(false);
  const [accessKey, setAccessKey] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [showAccessKey, setShowAccessKey] = useState(false);

  const [tab, setTab] = useState<Tab>("signal");
  const [mode, setMode] = useState<SignalMode>("scalping");
  const [signals, setSignals] = useState<TradingSignal[]>([]);
  const [logs, setLogs] = useState<PerformanceLog[]>([]);
  const [riskAmount, setRiskAmount] = useState("100");
  const [sessionSeconds, setSessionSeconds] = useState(SESSION_MINUTES * 60);
  const [nowMs, setNowMs] = useState(Date.now());
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [activeAccessKeyId, setActiveAccessKeyId] = useState<string | null>(null);
  const [activeSessionToken, setActiveSessionToken] = useState<string | null>(null);
  const [accountName, setAccountName] = useState<string>("-");
  const [accountPackage, setAccountPackage] = useState<string>("-");
  const [subscriptionExpiry, setSubscriptionExpiry] = useState<string | null>(null);
  const [rangePreset, setRangePreset] = useState<RangePreset>("week");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [designVariant] = useState<DesignVariant>("executive");
  const [showLoginDisclaimer, setShowLoginDisclaimer] = useState(false);
  const [performancePageSize, setPerformancePageSize] = useState<number | "all">(PERFORMANCE_DEFAULT_PAGE_SIZE);
  const [performancePage, setPerformancePage] = useState(1);
  const [liveAlerts, setLiveAlerts] = useState<LiveAlert[]>([]);
  const [activeSignalPopup, setActiveSignalPopup] = useState<LiveAlert | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");
  const notifiedEventKeysRef = useRef<Set<string>>(new Set());
  const initializedAlertSnapshotRef = useRef(false);
  const lastSeenSignalIdRef = useRef<string | null>(null);
  const lastSeenPerfIdRef = useRef<string | null>(null);

  const pushLiveAlert = (alert: LiveAlert) => {
    setLiveAlerts((prev) => [alert, ...prev].slice(0, 20));
    setActiveSignalPopup(alert);
    if (typeof window !== "undefined" && notificationPermission === "granted") {
      new Notification(alert.title, { body: alert.message });
    }
  };

  const fetchDashboardData = async (sb: NonNullable<ReturnType<typeof getSupabaseClient>>) => {
    const [serverSignalRes, serverLogRes] = await Promise.all([
      fetch("/api/signals?pair=XAUUSD&limit=50", { cache: "no-store" }),
      fetch("/api/performance-logs?limit=300", { cache: "no-store" }),
    ]);

    try {
      if (serverSignalRes.ok) {
        const json = (await serverSignalRes.json()) as { data?: TradingSignal[] };
        if (Array.isArray(json.data)) {
          setSignals(json.data.map((row) => normalizeSignal(row as unknown as Record<string, unknown>)));
        }
      }
    } catch {
      // keep existing signals when server fetch fails
    }

    try {
      if (serverLogRes.ok) {
        const json = (await serverLogRes.json()) as { data?: PerformanceLog[] };
        if (Array.isArray(json.data)) setLogs(json.data.map((row) => normalizePerformanceLog(row as unknown as Record<string, unknown>)));
      }
    } catch {
      // keep existing logs when server fetch fails
    }
    setLastSync(new Date().toLocaleTimeString());
  };

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(THEME_STORAGE_KEY) : null;
    if (saved === "dark" || saved === "light") setTheme(saved);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedAccessKey = window.localStorage.getItem(ACCESS_KEY_STORAGE_KEY);
    if (savedAccessKey) setAccessKey(savedAccessKey);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const trimmed = accessKey.trim();
    if (!trimmed) {
      window.localStorage.removeItem(ACCESS_KEY_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(ACCESS_KEY_STORAGE_KEY, trimmed);
  }, [accessKey]);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    if (!authorized) {
      initializedAlertSnapshotRef.current = false;
      lastSeenSignalIdRef.current = null;
      lastSeenPerfIdRef.current = null;
      return;
    }
    if (!signals.length && !logs.length) return;

    if (!initializedAlertSnapshotRef.current) {
      lastSeenSignalIdRef.current = signals[0]?.id ?? null;
      lastSeenPerfIdRef.current = logs[0]?.id ?? null;
      initializedAlertSnapshotRef.current = true;
      return;
    }

    const latestSignal = signals[0];
    if (latestSignal && latestSignal.id !== lastSeenSignalIdRef.current && latestSignal.status === "active") {
      lastSeenSignalIdRef.current = latestSignal.id;
      const eventKey = `signal:${latestSignal.id}`;
      if (!notifiedEventKeysRef.current.has(eventKey)) {
        notifiedEventKeysRef.current.add(eventKey);
        pushLiveAlert({
          id: eventKey,
          kind: "signal",
          title: `New ${latestSignal.mode.toUpperCase()} Signal`,
          message: `${latestSignal.type.toUpperCase()} XAUUSD @ ${fmt(latestSignal.entry_target)}`,
          createdAt: Date.now(),
        });
      }
    } else if (latestSignal) {
      lastSeenSignalIdRef.current = latestSignal.id;
    }

    const latestPerf = logs[0];
    if (latestPerf && latestPerf.id !== lastSeenPerfIdRef.current) {
      lastSeenPerfIdRef.current = latestPerf.id;
      const isTp = latestPerf.outcome === "tp1" || latestPerf.outcome === "tp2" || latestPerf.outcome === "tp3";
      const isSl = latestPerf.outcome === "sl";
      if (isTp || isSl) {
        const upperOutcome = latestPerf.outcome.toUpperCase();
        const eventKey = `performance:${latestPerf.id}:${latestPerf.outcome}`;
        if (!notifiedEventKeysRef.current.has(eventKey)) {
          notifiedEventKeysRef.current.add(eventKey);
          pushLiveAlert({
            id: eventKey,
            kind: isTp ? "tp" : "sl",
            title: isTp ? `${upperOutcome} Hit` : "Stop Loss Hit",
            message: `${latestPerf.mode.toUpperCase()} ${latestPerf.type.toUpperCase()} | ${latestPerf.net_pips.toFixed(1)} pips`,
            createdAt: Date.now(),
          });
        }
      }
    } else if (latestPerf) {
      lastSeenPerfIdRef.current = latestPerf.id;
    }
  }, [authorized, signals, logs]);

  useEffect(() => {
    if (!authorized || !supabase) return;
    const t = setInterval(() => setSessionSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [authorized, supabase]);

  useEffect(() => {
    if (!authorized) return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [authorized]);

  useEffect(() => {
    if (!authorized || !supabase) return;
    const sb = supabase;

    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission().then((permission) => setNotificationPermission(permission));
    }

    const load = async () => {
      await fetchDashboardData(sb);
    };

    void load();

    const handleSignalEvent = (payload: { eventType: "INSERT" | "UPDATE" | "DELETE"; new: Record<string, unknown> }) => {
      if (payload.eventType === "DELETE") return;
      if (payload.new.brand_id && String(payload.new.brand_id) !== brandId) return;
      const next = normalizeSignal(payload.new);
      setSignals((prev) => [next, ...prev.filter((s) => s.id !== next.id)].slice(0, 50));

      if (next.status === "active") {
        const eventKey = `signal:${next.id}`;
        if (!notifiedEventKeysRef.current.has(eventKey)) {
          notifiedEventKeysRef.current.add(eventKey);
          pushLiveAlert({
            id: eventKey,
            kind: "signal",
            title: `New ${next.mode.toUpperCase()} Signal`,
            message: `${next.type.toUpperCase()} XAUUSD @ ${fmt(next.entry_target)}`,
            createdAt: Date.now(),
          });
        }
      }
    };

    const handlePerformanceEvent = (payload: { eventType: "INSERT" | "UPDATE" | "DELETE"; new: Record<string, unknown> }) => {
      if (payload.eventType === "DELETE") return;
      if (payload.new.brand_id && String(payload.new.brand_id) !== brandId) return;
      const next = normalizePerformanceLog(payload.new);
      setLogs((prev) => [next, ...prev.filter((s) => s.id !== next.id)].slice(0, 200));

      const upperOutcome = next.outcome.toUpperCase();
      const isTp = next.outcome === "tp1" || next.outcome === "tp2" || next.outcome === "tp3";
      const isSl = next.outcome === "sl";
      if (isTp || isSl) {
        const eventKey = `performance:${next.id}:${next.outcome}`;
        if (!notifiedEventKeysRef.current.has(eventKey)) {
          notifiedEventKeysRef.current.add(eventKey);
          pushLiveAlert({
            id: eventKey,
            kind: isTp ? "tp" : "sl",
            title: isTp ? `${upperOutcome} Hit` : "Stop Loss Hit",
            message: `${next.mode.toUpperCase()} ${next.type.toUpperCase()} | ${next.net_pips.toFixed(1)} pips`,
            createdAt: Date.now(),
          });
        }
      }
    };

    const channel = sb
      .channel("kapitan-stream")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "signals", filter: `brand_id=eq.${brandId}` }, (payload) =>
        handleSignalEvent(payload as unknown as { eventType: "INSERT" | "UPDATE" | "DELETE"; new: Record<string, unknown> }),
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "signals", filter: `brand_id=eq.${brandId}` }, (payload) =>
        handleSignalEvent(payload as unknown as { eventType: "INSERT" | "UPDATE" | "DELETE"; new: Record<string, unknown> }),
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "performance_logs", filter: `brand_id=eq.${brandId}` }, (payload) =>
        handlePerformanceEvent(payload as unknown as { eventType: "INSERT" | "UPDATE" | "DELETE"; new: Record<string, unknown> }),
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "performance_logs", filter: `brand_id=eq.${brandId}` }, (payload) =>
        handlePerformanceEvent(payload as unknown as { eventType: "INSERT" | "UPDATE" | "DELETE"; new: Record<string, unknown> }),
      )
      .subscribe();

    return () => {
      void sb.removeChannel(channel);
    };
  }, [authorized, supabase, brandId]);

  useEffect(() => {
    if (!authorized || !supabase) return;
    const sb = supabase;
    const timer = setInterval(() => {
      void fetchDashboardData(sb);
    }, 15000);
    return () => clearInterval(timer);
  }, [authorized, supabase]);

  useEffect(() => {
    if (!authorized || !activeAccessKeyId || !activeSessionToken) return;
    const timer = setInterval(async () => {
      const res = await fetch("/api/access/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessKeyId: activeAccessKeyId, sessionToken: activeSessionToken }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string; data?: { expired_at: string | null } } | null;
      if (!res.ok) {
        setAuthorized(false);
        setAuthError(json?.error ?? "Access key revoked. Please contact admin.");
        setActiveAccessKeyId(null);
        setActiveSessionToken(null);
        setAccountName("-");
        setAccountPackage("-");
        setSubscriptionExpiry(null);
        setSessionSeconds(SESSION_MINUTES * 60);
        return;
      }
      if (json?.data) {
        setSubscriptionExpiry(json.data.expired_at ?? null);
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [authorized, activeAccessKeyId, activeSessionToken]);

  const activeSignals = useMemo(() => signals.filter((s) => s.mode === mode), [signals, mode]);
  const activeSignal = activeSignals.find((s) => s.status === "active") ?? activeSignals[0];
  const rangeStartMs = useMemo(() => {
    const now = new Date();
    if (rangePreset === "day") {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return start.getTime();
    }
    if (rangePreset === "week") {
      const start = new Date(now);
      const jsDay = start.getDay(); // Sunday=0 ... Saturday=6
      const daysFromMonday = (jsDay + 6) % 7;
      start.setDate(start.getDate() - daysFromMonday);
      start.setHours(0, 0, 0, 0);
      return start.getTime();
    }
    if (rangePreset === "month") return now.getTime() - 30 * 24 * 60 * 60 * 1000;
    if (!customFrom) return 0;
    return new Date(`${customFrom}T00:00:00`).getTime();
  }, [rangePreset, customFrom]);

  const rangeEndMs = useMemo(() => {
    if (rangePreset !== "custom" || !customTo) return Infinity;
    return new Date(`${customTo}T23:59:59`).getTime();
  }, [rangePreset, customTo]);

  const filteredLogs = useMemo(
    () =>
      logs.filter((l) => {
        if (l.mode !== mode) return false;
        const t = new Date(l.created_at).getTime();
        return t >= rangeStartMs && t <= rangeEndMs;
      }),
    [logs, mode, rangeStartMs, rangeEndMs],
  );

  const totalPerformancePages = useMemo(() => {
    if (performancePageSize === "all") return 1;
    return Math.max(1, Math.ceil(filteredLogs.length / performancePageSize));
  }, [filteredLogs.length, performancePageSize]);

  const visibleLogs = useMemo(() => {
    if (performancePageSize === "all") return filteredLogs;
    const start = (performancePage - 1) * performancePageSize;
    return filteredLogs.slice(start, start + performancePageSize);
  }, [filteredLogs, performancePageSize, performancePage]);

  useEffect(() => {
    setPerformancePage(1);
  }, [mode, rangePreset, customFrom, customTo, performancePageSize]);

  useEffect(() => {
    if (performancePage > totalPerformancePages) {
      setPerformancePage(totalPerformancePages);
    }
  }, [performancePage, totalPerformancePages]);

  const stats = useMemo(() => {
    const total = filteredLogs.length;
    const wins = filteredLogs.filter((l) => l.outcome !== "sl").length;
    const totalPips = filteredLogs.reduce((acc, item) => acc + item.net_pips, 0);
    const totalTp = filteredLogs.filter((l) => l.outcome === "tp1" || l.outcome === "tp2" || l.outcome === "tp3").length;
    const totalBe = filteredLogs.filter((l) => l.outcome === "be").length;
    const totalSl = filteredLogs.filter((l) => l.outcome === "sl").length;
    const byTp = {
      tp1: filteredLogs.filter((l) => l.outcome === "tp1").length,
      tp2: filteredLogs.filter((l) => l.outcome === "tp2").length,
      tp3: filteredLogs.filter((l) => l.outcome === "tp3").length,
      be: filteredLogs.filter((l) => l.outcome === "be").length,
      sl: filteredLogs.filter((l) => l.outcome === "sl").length,
    };

    return {
      winRate: total ? (wins / total) * 100 : 0,
      totalPips,
      signalCount: total,
      totalTp,
      totalBe,
      totalSl,
      byTp,
    };
  }, [filteredLogs]);

  const lotSize = useMemo(() => {
    if (!activeSignal) return 0;
    const risk = Number(riskAmount);
    if (!risk || risk <= 0) return 0;
    const slPips = Math.abs(activeSignal.entry_target - activeSignal.sl) * GOLD_PIPS_MULTIPLIER;
    if (!slPips) return 0;
    return risk / (slPips * 10);
  }, [riskAmount, activeSignal]);

  const nextSignalCountdown = useMemo(() => {
    const interval = mode === "scalping" ? SCALPING_INTERVAL_SECONDS : INTRADAY_INTERVAL_SECONDS;
    const nowSec = Math.floor(nowMs / 1000);
    const remaining = interval - (nowSec % interval);
    return formatClock(remaining === interval ? 0 : remaining);
  }, [mode, nowMs]);

  const signalsTodayCount = useMemo(() => {
    const todayMy = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" });
    return signals.filter((item) => {
      const d = new Date(item.created_at).toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" });
      return d === todayMy;
    }).length;
  }, [signals]);

  const commandPlanLabel = useMemo(() => {
    const pkg = (accountPackage ?? "").toLowerCase();
    if (pkg.includes("15")) return "CAPTAIN PLAN";
    if (pkg.includes("30")) return "COMMANDER ELITE";
    if (pkg.includes("7") || pkg.includes("trial") || pkg.includes("3")) return "SCOUT PLAN";
    return "ACTIVE PLAN";
  }, [accountPackage]);

  const login = async () => {
    if (!supabase) {
      setAuthError("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY first.");
      return;
    }

    setLoadingAuth(true);
    setAuthError(null);

    try {
      const res = await fetch("/api/access/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: accessKey.trim(), fingerprint: await getFingerprint() }),
      });
      const json = (await res.json().catch(() => null)) as {
        error?: string;
        data?: { id: string; label: string | null; expired_at: string | null; session_token: string };
      } | null;

      if (!res.ok || !json?.data) {
        setAuthError(json?.error ?? "Authorization denied: invalid key.");
        return;
      }

      const row = json.data;
      setActiveAccessKeyId(row.id);
      setActiveSessionToken(row.session_token);
      const parsedName = row.label?.split("|")[0]?.trim();
      const parsedPackageRaw = row.label?.split("|")[1]?.trim() ?? "";
      const daysMatch = parsedPackageRaw.match(/(\d+)\s*D/i);
      const parsedPackage = daysMatch ? `${daysMatch[1]} Days` : parsedPackageRaw || "-";
      setAccountName(parsedName && parsedName.length > 0 ? parsedName : "Authorized User");
      setAccountPackage(parsedPackage);
      setSubscriptionExpiry(row.expired_at ?? null);
      setAuthorized(true);
      setShowLoginDisclaimer(true);
    } finally {
      setLoadingAuth(false);
    }
  };

  const copyLot = async () => {
    await navigator.clipboard.writeText(lotSize.toFixed(2));
  };

  const logout = () => {
    setAuthorized(false);
    setAuthError(null);
    setLoadingAuth(false);
    setSessionSeconds(SESSION_MINUTES * 60);
    setActiveAccessKeyId(null);
    setActiveSessionToken(null);
    setAccountName("-");
    setAccountPackage("-");
    setSubscriptionExpiry(null);
    setShowLoginDisclaimer(false);
    setActiveSignalPopup(null);
  };

  const clearSavedAccessKey = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(ACCESS_KEY_STORAGE_KEY);
    }
    setAccessKey("");
  };

  const refreshNow = async () => {
    if (!supabase || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await fetchDashboardData(supabase);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!authorized) {
    const loginDark = theme === "dark";
    return (
      <main className={`relative grid min-h-screen place-items-center overflow-hidden px-4 ${loginDark ? "bg-[#05070D]" : "light-theme bg-[#e2e8f0] text-[#0f172a]"}`}>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#111827_1px,transparent_1px),linear-gradient(to_bottom,#111827_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-20" />
        <div className="pointer-events-none absolute h-[520px] w-[520px] rounded-full bg-[#F5C542]/10 blur-[160px]" />

        <section className={`relative z-10 w-full max-w-md rounded-xl p-6 md:p-8 ${
          loginDark
            ? "border border-[#1F2937] bg-[#111827]/90 shadow-[0_0_50px_rgba(5,7,13,0.95)]"
            : "border border-[#0f172a]/20 bg-[#f8fafc] shadow-[0_10px_30px_rgba(15,23,42,0.14)]"
        }`}>
          <div className="absolute inset-x-6 top-0 h-[2px] rounded-full bg-gradient-to-r from-transparent via-[#F5C542] to-transparent" />

          <div className="mb-5 flex items-center justify-between rounded-lg border border-[#1F2937]/60 bg-[#05070D]/70 px-3 py-2">
            <div className="flex items-center gap-2">
              <Image src="/kapitan-logo.png" alt="Kapitan Signal" width={22} height={22} className="rounded object-contain" />
              <span className="font-subheading text-xs font-semibold uppercase tracking-[0.14em] text-[#F5C542]">Secure Access</span>
            </div>
            <a href="/" className={`rounded-lg border px-2.5 py-1 font-subheading text-[10px] font-semibold uppercase tracking-[0.12em] ${
              loginDark
                ? "border-[#F5C542]/40 text-[#F5C542] hover:bg-[#F5C542]/10"
                : "border-slate-300 text-slate-700 hover:bg-slate-100"
            }`}>
              Home
            </a>
          </div>

          <div className="mb-8 text-center">
            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#1F2937] bg-[#05070D] text-[#F5C542]">
              <ShieldCheck size={18} />
            </div>
            <h1 className="font-heading text-2xl font-black tracking-[0.08em] text-[#F5C542]">KAPITAN SIGNAL</h1>
            <p className={`mt-2 font-subheading text-xs uppercase tracking-[0.16em] ${loginDark ? "text-[#9CA3AF]" : "text-slate-600"}`}>Every Signal Is A Mission.</p>
          </div>

          <div className="mb-4 flex justify-end">
            <button
              onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
              className={`inline-flex items-center gap-1 rounded border px-3 py-1.5 text-[10px] font-bold ${
                loginDark
                  ? "border-[#F5C542]/35 text-[#F5C542] hover:bg-[#F5C542]/10"
                  : "border-slate-300 text-slate-700 hover:bg-slate-100"
              }`}
            >
              {loginDark ? <Sun size={12} /> : <Moon size={12} />}
              {loginDark ? "Light" : "Dark"}
            </button>
          </div>

          <label className={`mb-2 block text-xs uppercase tracking-[0.16em] ${loginDark ? "text-[#9CA3AF]" : "text-slate-700"}`}>Command Access Key</label>
          <div className={`relative rounded border ${loginDark ? "border-[#1F2937] bg-[#05070D] focus-within:border-[#F5C542]" : "border-slate-300 bg-white"}`}>
            <input
              type={showAccessKey ? "text" : "password"}
              value={accessKey}
              onChange={(e) => setAccessKey(e.target.value)}
              className={`w-full bg-transparent px-3 py-3 pr-11 text-sm tracking-widest outline-none ${loginDark ? "text-[#F9FAFB] placeholder:text-slate-600" : "text-[#0f172a] placeholder:text-slate-400"}`}
              placeholder="KPS-XXXX-XXXX"
            />
            <button
              type="button"
              onClick={() => setShowAccessKey((prev) => !prev)}
              className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 ${loginDark ? "text-[#9CA3AF] hover:bg-[#111827]" : "text-slate-600 hover:bg-slate-100"}`}
              aria-label={showAccessKey ? "Hide access key" : "Show access key"}
              title={showAccessKey ? "Hide" : "Show"}
            >
              {showAccessKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {authError && <p className="mt-3 flex items-center gap-2 text-sm text-red-400"><AlertTriangle size={14} />{authError}</p>}
          {!supabase && <p className="mt-3 text-xs text-red-400">Supabase environment variables are missing.</p>}

          <button
            onClick={login}
            disabled={loadingAuth || !accessKey.trim()}
            className="mt-5 w-full rounded-lg bg-gradient-to-r from-[#F5C542] to-[#FFD700] py-3 font-heading text-xs font-black uppercase tracking-[0.14em] text-[#05070D] shadow-[0_0_20px_rgba(245,197,66,0.25)] transition hover:shadow-[0_0_28px_rgba(245,197,66,0.45)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingAuth ? "VALIDATING..." : "ENTER DASHBOARD"}
          </button>

          <button
            onClick={clearSavedAccessKey}
            type="button"
            className={`mt-2 w-full rounded-lg border py-2 font-subheading text-xs ${
              loginDark
                ? "border-red-400/40 text-red-300 hover:bg-red-500/10"
                : "border-red-500/40 text-red-700 hover:bg-red-50"
            }`}
          >
            CLEAR SAVED KEY
          </button>

          <div className={`mt-5 rounded border p-3 text-xs ${loginDark ? "border-[#1F2937] bg-[#05070D] text-[#9CA3AF]" : "border-slate-300 bg-slate-50 text-slate-700"}`}>
            One access key hanya boleh aktif pada satu device pada satu masa.
          </div>
        </section>
      </main>
    );
  }

  const isDark = theme === "dark";
  const isExecutive = designVariant === "executive";

  if (isExecutive) {
    return (
      <KapitanTerminalDashboard
        isDark={isDark}
        accountName={accountName}
        accountPackage={accountPackage}
        subscriptionExpiry={subscriptionExpiry}
        sessionSeconds={sessionSeconds}
        lastSync={lastSync}
        mode={mode}
        setMode={setMode}
        activeSignal={activeSignal}
        signals={signals}
        logs={logs}
        riskAmount={riskAmount}
        setRiskAmount={setRiskAmount}
        lotSize={lotSize}
        nextSignalCountdown={nextSignalCountdown}
        nowMs={nowMs}
        isRefreshing={isRefreshing}
        refreshNow={refreshNow}
        logout={logout}
        setTheme={setTheme}
        copyLot={copyLot}
      />
    );
  }

  return (
    <main className={`kapitan-dashboard min-h-screen ${isDark ? "" : "light-theme bg-[#e2e8f0] text-[#0f172a]"} ${isExecutive ? "design-executive" : ""}`}>
      <div className="flex min-h-screen">
        {isExecutive && (
          <aside className="hidden lg:flex w-64 shrink-0 flex-col justify-between border-r border-[#1F2937]/70 bg-[#05070D]">
            <div className="p-6">
              <div className="mb-8 flex items-center gap-2 border-b border-[#1F2937]/70 pb-4">
                <div className="grid h-7 w-7 place-items-center rounded bg-gradient-to-br from-[#F5C542] to-[#FFD700] text-[#05070D]">
                  <Signal size={14} />
                </div>
                <span className="font-heading text-sm font-black tracking-[0.08em] text-[#F5C542]">KAPITAN SIGNAL</span>
              </div>
              <nav className="space-y-1 font-subheading text-sm uppercase tracking-[0.08em]">
                <a href="#dashboard" className="block rounded border border-[#F5C542]/25 bg-[#F5C542]/10 px-3 py-2 text-[#F5C542]">Dashboard</a>
                <a href="#live-signals" className="block rounded px-3 py-2 text-[#9CA3AF] hover:bg-[#111827] hover:text-[#F9FAFB]">Live Signals</a>
                <a href="#risk-engine" className="block rounded px-3 py-2 text-[#9CA3AF] hover:bg-[#111827] hover:text-[#F9FAFB]">Risk Engine</a>
                <a href="#performance" className="block rounded px-3 py-2 text-[#9CA3AF] hover:bg-[#111827] hover:text-[#F9FAFB]">Performance</a>
                <a href="#account" className="block rounded px-3 py-2 text-[#9CA3AF] hover:bg-[#111827] hover:text-[#F9FAFB]">Account</a>
              </nav>
            </div>
            <div className="border-t border-[#1F2937]/70 p-4">
              <button onClick={logout} className="w-full rounded border border-red-400/45 bg-[#111827] px-3 py-2 font-subheading text-xs uppercase tracking-[0.08em] text-red-300 hover:bg-red-500/10">
                Logout Terminal
              </button>
            </div>
          </aside>
        )}

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-[#1F2937]/70 bg-[#05070D]/90 px-4 py-4 backdrop-blur lg:px-8">
            <div className="mx-auto flex w-full max-w-7xl items-center justify-between">
              <div>
                <h1 className="font-heading text-lg font-black tracking-[0.06em] text-[#F9FAFB]">Welcome Back, Captain</h1>
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#9CA3AF]">Gold Command Center Terminal Active</p>
              </div>
              <div className="hidden items-center gap-3 sm:flex">
                <span className="rounded border border-[#F5C542]/30 bg-[#F5C542]/10 px-2 py-1 font-heading text-[10px] font-black tracking-[0.08em] text-[#F5C542]">{commandPlanLabel}</span>
                <span className="inline-block h-2 w-2 rounded-full bg-[#10B981]" />
              </div>
            </div>
          </header>

          <div className="px-3 py-4 sm:px-6 lg:p-8">
      <div id="dashboard" className={`scanlines mx-auto max-w-7xl rounded-2xl p-3 sm:p-6 ${isDark ? "border border-emerald-500/40 bg-black/80 shadow-[0_0_60px_rgba(16,185,129,0.16)]" : "border border-[#0f172a]/20 bg-[#f8fafc] shadow-[0_10px_30px_rgba(15,23,42,0.14)]"}`}>
        {isExecutive ? (
          <header className="mb-5 border-b border-emerald-400/20 pb-4 text-[11px] uppercase tracking-[0.16em] text-emerald-300 sm:text-xs sm:tracking-[0.2em]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="exec-top-brand leading-none text-blue-400">KAPITAN SIGNAL</p>
                <p className="exec-top-sub mt-1">EVERY SIGNAL IS A MISSION.</p>
              </div>
              <div className="exec-action-group flex flex-wrap items-center gap-2">
                <div className="mr-2 text-right">
                  <p className="text-[9px] tracking-[0.14em] text-emerald-300/65">ACCESS STATUS</p>
                  <p className="text-xs normal-case text-emerald-300">● Authorized</p>
                </div>
                <button onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))} className="exec-head-btn inline-flex items-center justify-center gap-1 rounded border border-emerald-400/40 px-2 py-1 text-[10px] hover:bg-emerald-500/20">
                  {isDark ? <Sun size={12} /> : <Moon size={12} />}
                  {isDark ? "Light" : "Dark"}
                </button>
                <button onClick={refreshNow} disabled={isRefreshing} className="exec-head-btn inline-flex items-center justify-center gap-1 rounded border border-emerald-400/40 px-2 py-1 text-[10px] hover:bg-emerald-500/20 disabled:opacity-50">
                  {isRefreshing ? "Syncing..." : "Refresh"}
                </button>
                <button onClick={logout} className="exec-head-btn exec-head-btn-danger inline-flex items-center justify-center gap-1 rounded border border-red-400/40 px-2 py-1 text-[10px] text-red-300 hover:bg-red-500/15">
                  Log out
                </button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[10px] tracking-[0.14em] text-emerald-300/80">
              <span className="inline-flex items-center gap-1"><User size={12} />{accountName}</span>
              <span className="inline-flex items-center gap-1"><Package size={12} />{accountPackage}</span>
              <span className="inline-flex items-center gap-1"><CalendarClock size={12} />{formatDateTime(subscriptionExpiry)}</span>
              <span className="inline-flex items-center gap-1"><Signal size={12} />XAUUSD</span>
              <span className="inline-flex items-center gap-1"><Timer size={12} />{String(Math.floor(sessionSeconds / 60)).padStart(2, "0")}:{String(sessionSeconds % 60).padStart(2, "0")}</span>
            </div>
          </header>
        ) : (
          <header className="mb-4 border-b border-emerald-400/20 pb-3 text-[11px] uppercase tracking-[0.16em] text-emerald-300 sm:mb-5 sm:pb-4 sm:text-xs sm:tracking-[0.2em]">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="grid gap-1">
                <div className="flex items-center gap-2"><ShieldCheck size={14} />System_Status: SECURE</div>
                <div className="flex items-center gap-2"><User size={14} />Account: {accountName}</div>
                <div className="flex items-center gap-2"><Package size={14} />Package: {accountPackage}</div>
                <div className="flex items-center gap-2">
                  <CalendarClock size={14} />
                  Subscription Expires: {formatDateTime(subscriptionExpiry)}
                </div>
                <div className="flex items-center gap-2"><Signal size={14} />Market: XAUUSD (LIVE)</div>
                <div className="flex items-center gap-2"><Timer size={14} />Session (App): {String(Math.floor(sessionSeconds / 60)).padStart(2, "0")}:{String(sessionSeconds % 60).padStart(2, "0")}</div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end md:pt-1">
                <button onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))} className="inline-flex items-center justify-center gap-1 rounded border border-emerald-400/40 px-2 py-1 text-[10px] hover:bg-emerald-500/20">
                  {isDark ? <Sun size={12} /> : <Moon size={12} />}
                  {isDark ? "Light" : "Dark"}
                </button>
                <button onClick={refreshNow} disabled={isRefreshing} className="inline-flex items-center justify-center gap-1 rounded border border-emerald-400/40 px-2 py-1 text-[10px] hover:bg-emerald-500/20 disabled:opacity-50">
                  {isRefreshing ? "Syncing..." : "Refresh"}
                </button>
                <button onClick={logout} className="inline-flex items-center justify-center gap-1 rounded border border-red-400/40 px-2 py-1 text-[10px] text-red-300 hover:bg-red-500/15">
                  Log out
                </button>
              </div>
            </div>
          </header>
        )}
        {lastSync && <p className="exec-last-sync mb-3 text-[10px] uppercase tracking-[0.15em] text-emerald-300/65">Last Sync: {lastSync}</p>}

        {isExecutive && (
          <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <article className="exec-stat-card rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-300/70">Active Signal</p>
              <p className="mt-2 text-lg font-bold text-emerald-100">
                {activeSignal ? `${activeSignal.type.toUpperCase()} ${activeSignal.mode.toUpperCase()}` : "NO ACTIVE"}
              </p>
            </article>
            <article className="exec-stat-card rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-300/70">Live Price</p>
              <p className="mt-2 text-lg font-bold text-emerald-100">{activeSignal ? fmt(activeSignal.live_price) : "-"}</p>
            </article>
            <article className="exec-stat-card rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-300/70">Signals Today</p>
              <p className="mt-2 text-lg font-bold text-emerald-100">{signalsTodayCount}</p>
            </article>
            <article className="exec-stat-card rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-300/70">Session Left</p>
              <p className="mt-2 text-lg font-bold text-emerald-100">
                {String(Math.floor(sessionSeconds / 60)).padStart(2, "0")}:{String(sessionSeconds % 60).padStart(2, "0")}
              </p>
            </article>
          </section>
        )}

        <nav className={`mb-4 flex gap-2 ${isExecutive ? "exec-pill-group w-fit" : ""}`}>
          <button
            onClick={() => setTab("signal")}
            className={`rounded px-3 py-2 text-sm ${tab === "signal" ? "bg-emerald-500/20 text-emerald-300 pulse" : "border border-emerald-400/30 text-emerald-400/70"} ${isExecutive ? "px-5 py-2 text-xs font-bold tracking-wide" : ""} ${isExecutive && tab === "signal" ? "exec-primary" : ""} ${isExecutive && tab !== "signal" ? "exec-muted border-transparent bg-transparent" : ""}`}
          >
            SIGNAL
          </button>
          <button
            onClick={() => setTab("performance")}
            className={`rounded px-3 py-2 text-sm ${tab === "performance" ? "bg-emerald-500/20 text-emerald-300 pulse" : "border border-emerald-400/30 text-emerald-400/70"} ${isExecutive ? "px-5 py-2 text-xs font-bold tracking-wide" : ""} ${isExecutive && tab === "performance" ? "exec-primary" : ""} ${isExecutive && tab !== "performance" ? "exec-muted border-transparent bg-transparent" : ""}`}
          >
            PERFORMANCE
          </button>
        </nav>

        <div className={`mb-4 flex gap-2 ${isExecutive ? "items-center justify-between" : ""}`}>
          <div className={`flex gap-2 ${isExecutive ? "exec-pill-group" : ""}`}>
            <button onClick={() => setMode("scalping")} className={`rounded border px-3 py-1 text-xs ${mode === "scalping" ? "border-emerald-300 bg-emerald-500/20" : "border-emerald-400/30"} ${isExecutive ? "px-8 py-2.5 text-sm font-extrabold tracking-wide uppercase" : ""} ${isExecutive && mode === "scalping" ? "exec-primary" : ""} ${isExecutive && mode !== "scalping" ? "exec-muted border-transparent bg-transparent" : ""}`}>Scalping</button>
            <button onClick={() => setMode("intraday")} className={`rounded border px-3 py-1 text-xs ${mode === "intraday" ? "border-emerald-300 bg-emerald-500/20" : "border-emerald-400/30"} ${isExecutive ? "px-8 py-2.5 text-sm font-extrabold tracking-wide uppercase" : ""} ${isExecutive && mode === "intraday" ? "exec-primary" : ""} ${isExecutive && mode !== "intraday" ? "exec-muted border-transparent bg-transparent" : ""}`}>Intraday</button>
          </div>
          {isExecutive && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-center">
              <p className="text-[10px] uppercase tracking-[0.16em] text-emerald-300/75">Next Signal</p>
              <p className="text-2xl font-semibold text-emerald-200">{nextSignalCountdown}</p>
            </div>
          )}
        </div>

        {tab === "signal" ? (
          isExecutive ? (
            <section className="space-y-4">
              <div className="grid gap-3 lg:grid-cols-2">
                <article className="rounded-xl border border-emerald-500/30 bg-[#111827] p-4">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-300/70">Scalping Window</p>
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-sm text-emerald-200">Every 30 Minutes</p>
                    <p className="font-mono text-base font-bold text-[#F5C542]">{formatClock(SCALPING_INTERVAL_SECONDS - (Math.floor(nowMs / 1000) % SCALPING_INTERVAL_SECONDS) || 0)}</p>
                  </div>
                </article>
                <article className="rounded-xl border border-emerald-500/30 bg-[#111827] p-4">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-300/70">Intraday Window</p>
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-sm text-emerald-200">Every 4 Hours</p>
                    <p className="font-mono text-base font-bold text-emerald-100">{formatClock(INTRADAY_INTERVAL_SECONDS - (Math.floor(nowMs / 1000) % INTRADAY_INTERVAL_SECONDS) || 0)}</p>
                  </div>
                </article>
              </div>

              <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
                <div className="exec-signal-panel rounded-2xl border border-emerald-500/30 p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-5xl font-bold tracking-tight text-emerald-200">XAUUSD</p>
                      <p className={`text-sm font-semibold tracking-[0.12em] ${activeSignal?.type === "buy" ? "text-emerald-300" : "text-red-400"}`}>
                        {activeSignal ? `${activeSignal.type.toUpperCase()} SETUP CONFIRMED` : "NO ACTIVE SETUP"}
                      </p>
                    </div>
                    <div className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-6 py-2 text-sm font-bold text-emerald-200">
                      EXECUTE {activeSignal?.type?.toUpperCase() ?? "SIGNAL"}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <Card title="Entry" value={activeSignal ? fmt(activeSignal.entry_target) : "-"} className="exec-card" copyValue={activeSignal ? fmt(activeSignal.entry_target) : undefined} />
                    <Card title="TP1" value={activeSignal ? fmt(activeSignal.tp1) : "-"} className="exec-card exec-card-tp" copyValue={activeSignal ? fmt(activeSignal.tp1) : undefined} />
                    <Card title="TP2" value={activeSignal ? fmt(activeSignal.tp2) : "-"} className="exec-card" copyValue={activeSignal ? fmt(activeSignal.tp2) : undefined} />
                    <Card title="TP3" value={activeSignal && activeSignal.tp3 !== null ? fmt(activeSignal.tp3) : "-"} className="exec-card" copyValue={activeSignal && activeSignal.tp3 !== null ? fmt(activeSignal.tp3) : undefined} />
                    <Card title="Stop Loss" value={activeSignal ? fmt(activeSignal.sl) : "-"} highlight={false} className="exec-card exec-card-sl" copyValue={activeSignal ? fmt(activeSignal.sl) : undefined} />
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <Card
                      title="Live Price"
                      value={activeSignal ? fmt(activeSignal.live_price) : "-"}
                      meta={activeSignal ? `Live Price Updated: ${new Date(activeSignal.updated_at ?? activeSignal.created_at).toLocaleTimeString()}` : "Live Price Updated: -"}
                      className="exec-card"
                    />
                    <Card
                      title="Pips Gain"
                      value={activeSignal ? `${pipGain(activeSignal).toFixed(1)} pips` : "-"}
                      meta={activeSignal ? `Pips Updated: ${new Date(activeSignal.updated_at ?? activeSignal.created_at).toLocaleTimeString()}` : "Pips Updated: -"}
                      className="exec-card"
                    />
                    <Card
                      title="Signal Direction"
                      value={activeSignal ? activeSignal.type.toUpperCase() : "-"}
                      highlight={activeSignal?.type !== "sell"}
                      className="exec-card"
                    />
                  </div>
                </div>

                <div id="risk-engine" className="exec-planner-panel rounded-2xl border border-emerald-500/30 p-5">
                  <p className="mb-3 text-4xl font-bold tracking-tight text-emerald-100">Tactical Planner</p>
                  <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-emerald-300/80">Risk Amount (USD)</label>
                  <input
                    value={riskAmount}
                    onChange={(e) => setRiskAmount(e.target.value)}
                    className={`mb-4 w-full rounded-xl border px-3 py-3 ${isDark ? "border-emerald-400/30 bg-black text-emerald-200" : "border-emerald-700/60 bg-white text-[#0f172a]"}`}
                  />
                  <div className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-5 text-center">
                    <p className="text-xs uppercase tracking-[0.2em] text-emerald-300/80">Recommended Lot Size</p>
                    <p className="mt-1 text-4xl font-bold text-emerald-200">{lotSize.toFixed(2)}</p>
                  </div>
                  <button onClick={copyLot} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300/50 px-3 py-3 text-sm font-semibold hover:bg-emerald-500/20">
                    <Clipboard size={14} />Copy Lot
                  </button>
                </div>
              </div>

            </section>
          ) : (
            <section className="space-y-4">
              <div className="rounded border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm">
                <span className="uppercase tracking-[0.2em] text-emerald-300/75">Next Signal</span>
                <p className="mt-1 text-2xl text-emerald-300">{nextSignalCountdown}</p>
              </div>
              {activeSignal && (
                <div className="rounded border border-emerald-500/30 px-4 py-2 text-sm">
                  <span className="uppercase tracking-[0.2em] text-emerald-300/75">Signal Direction</span>
                  <p className={`mt-1 text-xl ${activeSignal.type === "buy" ? "text-emerald-300" : "text-red-400"}`}>
                    {activeSignal.type.toUpperCase()}
                  </p>
                </div>
              )}
              <div className="grid gap-2 sm:gap-3 sm:grid-cols-3">
                <Card title="Entry" value={activeSignal ? fmt(activeSignal.entry_target) : "-"} copyValue={activeSignal ? fmt(activeSignal.entry_target) : undefined} />
                <Card
                  title="Live Price"
                  value={activeSignal ? fmt(activeSignal.live_price) : "-"}
                  meta={activeSignal ? `Live Price Updated: ${new Date(activeSignal.updated_at ?? activeSignal.created_at).toLocaleTimeString()}` : "Live Price Updated: -"}
                />
                <Card
                  title="Pips Gain"
                  value={activeSignal ? `${pipGain(activeSignal).toFixed(1)} pips` : "-"}
                  meta={activeSignal ? `Pips Updated: ${new Date(activeSignal.updated_at ?? activeSignal.created_at).toLocaleTimeString()}` : "Pips Updated: -"}
                />
              </div>

              {activeSignal && (
                <div className="rounded border border-emerald-500/30 p-4">
                  <p className="mb-2 text-xs uppercase tracking-[0.2em] text-emerald-300">Trading Levels</p>
                  <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 sm:text-sm">
                    <Level label="TP1" value={activeSignal.tp1} positive copyable />
                    <Level label="TP2" value={activeSignal.tp2} positive copyable />
                    <Level label="TP3" value={activeSignal.tp3 ?? 0} positive muted={!activeSignal.tp3} copyable={Boolean(activeSignal.tp3)} />
                    <Level label="Stop Loss" value={activeSignal.sl} danger copyable />
                  </div>
                </div>
              )}

              <div className="rounded border border-emerald-500/30 p-3 sm:p-4">
                <p className="mb-3 text-xs uppercase tracking-[0.2em] text-emerald-300">Risk Planner</p>
                <div className="flex flex-col gap-2 sm:gap-3 sm:flex-row sm:items-end">
                  <div className="w-full sm:max-w-xs">
                    <label className="mb-1 block text-xs text-emerald-300/80">Risk Amount (USD)</label>
                    <input
                      value={riskAmount}
                      onChange={(e) => setRiskAmount(e.target.value)}
                      className={`w-full rounded border px-3 py-2 ${isDark ? "border-emerald-400/30 bg-black text-emerald-200" : "border-emerald-700/60 bg-white text-[#0f172a]"}`}
                    />
                  </div>
                  <div className="rounded border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-2xl text-emerald-300 shadow-[0_0_25px_rgba(16,185,129,0.25)]">{lotSize.toFixed(2)} LOT</div>
                  <button onClick={copyLot} className="inline-flex items-center justify-center gap-2 rounded border border-emerald-300/50 px-3 py-2 text-sm hover:bg-emerald-500/20 sm:px-4"><Clipboard size={14} />Copy Lot</button>
                </div>
              </div>
            </section>
          )
        ) : (
          <section id="performance" className="space-y-4">
            <div className="flex flex-wrap items-end gap-2 rounded border border-emerald-500/30 p-3">
              <button onClick={() => setRangePreset("day")} className={`rounded border px-3 py-1 text-xs ${rangePreset === "day" ? "border-emerald-300 bg-emerald-500/20" : "border-emerald-400/30"}`}>Day</button>
              <button onClick={() => setRangePreset("week")} className={`rounded border px-3 py-1 text-xs ${rangePreset === "week" ? "border-emerald-300 bg-emerald-500/20" : "border-emerald-400/30"}`}>Week</button>
              <button onClick={() => setRangePreset("month")} className={`rounded border px-3 py-1 text-xs ${rangePreset === "month" ? "border-emerald-300 bg-emerald-500/20" : "border-emerald-400/30"}`}>Month</button>
              <button onClick={() => setRangePreset("custom")} className={`rounded border px-3 py-1 text-xs ${rangePreset === "custom" ? "border-emerald-300 bg-emerald-500/20" : "border-emerald-400/30"}`}>Custom</button>
              {rangePreset === "custom" && (
                <>
                  <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="rounded border border-emerald-400/40 bg-black/20 px-2 py-1 text-xs" />
                  <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="rounded border border-emerald-400/40 bg-black/20 px-2 py-1 text-xs" />
                </>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <Card title="Win Rate %" value={`${stats.winRate.toFixed(1)}%`} />
              <Card title="Total Pips" value={stats.totalPips.toFixed(1)} />
              <Card title="Signal Count" value={String(stats.signalCount)} />
              <Card title="Total TP" value={String(stats.totalTp)} />
              <Card title="Total BE" value={String(stats.totalBe)} />
              <Card title="Total SL" value={String(stats.totalSl)} highlight={false} />
            </div>

            <div className="rounded border border-emerald-500/30 p-4">
              <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-emerald-300"><BarChart3 size={14} />Profit Loss Distribution</p>
              <div className="space-y-2 text-xs">
                <Dist label="TP1" count={stats.byTp.tp1} total={stats.signalCount} />
                <Dist label="TP2" count={stats.byTp.tp2} total={stats.signalCount} />
                <Dist label="TP3" count={stats.byTp.tp3} total={stats.signalCount} />
                <Dist label="BE" count={stats.byTp.be} total={stats.signalCount} />
                <Dist label="SL" count={stats.byTp.sl} total={stats.signalCount} />
              </div>
            </div>

            <div className="overflow-x-auto rounded border border-emerald-500/30">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-emerald-500/10 text-emerald-200">
                  <tr>
                    <th className="min-w-[165px] px-3 py-2">Timestamp</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Outcome</th>
                    <th className="px-3 py-2">Net Pips</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLogs.map((item) => (
                    <tr key={item.id} className="border-t border-emerald-500/20">
                      <td className="px-3 py-2">{formatDateTime(item.created_at)}</td>
                      <td className={`px-3 py-2 uppercase ${item.type === "buy" ? "text-emerald-300" : "text-red-400"}`}>{item.type}</td>
                      <td className="px-3 py-2 uppercase">{item.outcome}</td>
                      <td className={`px-3 py-2 ${item.net_pips >= 0 ? "text-emerald-300" : "text-red-400"}`}>{item.net_pips.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-emerald-300/70">
                <span>Rows:</span>
                <select
                  value={String(performancePageSize)}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setPerformancePageSize(raw === "all" ? "all" : Number(raw));
                  }}
                  className="rounded border border-emerald-400/40 bg-transparent px-2 py-1 text-emerald-300"
                >
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                  <option value="all">Show All</option>
                </select>
              </div>
              <p className="text-emerald-300/70">
                Showing {visibleLogs.length} of {filteredLogs.length} records
              </p>
              <div className="flex items-center gap-2">
                {performancePageSize !== "all" && (
                  <span className="text-emerald-300/70">
                    Page {performancePage} / {totalPerformancePages}
                  </span>
                )}
                {performancePageSize !== "all" && (
                  <button
                    onClick={() => setPerformancePage((prev) => Math.max(1, prev - 1))}
                    disabled={performancePage <= 1}
                    className="rounded border border-emerald-400/40 px-3 py-1 text-emerald-300 hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Prev
                  </button>
                )}
                {performancePageSize !== "all" && (
                  <button
                    onClick={() => setPerformancePage((prev) => Math.min(totalPerformancePages, prev + 1))}
                    disabled={performancePage >= totalPerformancePages}
                    className="rounded border border-emerald-400/40 px-3 py-1 text-emerald-300 hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                )}
              </div>
            </div>
          </section>
        )}
      </div>
          </div>
        </div>
      </div>
      {showLoginDisclaimer && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 px-4">
          <div className={`w-full max-w-xl rounded-2xl border p-6 text-center ${isDark ? "border-emerald-400/30 bg-slate-900 text-emerald-100" : "border-[#0f172a]/20 bg-[#f8fafc] text-[#0f172a]"}`}>
            <h3 className={`text-xl font-bold ${isDark ? "text-emerald-200" : "text-[#1e3a8a]"}`}>Important Trading Disclaimer</h3>
            <div className={`mt-4 space-y-3 text-center text-sm leading-relaxed ${isDark ? "text-emerald-100/90" : "text-[#334155]"}`}>
              <p>Trading involves high risk, and past performance does not guarantee future results.</p>
              <p>You are fully responsible for your own trading decisions and risk management.</p>
              <p>By continuing, you acknowledge and accept these terms.</p>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => setShowLoginDisclaimer(false)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${isDark ? "border border-emerald-400/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25" : "border border-[#2563eb]/40 bg-[#2563eb] text-white hover:bg-[#1d4ed8]"}`}
              >
                I Understand, Continue
              </button>
              <button
                onClick={logout}
                className="rounded-xl border border-red-400/50 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/10"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
      {activeSignalPopup && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/45 px-4">
          <div className={`w-full max-w-md rounded-2xl border p-5 text-center ${isDark ? "border-emerald-400/30 bg-slate-900 text-emerald-100" : "border-[#0f172a]/20 bg-[#f8fafc] text-[#0f172a]"}`}>
            <p className={`text-xs uppercase tracking-[0.16em] ${activeSignalPopup.kind === "sl" ? "text-red-400" : "text-emerald-300"}`}>Live Alert</p>
            <h3 className={`mt-1 text-xl font-bold ${isDark ? "text-emerald-200" : "text-[#1e3a8a]"}`}>{activeSignalPopup.title}</h3>
            <p className={`mt-3 text-sm ${isDark ? "text-emerald-100/90" : "text-[#334155]"}`}>{activeSignalPopup.message}</p>
            <button
              onClick={() => setActiveSignalPopup(null)}
              className={`mt-5 rounded-xl px-4 py-2 text-sm font-semibold ${isDark ? "border border-emerald-400/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25" : "border border-[#2563eb]/40 bg-[#2563eb] text-white hover:bg-[#1d4ed8]"}`}
            >
              Close
            </button>
          </div>
        </div>
      )}
      {liveAlerts.length > 0 && (
        <div className="fixed right-3 top-3 z-30 w-[320px] max-w-[85vw] space-y-2">
          {liveAlerts.slice(0, 3).map((alert) => (
            <div key={alert.id} className={`rounded-xl border p-3 shadow-lg ${isDark ? "border-emerald-500/30 bg-slate-900/95" : "border-[#0f172a]/20 bg-[#f8fafc]/95"}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className={`text-xs uppercase tracking-[0.16em] ${alert.kind === "sl" ? "text-red-400" : "text-emerald-300"}`}>{alert.kind === "signal" ? "Signal" : alert.kind.toUpperCase()}</p>
                  <p className={`mt-0.5 text-sm font-semibold ${isDark ? "text-emerald-100" : "text-[#1e3a8a]"}`}>{alert.title}</p>
                  <p className={`mt-1 text-xs ${isDark ? "text-emerald-100/80" : "text-[#334155]"}`}>{alert.message}</p>
                </div>
                <button
                  onClick={() => setLiveAlerts((prev) => prev.filter((x) => x.id !== alert.id))}
                  className={`rounded border px-2 py-0.5 text-[10px] ${isDark ? "border-emerald-500/40 text-emerald-200" : "border-[#0f172a]/20 text-[#334155]"}`}
                >
                  X
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

function KapitanTerminalDashboard({
  isDark,
  accountName,
  accountPackage,
  subscriptionExpiry,
  sessionSeconds,
  lastSync,
  mode,
  setMode,
  activeSignal,
  signals,
  logs,
  riskAmount,
  setRiskAmount,
  lotSize,
  nextSignalCountdown,
  nowMs,
  isRefreshing,
  refreshNow,
  logout,
  setTheme,
  copyLot,
}: {
  isDark: boolean;
  accountName: string;
  accountPackage: string;
  subscriptionExpiry: string | null;
  sessionSeconds: number;
  lastSync: string | null;
  mode: SignalMode;
  setMode: (mode: SignalMode) => void;
  activeSignal: TradingSignal | undefined;
  signals: TradingSignal[];
  logs: PerformanceLog[];
  riskAmount: string;
  setRiskAmount: (value: string) => void;
  lotSize: number;
  nextSignalCountdown: string;
  nowMs: number;
  isRefreshing: boolean;
  refreshNow: () => Promise<void>;
  logout: () => void;
  setTheme: (value: "dark" | "light" | ((prev: "dark" | "light") => "dark" | "light")) => void;
  copyLot: () => Promise<void>;
}) {
  const [perfView, setPerfView] = useState<"all" | "scalping" | "intraday" | "tphit" | "slhit">("all");
  const todayMy = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" });
  const signalsToday = signals.filter((item) => new Date(item.created_at).toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" }) === todayMy).length;
  const wins = logs.filter((item) => item.outcome !== "sl").length;
  const winRate = logs.length > 0 ? Math.round((wins / logs.length) * 100) : 0;
  const hasActiveSignal = Boolean(activeSignal);
  const riskModeTitle = hasActiveSignal ? "AUTO" : "WAITING";
  const riskModeSub = hasActiveSignal ? "Risk Amount Input Only" : "Waiting Active Signal";
  const scalpingRemain = formatClock(SCALPING_INTERVAL_SECONDS - (Math.floor(nowMs / 1000) % SCALPING_INTERVAL_SECONDS) || 0);
  const intradayRemain = formatClock(INTRADAY_INTERVAL_SECONDS - (Math.floor(nowMs / 1000) % INTRADAY_INTERVAL_SECONDS) || 0);
  const commandPlanLabel = useMemo(() => {
    const pkg = (accountPackage ?? "").toLowerCase();
    if (pkg.includes("15")) return "CAPTAIN PLAN";
    if (pkg.includes("30")) return "COMMANDER ELITE";
    if (pkg.includes("7") || pkg.includes("trial") || pkg.includes("3")) return "SCOUT PLAN";
    return "ACTIVE PLAN";
  }, [accountPackage]);

  const performanceRows = logs.filter((row) => {
    if (perfView === "all") return true;
    if (perfView === "scalping") return row.mode === "scalping";
    if (perfView === "intraday") return row.mode === "intraday";
    if (perfView === "tphit") return row.outcome === "tp1" || row.outcome === "tp2" || row.outcome === "tp3";
    if (perfView === "slhit") return row.outcome === "sl";
    return true;
  }).slice(0, 20);

  const archiveRows = signals.slice(0, 6);

  return (
    <main className={`kapitan-dashboard min-h-screen ${isDark ? "bg-[#05070D] text-[#F9FAFB]" : "bg-[#e2e8f0] text-[#0f172a]"}`}>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 shrink-0 border-r border-[#1F2937]/70 bg-[#05070D] lg:flex lg:flex-col lg:justify-between">
        <div className="space-y-8 p-6">
          <div className="flex items-center space-x-2 border-b border-[#1F2937]/40 pb-4">
            <div className="grid h-7 w-7 place-items-center rounded bg-gradient-to-br from-[#F5C542] to-[#FFD700] text-[#05070D]">
              <Signal size={14} />
            </div>
            <span className="font-heading text-sm font-black tracking-wider text-[#F5C542]">KAPITAN SIGNAL</span>
          </div>
          <nav className="space-y-1 font-subheading text-base font-bold uppercase tracking-wider">
            <a href="#dashboard" className="flex items-center gap-3 rounded border-l-2 border-[#F5C542] bg-gradient-to-r from-[#F5C542]/10 to-transparent px-3 py-2.5 text-[#F5C542]">DASHBOARD</a>
            <a href="#live-signals" className="flex items-center gap-3 rounded px-3 py-2.5 text-[#9CA3AF] hover:bg-[#111827] hover:text-[#F9FAFB]">LIVE SIGNALS</a>
            <a href="#risk-engine" className="flex items-center gap-3 rounded px-3 py-2.5 text-[#9CA3AF] hover:bg-[#111827] hover:text-[#F9FAFB]">RISK ENGINE</a>
            <a href="#performance" className="flex items-center gap-3 rounded px-3 py-2.5 text-[#9CA3AF] hover:bg-[#111827] hover:text-[#F9FAFB]">PERFORMANCE</a>
            <a href="#archive" className="flex items-center gap-3 rounded px-3 py-2.5 text-[#9CA3AF] hover:bg-[#111827] hover:text-[#F9FAFB]">SIGNAL HISTORY</a>
            <a href="#account" className="flex items-center gap-3 rounded px-3 py-2.5 text-[#9CA3AF] hover:bg-[#111827] hover:text-[#F9FAFB]">ACCOUNT</a>
            <a href="#support" className="flex items-center gap-3 rounded px-3 py-2.5 text-[#9CA3AF] hover:bg-[#111827] hover:text-[#F9FAFB]">SUPPORT</a>
          </nav>
        </div>
        <div className="border-t border-[#1F2937]/40 p-4">
          <button onClick={logout} className="w-full rounded border border-[#1F2937] bg-[#111827] py-2 text-xs font-mono text-[#9CA3AF] hover:border-red-500/50 hover:text-red-400">
            LOGOUT TERMINAL
          </button>
        </div>
      </aside>

      <div className="min-h-screen lg:pl-64">
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-[#1F2937]/40 bg-[#05070D]/90 px-4 backdrop-blur-md lg:px-8">
          <div>
            <h1 className="font-heading text-xl font-black tracking-wide text-[#F9FAFB]">Welcome Back, Captain</h1>
            <p className="hidden font-mono text-[11px] uppercase tracking-widest text-[#9CA3AF] sm:block">Gold Command Center Terminal Active</p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="hidden text-right font-mono text-[11px] sm:block">
              <span className="font-bold text-[#F9FAFB]">Secure Node</span>
              <span className="flex items-center justify-end text-[#10B981]"><span className="mr-1 h-1.5 w-1.5 rounded-full bg-[#10B981]" />Device Secured</span>
            </div>
            <div className="flex h-10 items-center space-x-2 rounded-lg border border-[#1F2937] bg-[#111827] px-3">
              <button onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))} className="rounded border border-[#F5C542]/30 px-2 py-1 text-[10px] font-heading font-black text-[#F5C542]">
                {isDark ? "LIGHT" : "DARK"}
              </button>
              <button onClick={refreshNow} disabled={isRefreshing} className="rounded border border-[#1F2937] px-2 py-1 text-[10px] font-heading font-black text-[#F9FAFB]">
                {isRefreshing ? "SYNC..." : "REFRESH"}
              </button>
              <span className="rounded border border-[#F5C542]/20 bg-[#F5C542]/10 px-2 py-1 text-[10px] font-heading font-black text-[#F5C542]">{commandPlanLabel}</span>
              <span className="h-2 w-2 rounded-full bg-[#10B981]" />
            </div>
          </div>
        </header>

        <main id="dashboard" className="mx-auto w-full max-w-7xl space-y-8 p-4 lg:p-8">
          <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-xl border border-[#1F2937] bg-[#111827]/80 p-4">
              <p className="font-mono text-[11px] uppercase tracking-wider text-[#C9D6E8]">Active Signal</p>
              <h3 className="mt-1 font-heading text-2xl font-black text-[#10B981]">{activeSignal ? "1" : "0"}</h3>
              <span className="font-mono text-[10px] text-[#10B981]">{activeSignal ? "● Live Now" : "● Standby"}</span>
            </div>
            <div className="rounded-xl border border-[#1F2937] bg-[#111827]/80 p-4">
              <p className="font-mono text-[11px] uppercase tracking-wider text-[#C9D6E8]">Win Rate</p>
              <h3 className="mt-1 font-heading text-2xl font-black text-[#F5C542]">{winRate}%</h3>
              <span className="font-mono text-[11px] text-[#B8C7DC]">Based on current logs</span>
            </div>
            <div className="rounded-xl border border-[#1F2937] bg-[#111827]/80 p-4">
              <p className="font-mono text-[11px] uppercase tracking-wider text-[#C9D6E8]">Signals Today</p>
              <h3 className="mt-1 font-heading text-2xl font-black text-[#F9FAFB]">{signalsToday}</h3>
              <span className="font-mono text-[11px] text-[#B8C7DC]">Scalping + Intraday</span>
            </div>
            <div className="rounded-xl border border-[#1F2937] bg-[#111827]/80 p-4">
              <p className="font-mono text-[11px] uppercase tracking-wider text-[#C9D6E8]">Risk Mode</p>
              <h3 className="mt-1 font-heading text-2xl font-black text-[#F9FAFB]">{riskModeTitle}</h3>
              <span className="font-mono text-[11px] text-[#10B981]">{riskModeSub}</span>
            </div>
          </section>

          <section className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-4" id="countdown-anchor">
              <div className="space-y-3 rounded-xl border border-[#334155]/80 bg-[#111827]/90 p-4 shadow-[0_0_24px_rgba(15,23,42,0.35)]">
                <div className="flex items-center justify-between">
                  <h4 className="font-heading text-sm font-black uppercase tracking-wider text-[#F9FAFB]">Signal Window</h4>
                  <span className="h-2 w-2 rounded-full bg-[#F5C542]" />
                </div>
                <div className="h-[1px] w-full bg-[#334155]/70" />

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setMode("scalping")}
                    className={`rounded border px-3 py-2 text-left font-mono text-xs uppercase tracking-wider transition ${
                      mode === "scalping"
                        ? "border-[#F5C542]/70 bg-[#F5C542]/15 text-[#F5C542]"
                        : "border-[#334155]/80 bg-[#05070D] text-[#D3DEED] hover:border-[#F5C542]/50"
                    }`}
                  >
                    SCALPING
                  </button>
                  <button
                    onClick={() => setMode("intraday")}
                    className={`rounded border px-3 py-2 text-left font-mono text-xs uppercase tracking-wider transition ${
                      mode === "intraday"
                        ? "border-[#F5C542]/70 bg-[#F5C542]/15 text-[#F5C542]"
                        : "border-[#334155]/80 bg-[#05070D] text-[#D3DEED] hover:border-[#F5C542]/50"
                    }`}
                  >
                    INTRADAY
                  </button>
                </div>

                {mode === "scalping" ? (
                  <div className="flex items-center justify-between rounded border border-[#334155]/80 bg-[#05070D] p-3 font-mono">
                    <div>
                      <span className="block text-xs font-bold text-[#F9FAFB]">SCALPING WINDOW</span>
                      <span className="text-[10px] text-[#C9D6E8]">Every 30 minutes</span>
                    </div>
                    <span className="rounded border border-[#334155] bg-[#111827] px-2.5 py-1 text-base font-bold tracking-widest text-[#F5C542]">{scalpingRemain}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between rounded border border-[#334155]/80 bg-[#05070D] p-3 font-mono">
                    <div>
                      <span className="block text-xs font-bold text-[#F9FAFB]">INTRADAY WINDOW</span>
                      <span className="text-[10px] text-[#C9D6E8]">Every 4 hours</span>
                    </div>
                    <span className="rounded border border-[#334155] bg-[#111827] px-2.5 py-1 text-base font-bold tracking-widest text-[#F9FAFB]">{intradayRemain}</span>
                  </div>
                )}
                <div className="flex items-center justify-center space-x-1.5 pt-1 font-mono text-[11px] text-[#C9D6E8]">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#F5C542]" />
                  <span>Market scanning in progress...</span>
                </div>
              </div>
            </div>

            <div id="live-signals" className="lg:col-span-8">
              <div className="relative overflow-hidden rounded-xl border-2 border-[#F5C542]/40 bg-[#111827]/80 p-6 shadow-2xl">
                <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#F5C542] to-transparent" />
                <div className="flex flex-col gap-3 border-b border-[#1F2937] pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="rounded border border-[#10B981]/20 bg-[#10B981]/10 px-2 py-0.5 font-heading text-[10px] font-black tracking-wider text-[#10B981]">
                        {mode === "scalping" ? "SCALPING" : "INTRADAY"}
                      </span>
                      <span className="font-mono text-xs text-[#C9D6E8]">ID: #{activeSignal?.id?.slice(0, 8).toUpperCase() ?? "XAU-0000"}</span>
                    </div>
                    <h3 className={`mt-1 font-heading text-3xl font-black tracking-wide ${activeSignal?.type === "sell" ? "text-[#EF4444]" : "text-[#10B981]"}`}>
                      {(activeSignal?.type ?? "buy").toUpperCase()} XAUUSD
                    </h3>
                  </div>
                  <div className="flex items-baseline justify-between font-mono sm:flex-col sm:items-end">
                    <span className="mr-2 text-[10px] uppercase text-[#C9D6E8] sm:mr-0">CONFIDENCE</span>
                    <span className="font-heading text-2xl font-black text-[#F5C542]">{activeSignal ? "91%" : "0%"}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 py-6 font-mono sm:grid-cols-12">
                  <div className="space-y-3 sm:col-span-5">
                    <div className="rounded border border-[#1F2937] bg-[#05070D] p-3">
                      <p className="text-[10px] uppercase text-[#C9D6E8]">ENTRY RANGE</p>
                      <p className="mt-1 text-3xl font-bold text-[#F9FAFB]">{activeSignal ? fmt(activeSignal.entry_target) : "-"}</p>
                    </div>
                    <div className="rounded border border-[#EF4444]/40 bg-[#05070D] p-3">
                      <p className="text-[10px] uppercase text-[#EF4444]">STOP LOSS</p>
                      <p className="mt-1 text-3xl font-bold text-[#EF4444]">{activeSignal ? fmt(activeSignal.sl) : "-"}</p>
                    </div>
                    <div className="flex items-center justify-between rounded border border-[#1F2937] bg-[#05070D] px-3 py-2 text-sm">
                      <span className="text-[#C9D6E8]">Risk Ratio:</span>
                      <span className="font-heading font-black text-[#F9FAFB]">1 : 3.2</span>
                    </div>
                  </div>

                  <div className="space-y-2 sm:col-span-7">
                    <div className="rounded border border-[#1F2937] bg-[#05070D] p-3">
                      <div className="flex items-center justify-between text-[10px] uppercase text-[#C9D6E8]">
                        <span>TAKE PROFIT 1</span>
                        <span className="rounded bg-[#10B981]/15 px-2 py-0.5 text-[#10B981]">CORE TARGET</span>
                      </div>
                      <p className="mt-1 text-3xl font-bold text-[#10B981]">{activeSignal ? fmt(activeSignal.tp1) : "-"}</p>
                    </div>
                    <div className="rounded border border-[#1F2937] bg-[#05070D] p-3">
                      <div className="flex items-center justify-between text-[10px] uppercase text-[#C9D6E8]">
                        <span>TAKE PROFIT 2</span>
                        <span>Runner Target</span>
                      </div>
                      <p className="mt-1 text-2xl font-bold text-[#F9FAFB]">{activeSignal ? fmt(activeSignal.tp2) : "-"}</p>
                    </div>
                    <div className="rounded border border-[#1F2937] bg-[#05070D] p-3">
                      <div className="flex items-center justify-between text-[10px] uppercase text-[#C9D6E8]">
                        <span>TAKE PROFIT 3</span>
                        <span>Extended Target</span>
                      </div>
                      <p className="mt-1 text-2xl font-bold text-[#F9FAFB]">{activeSignal && activeSignal.tp3 !== null ? fmt(activeSignal.tp3) : "-"}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 border-t border-[#1F2937] pt-4 font-mono text-xs">
                  <div className="flex items-center justify-between text-[10px] uppercase text-[#C9D6E8]">
                    <span>Execution Timeline</span>
                    <span className="text-[#10B981]">Status: Processing</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    <div className="rounded border border-[#10B981] bg-[#10B981]/15 px-2 py-1 text-center text-[#10B981]">Released</div>
                    <div className="rounded border border-[#10B981] bg-[#10B981]/15 px-2 py-1 text-center text-[#10B981]">Active</div>
                    <div className="rounded border border-[#1F2937] bg-[#111827] px-2 py-1 text-center text-[#C9D6E8]">TP1 Pending</div>
                    <div className="rounded border border-[#1F2937] bg-[#111827] px-2 py-1 text-center text-[#C9D6E8]">TP2 Pending</div>
                    <div className="rounded border border-[#1F2937] bg-[#111827] px-2 py-1 text-center text-[#C9D6E8]">TP3 Pending</div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <button className="rounded-lg border border-[#1F2937] bg-[#05070D] py-2 font-subheading text-sm font-bold text-[#F9FAFB]">Copy Signal</button>
                  <button className="rounded-lg border border-[#1F2937] bg-[#05070D] py-2 font-subheading text-sm font-bold text-[#F9FAFB]">Calculate Risk</button>
                  <button className="rounded-lg border border-[#1F2937] bg-[#05070D] py-2 font-subheading text-sm font-bold text-[#F9FAFB]">Mark Watched</button>
                </div>
              </div>
            </div>
          </section>

          <section id="risk-engine" className="rounded-xl border border-[#1F2937] bg-[#111827]/80 p-6">
            <h3 className="font-heading text-4xl font-black text-[#F5C542]">GOLD RISK ENGINE™</h3>
            <p className="mt-2 text-[#9CA3AF]">Masukkan amount risiko sahaja. Lot size dikira automatik berdasarkan Entry dan SL semasa.</p>
            {!hasActiveSignal && (
              <div className="mt-4 rounded border border-[#F5C542]/35 bg-[#F5C542]/10 px-3 py-2 font-mono text-xs text-[#F5C542]">
                Waiting active signal... Entry dan Stop Loss akan auto isi bila signal baru masuk.
              </div>
            )}
            <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="space-y-4 lg:col-span-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-[#9CA3AF]">Currency</label>
                    <select className="w-full rounded border border-[#1F2937] bg-[#05070D] px-3 py-2 font-mono text-[#F9FAFB]">
                      <option>USD ($)</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-[#9CA3AF]">Risk Amount</label>
                    <input value={riskAmount} onChange={(e) => setRiskAmount(e.target.value)} className="w-full rounded border border-[#1F2937] bg-[#05070D] px-3 py-2 font-mono text-[#F9FAFB]" />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-[#9CA3AF]">Entry (Auto)</label>
                    <div className="flex h-[42px] items-center rounded border border-[#1F2937] bg-[#05070D] px-3 font-mono text-[#F9FAFB]">
                      {activeSignal ? fmt(activeSignal.entry_target) : "-"}
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-[#EF4444]">Stop Loss (Auto)</label>
                    <div className="flex h-[42px] items-center rounded border border-[#1F2937] bg-[#05070D] px-3 font-mono text-[#F9FAFB]">
                      {activeSignal ? fmt(activeSignal.sl) : "-"}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-3">
                  <button
                    onClick={() => void copyLot()}
                    disabled={!hasActiveSignal}
                    className={`rounded px-4 py-2 font-heading text-base font-black ${
                      hasActiveSignal
                        ? "bg-[#F5C542] text-[#05070D]"
                        : "cursor-not-allowed bg-[#F5C542]/35 text-[#1F2937]"
                    }`}
                  >
                    COPY AUTO LOT
                  </button>
                  <button onClick={() => setRiskAmount("100")} className="rounded border border-[#1F2937] bg-[#05070D] px-5 py-2 font-mono text-[#9CA3AF]">Reset</button>
                </div>
              </div>
              <div className="space-y-2 rounded-xl border border-[#1F2937] bg-[#05070D] p-4 lg:col-span-6">
                <div className="flex items-center justify-between rounded border border-[#1F2937] bg-[#111827] px-3 py-2">
                  <span className="font-mono text-[#9CA3AF]">Suggested Lot Size:</span>
                  <span className="font-heading text-2xl font-black text-[#10B981]">{hasActiveSignal ? `${lotSize.toFixed(2)} Lot` : "-"}</span>
                </div>
                <div className="flex items-center justify-between rounded border border-[#1F2937] bg-[#111827] px-3 py-2">
                  <span className="font-mono text-[#EF4444]">Max Projected Loss:</span>
                  <span className="font-heading text-2xl font-black text-[#EF4444]">{hasActiveSignal ? `$${Number(riskAmount || "0").toFixed(2)}` : "-"}</span>
                </div>
                <div className="pt-2 text-sm text-[#9CA3AF]">
                  <div className="flex justify-between border-b border-[#1F2937] py-1"><span>TP1 Est. Profit (+1.2R):</span><span className="text-[#F9FAFB]">{hasActiveSignal ? `$${(Number(riskAmount || "0") * 1.2).toFixed(2)}` : "-"}</span></div>
                  <div className="flex justify-between border-b border-[#1F2937] py-1"><span>TP2 Est. Profit (+2.2R):</span><span className="text-[#F9FAFB]">{hasActiveSignal ? `$${(Number(riskAmount || "0") * 2.2).toFixed(2)}` : "-"}</span></div>
                  <div className="flex justify-between border-b border-[#1F2937] py-1"><span>TP3 Est. Profit (+3.8R):</span><span className="text-[#F9FAFB]">{hasActiveSignal ? `$${(Number(riskAmount || "0") * 3.8).toFixed(2)}` : "-"}</span></div>
                </div>
              </div>
            </div>
          </section>

          <section id="performance" className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-heading text-4xl font-black text-[#F9FAFB]">PERFORMANCE LOG</h2>
                <p className="font-mono text-sm uppercase tracking-widest text-[#9CA3AF]">Audited Journal Ledger Logs</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setPerfView("all")} className={`rounded border px-3 py-1.5 text-xs font-mono ${perfView === "all" ? "border-[#F5C542] bg-[#F5C542] text-[#05070D]" : "border-[#1F2937] bg-[#111827] text-[#9CA3AF]"}`}>All</button>
                <button onClick={() => setPerfView("scalping")} className={`rounded border px-3 py-1.5 text-xs font-mono ${perfView === "scalping" ? "border-[#F5C542] bg-[#F5C542] text-[#05070D]" : "border-[#1F2937] bg-[#111827] text-[#9CA3AF]"}`}>Scalping</button>
                <button onClick={() => setPerfView("intraday")} className={`rounded border px-3 py-1.5 text-xs font-mono ${perfView === "intraday" ? "border-[#F5C542] bg-[#F5C542] text-[#05070D]" : "border-[#1F2937] bg-[#111827] text-[#9CA3AF]"}`}>Intraday</button>
                <button onClick={() => setPerfView("tphit")} className={`rounded border px-3 py-1.5 text-xs font-mono ${perfView === "tphit" ? "border-[#F5C542] bg-[#F5C542] text-[#05070D]" : "border-[#1F2937] bg-[#111827] text-[#9CA3AF]"}`}>TP Hit</button>
                <button onClick={() => setPerfView("slhit")} className={`rounded border px-3 py-1.5 text-xs font-mono ${perfView === "slhit" ? "border-[#F5C542] bg-[#F5C542] text-[#05070D]" : "border-[#1F2937] bg-[#111827] text-[#9CA3AF]"}`}>SL Hit</button>
              </div>
            </div>
            <div className="overflow-x-auto rounded-xl border border-[#1F2937] bg-[#111827]/80">
              <table className="w-full min-w-[760px] text-left">
                <thead className="border-b border-[#1F2937] bg-[#05070D] font-mono text-xs uppercase tracking-widest text-[#9CA3AF]">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Pair</th>
                    <th className="px-4 py-3">Direction</th>
                    <th className="px-4 py-3">Entry</th>
                    <th className="px-4 py-3">Result</th>
                    <th className="px-4 py-3">RR</th>
                    <th className="px-4 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-sm">
                  {performanceRows.map((row) => (
                    <tr key={row.id} className="border-b border-[#1F2937]/70">
                      <td className="px-4 py-3 text-[#BFDBFE]">{formatDateTime(row.created_at).split(",")[0] === formatDateTime(new Date().toISOString()).split(",")[0] ? "Today" : "Yesterday"}</td>
                      <td className="px-4 py-3"><span className={`${row.mode === "scalping" ? "text-[#F5C542]" : "text-[#60A5FA]"}`}>{row.mode === "scalping" ? "Scalping" : "Intraday"}</span></td>
                      <td className="px-4 py-3 text-[#F9FAFB]">XAUUSD</td>
                      <td className={`px-4 py-3 ${row.type === "buy" ? "text-[#10B981]" : "text-[#EF4444]"}`}>{row.type.toUpperCase()}</td>
                      <td className="px-4 py-3 text-[#F9FAFB]">{activeSignal ? fmt(activeSignal.entry_target) : "-"}</td>
                      <td className={`px-4 py-3 ${row.outcome === "sl" ? "text-[#EF4444]" : row.outcome === "be" ? "text-[#9CA3AF]" : "text-[#10B981]"}`}>{row.outcome.toUpperCase()}</td>
                      <td className={`px-4 py-3 ${row.net_pips >= 0 ? "text-[#10B981]" : "text-[#EF4444]"}`}>{row.net_pips >= 0 ? `+${(row.net_pips / 100).toFixed(1)}R` : `${(row.net_pips / 100).toFixed(1)}R`}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`rounded px-2 py-1 text-[10px] uppercase ${row.outcome === "sl" ? "bg-[#EF4444]/20 text-[#EF4444]" : "bg-[#10B981]/20 text-[#10B981]"}`}>
                          {row.outcome === "be" ? "LIVE" : "CLOSED"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div id="archive" className="space-y-4 rounded-xl border border-[#1F2937] bg-[#111827]/80 p-5 lg:col-span-6">
              <h4 className="font-heading text-3xl font-black uppercase tracking-[0.06em] text-[#F9FAFB]">Signal Archive</h4>
              <p className="font-mono text-xs uppercase tracking-widest text-[#9CA3AF]">Senarai Jejak Isyarat Terdahulu</p>
              {archiveRows.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded border border-[#1F2937] bg-[#05070D] p-3">
                  <div>
                    <p className={`font-subheading text-sm font-bold uppercase tracking-[0.06em] ${item.type === "buy" ? "text-[#10B981]" : "text-[#EF4444]"}`}>{item.type.toUpperCase()} XAUUSD ({item.mode === "scalping" ? "M30" : "H4"})</p>
                    <p className="font-mono text-xs uppercase tracking-[0.08em] text-[#9CA3AF]">Entry: {fmt(item.entry_target)} | SL: {fmt(item.sl)}</p>
                  </div>
                  <span className="rounded border border-[#10B981]/30 bg-[#10B981]/15 px-2 py-1 font-subheading text-[10px] uppercase tracking-[0.08em] text-[#10B981]">
                    {item.status === "active" ? "LIVE" : "CLOSED"}
                  </span>
                </div>
              ))}
            </div>

            <div id="account" className="space-y-4 rounded-xl border border-[#1F2937] bg-[#111827]/80 p-5 lg:col-span-6">
              <h4 className="font-heading text-3xl font-black uppercase tracking-[0.06em] text-[#F9FAFB]">Command Key Status</h4>
              <p className="font-mono text-xs uppercase tracking-widest text-[#9CA3AF]">One Key. One Trader. One Mission.</p>
              <div className="rounded border border-[#1F2937] bg-[#05070D] p-4 text-sm">
                <div className="flex justify-between border-b border-[#1F2937] py-2"><span className="font-mono text-[11px] uppercase tracking-widest text-[#9CA3AF]">Command Key:</span><span className="font-subheading text-sm font-bold uppercase tracking-[0.06em] text-[#F5C542]">KPS-ELITE-X92A</span></div>
                <div className="flex justify-between border-b border-[#1F2937] py-2"><span className="font-mono text-[11px] uppercase tracking-widest text-[#9CA3AF]">Active Plan:</span><span className="font-subheading text-sm font-bold uppercase tracking-[0.06em] text-[#F9FAFB]">{accountPackage}</span></div>
                <div className="flex justify-between border-b border-[#1F2937] py-2"><span className="font-mono text-[11px] uppercase tracking-widest text-[#9CA3AF]">Device Integrity:</span><span className="font-subheading text-sm font-bold uppercase tracking-[0.06em] text-[#10B981]">Secured Node</span></div>
                <div className="flex justify-between border-b border-[#1F2937] py-2"><span className="font-mono text-[11px] uppercase tracking-widest text-[#9CA3AF]">Last Authorization:</span><span className="font-subheading text-sm font-bold text-[#F9FAFB]">{lastSync ?? "-"}</span></div>
                <div className="flex justify-between py-2"><span className="font-mono text-[11px] uppercase tracking-widest text-[#9CA3AF]">Subscription Validation:</span><span className="font-subheading text-sm font-bold text-[#F5C542]">Active until {formatDateTime(subscriptionExpiry)}</span></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button className="rounded bg-[#F5C542] py-2 font-subheading text-sm font-black uppercase tracking-[0.08em] text-[#05070D]">Renew Package</button>
                <button onClick={logout} className="rounded border border-[#1F2937] bg-[#05070D] py-2 font-subheading text-sm font-bold uppercase tracking-[0.08em] text-[#9CA3AF]">Logout Device</button>
              </div>
            </div>
          </section>

          <section id="support" className="flex flex-col items-start justify-between gap-4 rounded-xl border border-[#1F2937] bg-gradient-to-r from-[#111827] via-[#111827] to-[#F5C542]/5 p-5 sm:flex-row sm:items-center">
            <div>
              <h4 className="font-heading text-3xl font-black uppercase tracking-[0.06em] text-[#F9FAFB]">Need Help, Captain?</h4>
              <p className="font-mono text-xs uppercase tracking-widest text-[#9CA3AF]">Talian Bantuan Sistem Sokongan Teknikal Beroperasi 24/7.</p>
            </div>
            <div className="flex gap-2">
              <button className="rounded border border-[#1F2937] bg-[#05070D] px-4 py-2 font-subheading text-sm font-bold uppercase tracking-[0.08em] text-[#F9FAFB]">Contact Admin</button>
              <button className="rounded border border-[#1F2937] bg-[#111827] px-4 py-2 font-subheading text-sm font-bold uppercase tracking-[0.08em] text-[#60A5FA]">Telegram Support</button>
            </div>
          </section>

          <section className="rounded-lg border border-[#EF4444]/30 bg-[#2b0f18]/40 p-4 font-mono text-xs text-[#FCA5A5]">
            Tactical Operation Risk Protocol Reminder: Trading XAUUSD mempunyai risiko tinggi. Signal bukan jaminan keuntungan.
            Gunakan risk management yang sesuai di setiap kemasukan order.
          </section>

          <footer className="pb-8 text-center font-mono text-[11px] text-[#64748B]">
            © 2026 KAPITAN SIGNAL. Operational Control Matrix Terminal. Command The Gold Market.
          </footer>
        </main>
      </div>
    </main>
  );
}

function Card({ title, value, meta, highlight = true, className = "", copyValue }: { title: string; value: string; meta?: string; highlight?: boolean; className?: string; copyValue?: string }) {
  const pipsMatch = value.match(/^(-?\d+(?:\.\d+)?)\s+pips$/i);
  const isCopyable = Boolean(copyValue);

  const handleCopy = async () => {
    if (!copyValue) return;
    await navigator.clipboard.writeText(copyValue);
  };

  return (
    <article
      className={`rounded border border-emerald-500/30 p-4 ${className} ${isCopyable ? "cursor-copy" : ""}`}
      onClick={isCopyable ? () => void handleCopy() : undefined}
      title={isCopyable ? `Copy ${title}` : undefined}
      role={isCopyable ? "button" : undefined}
      tabIndex={isCopyable ? 0 : undefined}
      onKeyDown={isCopyable ? (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          void handleCopy();
        }
      } : undefined}
    >
      <p className="mb-1 text-xs uppercase tracking-[0.2em] text-emerald-300/70">{title}</p>
      <p className={`text-2xl ${highlight ? "text-emerald-300" : "text-red-400"}`}>
        {pipsMatch ? (
          <span className="inline-flex items-end gap-2">
            <span>{pipsMatch[1]}</span>
            <span className="text-lg lowercase tracking-normal opacity-90">pips</span>
          </span>
        ) : (
          value
        )}
      </p>
      {meta && <p className="mt-2 text-xs text-emerald-300/60">{meta}</p>}
    </article>
  );
}

function Level({ label, value, positive, danger, muted, copyable = false }: { label: string; value: number; positive?: boolean; danger?: boolean; muted?: boolean; copyable?: boolean }) {
  const color = danger ? "text-red-400 border-red-400/40" : positive ? "text-emerald-300 border-emerald-400/40" : "text-emerald-300/60 border-emerald-400/20";
  const handleCopy = async () => {
    await navigator.clipboard.writeText(fmt(value));
  };
  return (
    <div
      className={`rounded border p-2 ${color} ${muted ? "opacity-40" : ""} ${copyable ? "cursor-copy" : ""}`}
      onClick={copyable ? () => void handleCopy() : undefined}
      title={copyable ? `Copy ${label}` : undefined}
      role={copyable ? "button" : undefined}
      tabIndex={copyable ? 0 : undefined}
      onKeyDown={copyable ? (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          void handleCopy();
        }
      } : undefined}
    >
      <p className="text-[10px] uppercase">{label}</p>
      <p>{fmt(value)}</p>
    </div>
  );
}

function Dist({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between"><span>{label}</span><span>{pct.toFixed(1)}%</span></div>
      <div className="h-2 rounded bg-emerald-950"><div className="h-2 rounded bg-emerald-400" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}
