"use client";

import Image from "next/image";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Cpu,
  KeyRound,
  Layers,
  Monitor,
  Shield,
  SlidersHorizontal,
  Target,
  Zap,
} from "lucide-react";

type PerformanceRow = {
  date: string;
  type: string;
  pair: string;
  entry: string;
  result: string;
  rr: string;
};

const PERFORMANCE_ROWS: PerformanceRow[] = [
  { date: "Today", type: "Scalping", pair: "XAUUSD BUY", entry: "4348.50", result: "TP2 Hit", rr: "+2.1R" },
  { date: "Today", type: "Intraday", pair: "XAUUSD SELL", entry: "4362.00", result: "Active", rr: "-" },
  { date: "Yesterday", type: "Scalping", pair: "XAUUSD BUY", entry: "4335.20", result: "SL", rr: "-1R" },
  { date: "Yesterday", type: "Intraday", pair: "XAUUSD SELL", entry: "4350.00", result: "TP3 Hit", rr: "+3R" },
];

function SectionTitle({ overline, title }: { overline: string; title: string }) {
  return (
    <div className="space-y-3 text-center mb-16">
      <p className="font-heading text-xs font-bold tracking-widest uppercase text-[#F5C542]">{overline}</p>
      <h2 className="font-heading font-black tracking-tight text-3xl lg:text-5xl">{title}</h2>
      <div className="mx-auto mt-4 h-1 w-16 bg-[#F5C542]" />
    </div>
  );
}

