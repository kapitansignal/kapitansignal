"use client";

import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, Mail, Phone, ShieldCheck, User, Zap } from "lucide-react";
import { useEffect, useState } from "react";

type PkgInfo = { package_name: string; duration_days: number; billplz_enabled?: boolean };
type ResultInfo = { access_key: string; expired_at: string };

export default function RegisterPage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState("");
  const [pkg, setPkg] = useState<PkgInfo | null>(null);
  const [status, setStatus] = useState("Loading package...");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [acceptedRisk, setAcceptedRisk] = useState(false);
  const [result, setResult] = useState<ResultInfo | null>(null);
  const [showKeyReminder, setShowKeyReminder] = useState(false);
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);

  const validateName = (value: string) => {
    const trimmed = value.trim().replace(/\s+/g, " ");
    if (trimmed.length < 3) return "Sila masukkan nama penuh (min 3 aksara).";
    const parts = trimmed.split(" ").filter(Boolean);
    if (parts.length < 2) return "Sila masukkan nama penuh (nama depan + nama belakang).";
    if (parts.some((p) => p.length < 2)) return "Setiap bahagian nama mesti sekurang-kurangnya 2 aksara.";
    if (!/^[A-Za-z\s'.-]+$/.test(trimmed)) return "Nama mengandungi aksara yang tidak sah.";
    return "";
  };

  const validateEmail = (value: string) => {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return "Email diperlukan.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "Sila masukkan alamat email yang sah.";
    return "";
  };

  const validatePhone = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "No telefon diperlukan.";
    if (!/^\+?[0-9]{9,15}$/.test(trimmed)) return "Sila masukkan nombor telefon sah (9-15 digit).";
    return "";
  };

  useEffect(() => {
    void (async () => {
      const p = await params;
      setToken(p.token);
      const res = await fetch(`/api/register/${p.token}`);
      const json = await res.json();
      if (!res.ok) {
        setStatus(json.error ?? "Invalid link");
        return;
      }
      setPkg({
        package_name: json.package_name,
        duration_days: json.duration_days,
        billplz_enabled: Boolean(json.billplz_enabled),
      });
      setStatus("");
    })();
  }, [params]);

  useEffect(() => {
    if (!token || !pkg?.billplz_enabled || result || isConfirmingPayment) return;
    const qs = new URLSearchParams(window.location.search);
    const paid = qs.get("billplz[paid]");
    const billId = qs.get("billplz[id]");
    if (paid !== "true" || !billId) return;

    setIsConfirmingPayment(true);
    setStatus("Verifying payment and activating your access key...");
    void (async () => {
      const res = await fetch(`/api/register/${token}/billplz/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bill_id: billId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setStatus(json.error ?? "Payment verification failed");
        setIsConfirmingPayment(false);
        return;
      }
      setResult({ access_key: json.access_key, expired_at: json.expired_at });
      setStatus("");
      setShowKeyReminder(true);
      setIsConfirmingPayment(false);
      const cleanUrl = `${window.location.pathname}`;
      window.history.replaceState({}, "", cleanUrl);
    })();
  }, [token, pkg, result, isConfirmingPayment]);

  const submit = async () => {
    const nameError = validateName(name);
    const emailError = validateEmail(email);
    const phoneError = validatePhone(phone);
    if (!acceptedRisk) {
      setStatus("Sila tandakan pengesahan risiko sebelum teruskan.");
      return;
    }
    if (nameError || emailError || phoneError) {
      setStatus(nameError || emailError || phoneError || "Sila lengkapkan semua ruangan.");
      return;
    }

    const endpoint = pkg?.billplz_enabled ? `/api/register/${token}/billplz` : `/api/register/${token}`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: name.trim().replace(/\s+/g, " "),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        promo_code: promoCode.trim(),
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setStatus(json.error ?? "Registration failed");
      return;
    }
    if (pkg?.billplz_enabled) {
      const billUrl = String(json.url ?? "");
      if (!billUrl) {
        setStatus("Payment session created but missing redirect URL.");
        return;
      }
      window.location.href = billUrl;
      return;
    }
    setResult({ access_key: json.access_key, expired_at: json.expired_at });
    setStatus("");
    setShowKeyReminder(true);
  };

  const copyKey = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.access_key);
    setStatus("Access key copied.");
  };

  const downloadKeyTxt = () => {
    if (!result) return;
    const lines = [
      "KAPITAN SIGNAL - ACCESS KEY",
      `Access Key: ${result.access_key}`,
      `Expires At: ${new Date(result.expired_at).toLocaleString("en-GB", { timeZone: "Asia/Kuala_Lumpur" })}`,
      `Package: ${pkg?.package_name ?? "-"}`,
      `Duration: ${pkg?.duration_days ?? "-"} days`,
    ];
    const blob = new Blob([`${lines.join("\n")}\n`], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kapitan-access-key-${result.access_key}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus("Access key file downloaded.");
  };

  const canSubmit = Boolean(name.trim() && email.trim() && phone.trim() && acceptedRisk);
  const hasError = Boolean(status) && !status.toLowerCase().includes("loading") && !status.toLowerCase().includes("copied") && !status.toLowerCase().includes("downloaded");

  return (
    <main className="relative flex min-h-screen flex-col justify-between overflow-x-hidden bg-[#05070D] text-[#F9FAFB]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#111827_1px,transparent_1px),linear-gradient(to_bottom,#111827_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-20" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-96 w-96 rounded-full bg-[#F5C542]/10 blur-[150px]" />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-8 pt-6 md:px-8 md:pt-8">
        <header className="mb-5 flex w-full items-center justify-between rounded-xl border border-[#1F2937] bg-[#111827]/80 px-4 py-3 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Image src="/kapitan-logo.png" alt="Kapitan Signal" width={30} height={30} className="rounded object-contain" />
            <div>
              <p className="font-heading text-lg font-black tracking-wider text-[#F5C542]">KAPITAN SIGNAL</p>
              <p className="font-subheading text-[10px] uppercase tracking-[0.16em] text-[#9CA3AF]">Every Signal Is A Mission.</p>
            </div>
          </div>
          <Link href="/" className="rounded-lg border border-[#F5C542]/40 bg-[#05070D] px-3 py-1.5 font-subheading text-xs font-semibold uppercase tracking-[0.12em] text-[#F5C542] hover:bg-[#F5C542]/10">
            Back Home
          </Link>
        </header>

        <div className="grid min-h-[620px] w-full grid-cols-1 gap-8 overflow-hidden rounded-2xl bg-[#05070D] lg:grid-cols-12 lg:gap-12">
          <section className="flex flex-col justify-center space-y-8 border-b border-[#1F2937]/60 p-4 md:p-8 lg:col-span-5 lg:border-b-0 lg:border-r">
            <div className="flex items-center gap-2">
              <Image src="/kapitan-logo.png" alt="Kapitan Signal" width={32} height={32} className="rounded object-contain" />
              <span className="font-heading text-xl font-black tracking-wider text-[#F5C542]">KAPITAN SIGNAL</span>
            </div>

            <div className="inline-flex w-fit items-center rounded-full border border-[#F5C542]/30 bg-[#111827] px-3 py-1 font-subheading text-[11px] uppercase tracking-[0.14em] text-[#F5C542]">
              Secured Registration
            </div>

            <div className="space-y-3">
              <h1 className="font-heading text-3xl font-black uppercase leading-none tracking-tight text-[#F9FAFB] md:text-4xl">
                Join The Gold
                <br />
                <span className="text-[#F5C542]">Command Center</span>
              </h1>
              <p className="text-sm leading-relaxed text-[#9CA3AF] md:text-base">
                Daftar akaun untuk akses ke dashboard signal XAUUSD premium, tactical risk calculator, dan performance log.
              </p>
            </div>

            <div className="space-y-3.5 text-base font-semibold tracking-wide text-[#F9FAFB] md:text-lg">
              {[
                "Scalping signal setiap 30 minit",
                "Intraday signal setiap 4 jam",
                "Entry, SL, TP1, TP2, TP3 yang jelas",
                "Gold Risk Engine untuk kiraan risiko",
                "Performance log transparent",
                "One access key, one device",
              ].map((line) => (
                <div key={line} className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded border border-[#1F2937] bg-[#111827] text-[#F5C542]">
                    <Zap className="h-4 w-4" />
                  </div>
                  <span>{line}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="flex flex-col justify-center p-4 md:p-8 lg:col-span-7">
            <div className="relative overflow-hidden rounded-xl border border-[#1F2937] bg-[#111827] p-6 shadow-[0_0_40px_rgba(5,7,13,0.8)] transition-all duration-500 hover:border-[#F5C542]/30 md:p-8">
              <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#F5C542] to-transparent" />

              <header className="mb-6">
                <h2 className="font-heading text-2xl font-black uppercase tracking-wide text-[#F9FAFB]">Create Your Account</h2>
                <p className="mt-1 font-subheading text-xs uppercase tracking-[0.14em] text-[#9CA3AF]">Secured Operator Registration</p>
              </header>

              {status ? (
                <p className={`mb-4 rounded border px-3 py-2 text-xs font-mono ${hasError ? "border-[#EF4444]/40 bg-[#EF4444]/12 text-[#EF4444]" : "border-[#1F2937] bg-[#05070D] text-[#9CA3AF]"}`}>
                  {status}
                </p>
              ) : null}

              {pkg && !result ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void submit();
                  }}
                  className="space-y-5"
                >
                  <div className="rounded border border-[#1F2937] bg-[#05070D] px-3 py-2 text-sm text-[#9CA3AF]">
                    Package: <span className="font-semibold text-[#F9FAFB]">{pkg.package_name}</span> ({pkg.duration_days} days)
                  </div>

                  <label className="block space-y-1.5">
                    <span className="text-xs uppercase tracking-[0.14em] text-[#9CA3AF]">Full Name</span>
                    <span className="flex items-center rounded border border-[#1F2937] bg-[#05070D] focus-within:border-[#F5C542]">
                      <User className="ml-3.5 h-4 w-4 shrink-0 text-[#9CA3AF]" />
                      <input
                        type="text"
                        autoComplete="name"
                        className="w-full bg-transparent px-3 py-3 text-sm text-[#F9FAFB] placeholder:text-gray-600 focus:outline-none"
                        placeholder="Masukkan nama penuh anda"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                      />
                    </span>
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-xs uppercase tracking-[0.14em] text-[#9CA3AF]">Email Address</span>
                    <span className="flex items-center rounded border border-[#1F2937] bg-[#05070D] focus-within:border-[#F5C542]">
                      <Mail className="ml-3.5 h-4 w-4 shrink-0 text-[#9CA3AF]" />
                      <input
                        type="email"
                        autoComplete="email"
                        className="w-full bg-transparent px-3 py-3 text-sm text-[#F9FAFB] placeholder:text-gray-600 focus:outline-none"
                        placeholder="alamat@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </span>
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-xs uppercase tracking-[0.14em] text-[#9CA3AF]">Phone Number</span>
                    <span className="flex items-center rounded border border-[#1F2937] bg-[#05070D] focus-within:border-[#F5C542]">
                      <Phone className="ml-3.5 h-4 w-4 shrink-0 text-[#9CA3AF]" />
                      <input
                        type="tel"
                        autoComplete="tel"
                        className="w-full bg-transparent px-3 py-3 text-sm text-[#F9FAFB] placeholder:text-gray-600 focus:outline-none"
                        placeholder="+60123456789"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        required
                      />
                    </span>
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-xs uppercase tracking-[0.14em] text-[#9CA3AF]">Promo Code (Optional)</span>
                    <input
                      type="text"
                      className="w-full rounded border border-[#1F2937] bg-[#05070D] px-3 py-3 text-sm uppercase tracking-wide text-[#F9FAFB] placeholder:text-gray-600 focus:border-[#F5C542] focus:outline-none"
                      placeholder="Masukkan promo code"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                    />
                  </label>

                  <label className="flex cursor-pointer items-start gap-3 pt-1">
                    <input
                      type="checkbox"
                      checked={acceptedRisk}
                      onChange={(e) => setAcceptedRisk(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-[#F5C542]"
                    />
                    <span className="text-xs leading-relaxed text-[#9CA3AF]">
                      Saya faham trading mempunyai risiko dan tiada jaminan keuntungan.
                    </span>
                  </label>

                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="w-full rounded-lg bg-gradient-to-r from-[#F5C542] to-[#FFD700] py-3.5 font-heading text-sm font-black uppercase tracking-[0.14em] text-[#05070D] shadow-[0_0_20px_rgba(245,197,66,0.2)] transition-all hover:shadow-[0_0_30px_rgba(245,197,66,0.4)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {pkg?.billplz_enabled ? "Proceed to Payment" : "Continue Registration"}
                  </button>
                </form>
              ) : null}

              {result ? (
                <div className="space-y-4 rounded border border-[#10B981]/35 bg-[#10B981]/10 p-4">
                  <div className="flex items-center gap-2 text-[#10B981]">
                    <CheckCircle2 className="h-5 w-5" />
                    <p className="text-sm font-semibold">Registration Submitted</p>
                  </div>
                  <p className="text-xs text-[#9CA3AF]">Access key anda telah dijana. Simpan key ini untuk login dashboard.</p>
                  <div className="rounded border border-[#1F2937] bg-[#05070D] p-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-[#9CA3AF]">Command Key</p>
                    <p className="mt-1 font-mono text-lg font-black tracking-widest text-[#F5C542]">{result.access_key}</p>
                    <p className="mt-2 text-xs text-[#9CA3AF]">
                      Expires: {new Date(result.expired_at).toLocaleString("en-GB", { timeZone: "Asia/Kuala_Lumpur" })}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => void copyKey()} className="rounded-lg bg-[#10B981] px-3 py-2 font-subheading text-xs font-bold uppercase tracking-[0.1em] text-[#05070D]">Copy Key</button>
                    <button onClick={downloadKeyTxt} className="rounded-lg border border-[#1F2937] bg-[#05070D] px-3 py-2 font-subheading text-xs font-bold uppercase tracking-[0.1em] text-[#F9FAFB]">Download .txt</button>
                    <Link href="/access" className="rounded-lg border border-[#F5C542]/50 bg-[#F5C542]/10 px-3 py-2 font-subheading text-xs font-bold uppercase tracking-[0.1em] text-[#F5C542]">Go to Login</Link>
                  </div>
                </div>
              ) : null}

              <div className="mt-6 border-t border-[#1F2937]/50 pt-4 text-[11px] text-[#9CA3AF]">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#10B981]" />
                  <span>
                    Your information is protected. Access key hanya aktif untuk satu device sahaja demi integriti data terminal.
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <footer className="relative z-10 border-t border-[#1F2937]/40 p-4 text-center font-mono text-[10px] text-gray-600">
        &copy; 2026 KAPITAN SIGNAL. Tactical Registration Module. All Security Protocols Active.
      </footer>

      {showKeyReminder && result ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4">
          <div className="w-full max-w-sm rounded-xl border border-[#F5C542]/40 bg-[#111827] p-6 text-center shadow-[0_0_50px_rgba(245,197,66,0.15)]">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#10B981]/30 bg-[#10B981]/10 text-[#10B981]">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-xl font-black uppercase tracking-wide">Important Reminder</h3>
            <p className="mt-1 text-xs text-[#9CA3AF]">Please copy and save your Access Key now. Anda perlukan key ini untuk login.</p>
            <div className="mt-4 rounded border border-[#1F2937] bg-[#05070D] p-3 font-mono text-sm font-bold tracking-widest text-[#F5C542]">
              {result.access_key}
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button onClick={() => void copyKey()} className="rounded-lg bg-[#10B981] px-3 py-2 font-subheading text-xs font-bold uppercase tracking-[0.1em] text-[#05070D]">Copy Key</button>
              <button onClick={downloadKeyTxt} className="rounded-lg border border-[#1F2937] bg-[#05070D] px-3 py-2 font-subheading text-xs font-bold uppercase tracking-[0.1em] text-[#F9FAFB]">Download .txt</button>
              <button onClick={() => setShowKeyReminder(false)} className="rounded-lg border border-[#F5C542]/50 bg-[#F5C542]/10 px-3 py-2 font-subheading text-xs font-bold uppercase tracking-[0.1em] text-[#F5C542]">Done</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