export default function KapitanLandingPage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#05070D] text-[#F9FAFB] antialiased selection:bg-[#F5C542] selection:text-[#05070D]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#111827_1px,transparent_1px),linear-gradient(to_bottom,#111827_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-25" />

      <nav className="sticky top-0 z-50 border-b border-[#F5C542]/20 bg-[#05070D]/80 px-4 py-4 backdrop-blur-md lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-gradient-to-br from-[#F5C542] to-[#FFD700] text-[#05070D] shadow-[0_0_15px_rgba(245,197,66,0.4)]">
              <Zap className="h-4 w-4 fill-[#05070D]" />
            </div>
            <span className="font-heading text-xl font-black tracking-wider text-gradient">KAPITAN SIGNAL</span>
          </div>

          <div className="hidden items-center space-x-8 font-subheading text-lg font-medium tracking-wide md:flex">
            <a href="#home" className="text-[#F9FAFB] hover:text-[#F5C542] transition-colors">Home</a>
            <a href="#features" className="text-[#9CA3AF] hover:text-[#F5C542] transition-colors">Features</a>
            <a href="#performance" className="text-[#9CA3AF] hover:text-[#F5C542] transition-colors">Performance</a>
            <a href="#packages" className="text-[#9CA3AF] hover:text-[#F5C542] transition-colors">Packages</a>
            <a href="#faq" className="text-[#9CA3AF] hover:text-[#F5C542] transition-colors">FAQ</a>
          </div>

          <a
            href="#packages"
            className="rounded border border-[#FFD700] bg-gradient-to-r from-[#F5C542] to-[#FFD700] px-5 py-2.5 font-heading text-xs font-bold tracking-wider text-[#05070D] transition-all duration-300 hover:shadow-[0_0_20px_rgba(245,197,66,0.6)]"
          >
            GET ACCESS
          </a>
        </div>
      </nav>

      <section id="home" className="relative mx-auto flex max-w-7xl flex-col items-center px-4 pb-16 pt-8 text-center sm:pt-10 lg:px-8 lg:pb-24 lg:pt-12">
        <div className="pointer-events-none absolute left-1/2 top-1/3 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#F5C542]/8 blur-[120px]" />

        <div className="relative z-10 mb-2 h-44 w-44 sm:h-56 sm:w-56 lg:h-64 lg:w-64">
          <Image
            src="/kapitan-logo.png"
            alt="Kapitan Signal official logo"
            fill
            priority
            sizes="(max-width: 640px) 176px, (max-width: 1024px) 224px, 256px"
            className="object-contain drop-shadow-[0_0_36px_rgba(245,197,66,0.36)]"
          />
        </div>

        <div className="z-10 mx-auto flex max-w-4xl flex-col items-center space-y-6">
          <div className="inline-flex items-center space-x-2 rounded-full border border-[#F5C542]/30 bg-[#111827] px-3 py-1 text-xs font-heading uppercase tracking-widest text-[#F5C542]">
            <span className="h-2 w-2 rounded-full bg-[#10B981] animate-pulse" />
            <span>Tactical Command Center Active</span>
          </div>

          <h1 className="font-heading text-4xl font-black leading-none tracking-tight sm:text-6xl lg:text-7xl">
            KAPITAN SIGNAL
          </h1>
          <h2 className="font-subheading text-2xl font-bold uppercase tracking-wider text-[#F5C542] lg:text-3xl">
            “COMMAND THE GOLD MARKET”
          </h2>
          <p className="max-w-3xl text-base leading-relaxed text-[#9CA3AF] lg:text-lg">
            Elite XAUUSD signal platform untuk trader yang mahukan entry pantas, risk terkawal dan performance yang transparent.
            Platform signal XAUUSD premium dengan signal scalping setiap 30 minit, intraday setiap 4 jam, risk calculator automatik
            dan performance log yang transparent.
          </p>

          <div className="flex flex-wrap justify-center gap-4 pt-4">
            <a
              href="#packages"
              className="rounded bg-gradient-to-r from-[#F5C542] to-[#FFD700] px-8 py-4 font-heading text-sm font-bold tracking-wider text-[#05070D] shadow-[0_0_25px_rgba(245,197,66,0.3)] transition-all hover:-translate-y-0.5 hover:shadow-[0_0_35px_rgba(245,197,66,0.5)]"
            >
              JOIN VIP NOW
            </a>
            <a
              href="#performance"
              className="rounded border border-[#9CA3AF]/30 bg-[#111827] px-8 py-4 font-heading text-sm font-bold tracking-wider text-[#F9FAFB] transition-all hover:-translate-y-0.5 hover:border-[#F5C542]"
            >
              VIEW PERFORMANCE
            </a>
          </div>
        </div>

      </section>

      <section className="border-y border-gray-800 bg-[#0B0F1A] px-4 py-12 lg:px-8">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
          {[
            { icon: Zap, title: "SCALPING SIGNAL", desc: "Every 30 Minutes" },
            { icon: BarChart3, title: "INTRADAY SIGNAL", desc: "Every 4 Hours" },
            { icon: Shield, title: "RISK ENGINE", desc: "Auto Lot Calculation" },
            { icon: KeyRound, title: "ACCESS CONTROL", desc: "One Key, One Device" },
          ].map((item) => (
            <div key={item.title} className="gold-glow-hover flex items-center space-x-4 rounded-lg border border-gray-800 bg-[#111827] p-4 transition-all duration-300 sm:p-5">
              <div className="rounded border border-gray-700 bg-[#05070D] p-3 text-[#F5C542]">
                <item.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="font-mono text-xs uppercase tracking-wider text-[#9CA3AF]">{item.title}</p>
                <h4 className="mt-0.5 font-subheading text-lg font-bold text-[#F9FAFB]">{item.desc}</h4>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-4 py-24 lg:px-8">
        <SectionTitle overline="TACTICAL ADVANTAGES" title="Built For Serious Gold Traders" />
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: Target,
              title: "Precision XAUUSD Signals",
              text: "Dapatkan setup Entry, SL, TP1, TP2 dan TP3 yang jelas untuk scalping dan intraday.",
            },
            {
              icon: Cpu,
              title: "Gold Risk Engine",
              text: "Masukkan amount risiko sahaja dan sistem bantu kira lot size yang sesuai secara dinamik.",
            },
            {
              icon: BarChart3,
              title: "Transparent Performance Log",
              text: "Setiap signal direkod dengan status TP hit, SL hit dan result untuk semakan ahli harian.",
            },
            {
              icon: KeyRound,
              title: "Device Protected Access",
              text: "Satu access key hanya boleh aktif pada satu device sahaja pada satu-satu masa.",
            },
            {
              icon: Layers,
              title: "Live Signal Dashboard",
              text: "Semua signal dipaparkan dalam dashboard eksklusif, bukan sekadar group chat biasa.",
            },
            {
              icon: SlidersHorizontal,
              title: "Market Discipline",
              text: "Fokus kepada entry berkualiti, risk control menyeluruh dan execution yang tersusun.",
            },
          ].map((feature) => (
            <div key={feature.title} className="gold-glow-hover rounded-xl border border-gray-800 bg-[#111827] p-6 transition-all duration-300">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded border border-gray-700 bg-[#05070D] text-[#F5C542]">
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="mb-2 font-subheading text-xl font-bold uppercase tracking-wide text-[#F9FAFB]">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-[#9CA3AF]">{feature.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-gray-800 bg-[#0B0F1A] px-4 py-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionTitle overline="DEPLOYMENT PROCESS" title="Cara Untuk Dapat Access" />
          <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
            {[
              ["01", "Pilih Pakej", "Pilih plan yang sesuai dengan style trading anda."],
              ["02", "Register Account", "Daftar menggunakan nama, email dan maklumat yang diperlukan."],
              ["03", "Receive Access Key", "Selepas pendaftaran berjaya, anda akan menerima Command Key eksklusif."],
              ["04", "Login Dashboard", "Gunakan access key untuk masuk ke dashboard Kapitan Signal."],
            ].map(([num, title, desc]) => (
              <div key={num} className="relative space-y-2 rounded-lg border border-gray-800 bg-[#111827] p-6">
                <div className="absolute right-4 top-4 font-heading text-4xl font-black text-gray-800/70">{num}</div>
                <h3 className="mt-4 font-subheading text-xl font-bold uppercase tracking-wide text-[#F5C542]">{title}</h3>
                <p className="text-sm leading-relaxed text-[#9CA3AF]">{desc}</p>
              </div>
            ))}
          </div>
          <div className="pt-12 text-center">
            <a href="#packages" className="font-heading text-3xl font-bold tracking-widest uppercase text-[#F5C542] hover:text-[#FFD700]">
              START YOUR MISSION <span aria-hidden>→</span>
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-24 lg:px-8">
        <SectionTitle overline="TERMINAL STREAM" title="Live Signal Experience" />
        <p className="-mt-10 mb-14 text-center font-mono text-sm text-[#9CA3AF]">
          *Nombor di bawah hanya contoh UI mockup, bukan real-time performance log.
        </p>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="rounded-xl border border-gray-800 bg-[#111827] p-5 lg:col-span-4">
            <div className="mb-4 flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="font-subheading text-2xl font-bold uppercase text-[#9CA3AF]">Scalping Signal</h3>
              <span className="rounded bg-[#10B981]/20 px-2.5 py-1 font-subheading text-sm font-bold uppercase text-[#10B981]">TP1 Hit</span>
            </div>
            <div className="mb-4 flex items-end justify-between">
              <p className="font-heading text-3xl font-black text-[#10B981]">BUY XAUUSD</p>
              <p className="font-mono text-lg text-[#9CA3AF]">ENTRY: 4348.50</p>
            </div>
            <div className="space-y-2 rounded border border-gray-800 bg-[#05070D] p-3 font-mono text-lg">
              <div className="flex justify-between"><span>SL:</span><span className="font-bold text-[#EF4444]">4345.00</span></div>
              <div className="flex justify-between"><span>TP1:</span><span className="font-bold text-[#10B981]">4352.00</span></div>
              <div className="flex justify-between"><span>TP2:</span><span className="font-bold text-[#F9FAFB]">4355.00</span></div>
              <div className="flex justify-between"><span>TP3:</span><span className="font-bold text-[#F9FAFB]">4360.00</span></div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-800 bg-[#111827] p-5 lg:col-span-4">
            <div className="mb-4 flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="font-subheading text-2xl font-bold uppercase text-[#9CA3AF]">Intraday Signal</h3>
              <span className="rounded bg-[#F5C542]/20 px-2.5 py-1 font-subheading text-sm font-bold uppercase text-[#F5C542]">Active</span>
            </div>
            <div className="mb-4 flex items-end justify-between">
              <p className="font-heading text-3xl font-black text-[#EF4444]">SELL XAUUSD</p>
              <p className="font-mono text-lg text-[#9CA3AF]">ENTRY: 4362.00</p>
            </div>
            <div className="space-y-2 rounded border border-gray-800 bg-[#05070D] p-3 font-mono text-lg">
              <div className="flex justify-between"><span>SL:</span><span className="font-bold text-[#EF4444]">4368.00</span></div>
              <div className="flex justify-between"><span>TP1:</span><span className="font-bold text-[#F9FAFB]">4356.00</span></div>
              <div className="flex justify-between"><span>TP2:</span><span className="font-bold text-[#F9FAFB]">4350.00</span></div>
              <div className="flex justify-between"><span>TP3:</span><span className="font-bold text-[#F9FAFB]">4342.00</span></div>
            </div>
          </div>

          <div className="rounded-xl border-2 border-dashed border-[#F5C542]/50 bg-[#111827] p-5 lg:col-span-4">
            <div className="mb-4 flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="font-subheading text-2xl font-bold uppercase text-[#F5C542]">Risk Calculator</h3>
              <SlidersHorizontal className="h-5 w-5 text-[#F5C542]" />
            </div>
            <div className="space-y-3 font-mono text-lg">
              <div className="flex items-center justify-between rounded border border-gray-800 bg-[#05070D] p-3"><span>Risk Amount:</span><span className="font-bold text-[#F9FAFB]">50</span></div>
              <div className="flex items-center justify-between rounded border border-gray-800 bg-[#05070D] p-3"><span>Suggested Lot:</span><span className="font-bold text-[#10B981]">0.03</span></div>
              <div className="flex items-center justify-between rounded border border-gray-800 bg-[#05070D] p-3"><span className="text-[#EF4444]">Max Loss:</span><span className="font-bold text-[#EF4444]">50</span></div>
              <div className="flex items-center justify-between rounded border border-gray-800 bg-[#05070D] p-3"><span className="text-[#10B981]">Potential TP3:</span><span className="font-bold text-[#10B981]">150+</span></div>
            </div>
          </div>
        </div>
      </section>

      <section id="performance" className="border-y border-gray-800 bg-[#0B0F1A] px-4 py-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionTitle overline="AUDITED JOURNAL" title="Performance Log Yang Transparent" />
          <p className="-mt-10 mb-14 text-center text-lg text-[#9CA3AF]">Setiap signal direkod supaya ahli boleh review result dengan jelas.</p>

          <div className="overflow-x-auto rounded-xl border border-gray-800 bg-[#111827]">
            <table className="w-full min-w-[960px] text-left text-lg">
              <thead>
                <tr className="border-b border-gray-800 bg-[#05070D]">
                  <th className="p-4 font-subheading font-bold uppercase tracking-widest text-[#9CA3AF]">Date</th>
                  <th className="p-4 font-subheading font-bold uppercase tracking-widest text-[#9CA3AF]">Type</th>
                  <th className="p-4 font-subheading font-bold uppercase tracking-widest text-[#9CA3AF]">Pair</th>
                  <th className="p-4 font-subheading font-bold uppercase tracking-widest text-[#9CA3AF]">Entry</th>
                  <th className="p-4 font-subheading font-bold uppercase tracking-widest text-[#9CA3AF]">Result</th>
                  <th className="p-4 font-subheading font-bold uppercase tracking-widest text-[#9CA3AF]">RR</th>
                </tr>
              </thead>
              <tbody>
                {PERFORMANCE_ROWS.map((row) => (
                  <tr key={`${row.date}-${row.type}-${row.entry}`} className="border-b border-gray-800/60">
                    <td className="p-4 text-[#F9FAFB]">{row.date}</td>
                    <td className="p-4">
                      <span className={`rounded px-2 py-0.5 font-subheading text-xs font-bold uppercase tracking-widest ${
                        row.type === "Scalping" ? "border border-[#F5C542]/40 bg-[#F5C542]/10 text-[#F5C542]" : "border border-[#3B82F6]/40 bg-[#3B82F6]/10 text-[#60A5FA]"
                      }`}>
                        {row.type.toUpperCase()}
                      </span>
                    </td>
                    <td className={`p-4 font-subheading font-bold uppercase ${row.pair.includes("BUY") ? "text-[#10B981]" : "text-[#EF4444]"}`}>{row.pair}</td>
                    <td className="p-4 font-mono text-[#F9FAFB]">{row.entry}</td>
                    <td className={`p-4 font-subheading font-bold ${row.result.includes("TP") ? "text-[#10B981]" : row.result === "SL" ? "text-[#EF4444]" : "text-[#9CA3AF]"}`}>{row.result}</td>
                    <td className={`p-4 font-subheading font-bold ${row.rr.startsWith("+") ? "text-[#10B981]" : row.rr.startsWith("-") ? "text-[#EF4444]" : "text-[#9CA3AF]"}`}>{row.rr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mx-auto mt-12 max-w-4xl rounded-lg border-l-4 border-[#F5C542] bg-[#111827] p-4 text-base text-[#9CA3AF]">
            <p className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-[#F5C542]" />
              Performance log adalah untuk tujuan transparency. Trading tetap mempunyai risiko pasaran yang nyata.
            </p>
          </div>
        </div>
      </section>

      <section id="packages" className="mx-auto max-w-7xl px-4 py-24 lg:px-8">
        <SectionTitle overline="PRICING TIERS" title="Choose Your Command Plan" />
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div className="gold-glow-hover space-y-6 rounded-xl border border-gray-800 bg-[#111827] p-6 transition-all duration-300">
            <div>
              <h3 className="font-heading text-xl font-bold text-gray-300">7 Hari</h3>
              <p className="mt-1 text-xs text-[#9CA3AF]">Akses misi ringkas untuk mula trade.</p>
            </div>
            <div>
              <p className="font-mono text-sm text-[#9CA3AF] line-through">RM149</p>
              <div className="font-heading text-3xl font-black text-[#F5C542]">RM49</div>
              <p className="mt-1 font-heading text-[10px] font-bold uppercase tracking-[0.25em] text-[#10B981]">Promo Active</p>
            </div>
            <div className="h-[1px] w-full bg-gray-800" />
            <ul className="space-y-3 text-sm text-[#9CA3AF]">
              {["Access dashboard", "Scalping signal", "Intraday signal", "Risk calculator", "Performance log", "One device access"].map((item) => (
                <li key={item} className="flex items-center space-x-2.5"><CheckCircle2 className="h-4 w-4 text-[#F5C542]" /><span>{item}</span></li>
              ))}
            </ul>
            <button className="w-full rounded border border-gray-700 bg-[#05070D] py-3 font-heading text-xs font-bold uppercase tracking-wider text-[#F9FAFB] transition-all hover:border-[#F5C542] hover:text-[#F5C542]">
              Get 7 Days
            </button>
          </div>

          <div className="relative space-y-6 rounded-xl border-2 border-[#F5C542] bg-[#111827] p-6 shadow-[0_0_30px_rgba(245,197,66,0.15)] md:-translate-y-4">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#F5C542] to-[#FFD700] px-3 py-1 font-heading text-[10px] font-black uppercase tracking-widest text-[#05070D] shadow-md">
              POPULAR
            </div>
            <div>
              <h3 className="font-heading text-xl font-bold text-[#F5C542]">15 Hari</h3>
              <p className="mt-1 text-xs text-[#9CA3AF]">Tempoh seimbang untuk misi konsisten.</p>
            </div>
            <div>
              <p className="font-mono text-sm text-[#9CA3AF] line-through">RM249</p>
              <div className="font-heading text-3xl font-black text-[#F5C542]">RM129</div>
              <p className="mt-1 font-heading text-[10px] font-bold uppercase tracking-[0.25em] text-[#10B981]">Promo Active</p>
            </div>
            <div className="h-[1px] w-full bg-gray-800" />
            <ul className="space-y-3 text-sm text-[#F9FAFB]">
              {["Access dashboard", "Scalping signal", "Intraday signal", "Risk calculator", "Full performance log", "One device access"].map((item) => (
                <li key={item} className="flex items-center space-x-2.5"><CheckCircle2 className="h-4 w-4 text-[#F5C542]" /><span>{item}</span></li>
              ))}
            </ul>
            <button className="w-full rounded bg-gradient-to-r from-[#F5C542] to-[#FFD700] py-3.5 font-heading text-xs font-bold uppercase tracking-wider text-[#05070D] shadow-[0_0_20px_rgba(245,197,66,0.3)] transition-all hover:shadow-[0_0_30px_rgba(245,197,66,0.5)]">
              Get 15 Days
            </button>
          </div>

          <div className="gold-glow-hover space-y-6 rounded-xl border border-gray-800 bg-[#111827] p-6 transition-all duration-300">
            <div>
              <h3 className="font-heading text-xl font-bold text-gray-300">30 Hari</h3>
              <p className="mt-1 text-xs text-[#9CA3AF]">Tempoh penuh untuk trading cycle bulanan.</p>
            </div>
            <div>
              <p className="font-mono text-sm text-[#9CA3AF] line-through">RM399</p>
              <div className="font-heading text-3xl font-black text-[#F5C542]">RM199</div>
              <p className="mt-1 font-heading text-[10px] font-bold uppercase tracking-[0.25em] text-[#10B981]">Promo Active</p>
            </div>
            <div className="h-[1px] w-full bg-gray-800" />
            <ul className="space-y-3 text-sm text-[#9CA3AF]">
              {["Access dashboard", "Scalping signal", "Intraday signal", "Risk calculator", "Full performance log", "One device access"].map((item) => (
                <li key={item} className="flex items-center space-x-2.5"><CheckCircle2 className="h-4 w-4 text-[#F5C542]" /><span>{item}</span></li>
              ))}
            </ul>
            <button className="w-full rounded border border-gray-700 bg-[#05070D] py-3 font-heading text-xs font-bold uppercase tracking-wider text-[#F9FAFB] transition-all hover:border-[#F5C542] hover:text-[#F5C542]">
              Get 30 Days
            </button>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden border-y border-gray-800 bg-[#0B0F1A] px-4 py-24 lg:px-8">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#F5C542]/5 blur-[150px]" />
        <div className="relative z-10 mx-auto max-w-4xl space-y-8 text-center">
          <div className="space-y-3">
            <p className="font-heading text-xs font-bold uppercase tracking-widest text-[#F5C542]">SECURITY PROTOCOL</p>
            <h2 className="font-heading text-3xl font-black tracking-tight lg:text-4xl">One Key. One Trader. One Mission.</h2>
            <p className="mx-auto max-w-xl text-sm text-[#9CA3AF] lg:text-base">
              Sistem Command Key Kapitan Signal direka untuk melindungi akses ahli. Setiap key hanya boleh aktif pada satu device sahaja pada satu masa.
            </p>
          </div>

          <div className="mx-auto max-w-md rounded-xl border-2 border-gray-800 bg-[#111827] p-6 text-left font-mono shadow-2xl">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                <span className="font-heading text-xs font-bold tracking-widest text-[#F9FAFB]">COMMAND KEY</span>
                <div className="flex space-x-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                  <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                </div>
              </div>

              <div className="flex items-center justify-between rounded border border-gray-800 bg-[#05070D] px-4 py-3">
                <span className="text-base font-bold tracking-widest text-[#F5C542]">KPS-ELITE-X92A</span>
                <Monitor className="h-4 w-4 text-[#9CA3AF]" />
              </div>

              <div className="flex items-center justify-between pt-1 text-[11px] text-gray-400">
                <div className="flex items-center space-x-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                  <span>Status: <span className="font-bold text-[#10B981]">Active</span></span>
                </div>
                <div>Device: <span className="font-bold text-[#F9FAFB]">Secured</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-4xl px-4 py-24 lg:px-8">
        <SectionTitle overline="INTEL DATABASE" title="Frequently Asked Questions" />
        <div className="space-y-4">
          {[
            {
              q: "Apa itu Kapitan Signal?",
              a: "Kapitan Signal ialah platform premium yang menyediakan isyarat pasaran (signal) komoditi XAUUSD berpandukan ketepatan masa scalping dan pelan kedudukan intraday.",
            },
            {
              q: "Adakah signal ini sesuai untuk beginner?",
              a: "Ya, kerana platform ini dilengkapi peranti kalkulator lot bersepadu untuk mengekalkan amalan pengurusan risiko komprehensif bagi pelan dagangan harian anda.",
            },
            {
              q: "Bagaimana access key berfungsi?",
              a: "Setiap pelanggan menerima token unik (Command Key) setelah pengesahan pakej berjaya untuk memasuki portal pemantauan dashboard eksklusif.",
            },
            {
              q: "Boleh login lebih dari satu device?",
              a: "Tidak boleh. Bagi memelihara hak eksklusif komuniti, satu kekunci sistem hanya dibenarkan aktif untuk satu jenis perkakasan sahaja pada sesuatu masa.",
            },
            {
              q: "Adakah profit dijamin?",
              a: "Tidak. Trading mempunyai risiko. Kapitan Signal menyediakan setup, analysis dan tools untuk bantu execution, tetapi keputusan trade tetap bergantung kepada risk management masing-masing.",
              danger: true,
            },
            {
              q: "Apa beza scalping dan intraday signal?",
              a: "Isyarat scalping dihantar sekurang-kurangnya setiap 30 minit untuk unjuran pergerakan jangka mikro, manakala analisa intraday disegarkan setiap 4 jam.",
            },
            {
              q: "Apa itu risk calculator?",
              a: "Sistem pemproses matematik dalaman yang membantu menterjemah jumlah risiko dolar anda menjadi nilai saiz lot fizikal secara automatik.",
            },
            {
              q: "Bagaimana saya dapat link pendaftaran?",
              a: "Sila pilih pelan di bahagian pricing tier utama, sistem gerbang pembayaran automatik kami akan melunaskan pautan pendaftaran sejurus selepas urusan selesai.",
            },
          ].map((item) => (
            <details key={item.q} className={`group overflow-hidden rounded-lg border bg-[#111827] ${item.danger ? "border-2 border-dashed border-[#EF4444]/40" : "border-gray-800"}`}>
              <summary className="list-none cursor-pointer select-none p-5 font-subheading text-lg font-bold uppercase tracking-wide text-[#F9FAFB] transition-colors hover:text-[#F5C542] flex items-center justify-between">
                <span>{item.q}</span>
                <ChevronDown className={`h-5 w-5 text-gray-500 transition-transform group-open:rotate-180 ${item.danger ? "group-open:text-[#EF4444]" : "group-open:text-[#F5C542]"}`} />
              </summary>
              <div className="border-t border-gray-800/40 bg-[#05070D]/40 p-5 pt-0 text-sm leading-relaxed text-[#9CA3AF]">
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto mb-24 max-w-5xl px-4 py-16 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl border-2 border-[#F5C542]/50 bg-gradient-to-br from-[#111827] via-[#111827] to-[#F5C542]/10 p-8 text-center shadow-[0_0_50px_rgba(245,197,66,0.1)] lg:p-12">
          <h2 className="font-heading text-3xl font-black uppercase tracking-tight lg:text-5xl">Ready To Trade Like A Captain?</h2>
          <p className="mx-auto max-w-xl text-sm leading-relaxed text-[#9CA3AF] lg:text-base mt-6">
            Masuk ke command center Kapitan Signal dan dapatkan pengalaman signal XAUUSD yang lebih tersusun, pantas dan transparent.
          </p>
          <div className="pt-4">
            <a
              href="#packages"
              className="inline-block rounded bg-gradient-to-r from-[#F5C542] to-[#FFD700] px-10 py-4 font-heading text-sm font-bold uppercase tracking-widest text-[#05070D] shadow-[0_0_30px_rgba(245,197,66,0.4)] transition-all hover:-translate-y-0.5 hover:shadow-[0_0_40px_rgba(245,197,66,0.6)]"
            >
              Get Access Now
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-800 bg-[#05070D] px-4 pb-8 pt-16 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-12">
          <div className="flex flex-col items-start justify-between gap-6 border-b border-gray-800/60 pb-8 md:flex-row md:items-center">
            <div>
              <span className="font-heading text-lg font-black tracking-widest text-gradient">KAPITAN SIGNAL</span>
              <p className="mt-1 font-subheading text-xs font-bold uppercase tracking-widest text-[#9CA3AF]">“COMMAND THE GOLD MARKET”</p>
            </div>
            <div className="flex flex-wrap gap-6 font-subheading text-sm font-semibold tracking-wider text-gray-400">
              <a href="#home" className="hover:text-[#F5C542] transition-colors">Terms</a>
              <a href="#home" className="hover:text-[#F5C542] transition-colors">Privacy</a>
              <a href="#home" className="hover:text-[#F5C542] transition-colors">Risk Disclaimer</a>
              <a href="#home" className="hover:text-[#F5C542] transition-colors">Contact</a>
            </div>
          </div>
          <div className="max-w-5xl space-y-3 text-[10px] leading-relaxed text-gray-500 lg:text-xs">
            <p><strong>Risk Warning:</strong> Trading CFD melibatkan risiko tinggi. Signal yang diberikan bukan jaminan keuntungan. Pastikan anda memahami risiko sebelum trade.</p>
            <p className="pt-4 text-center font-mono text-[10px] text-gray-600">&copy; 2026 KAPITAN SIGNAL. All Terminal Rights Reserved.</p>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        .text-gradient {
          background: linear-gradient(to right, #f9fafb, #f5c542, #f9fafb);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .gold-glow-hover:hover {
          box-shadow: 0 0 35px rgba(245, 197, 66, 0.45);
          border-color: #f5c542;
        }
        details summary::-webkit-details-marker {
          display: none;
        }
      `}</style>
    </main>
  );
}
