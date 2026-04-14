"use client"

import { register } from "@/app/actions/auth"
import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import {
  Sparkles, ArrowRight, Mail, Lock, User,
  PenSquare, Radio, Calendar, Activity,
} from "lucide-react"
import { useActionState } from "react"

/* ─── Floating feature card ──────────────────────────────────── */
function FloatCard({
  delay, children, className,
}: { delay: number; children: React.ReactNode; className?: string }) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={reduced
        ? { opacity: 1, y: 0 }
        : { opacity: 1, y: [0, -5, 0] }}
      transition={reduced
        ? { duration: 0.5, delay }
        : { opacity: { duration: 0.5, delay }, y: { duration: 4.5, delay: delay + 0.5, repeat: Infinity, ease: "easeInOut" } }}
      className={`rounded-2xl p-4 bg-[var(--nm-bg)] ${className ?? ""}`}
      style={{ boxShadow: "var(--nm-raised)" }}
    >
      {children}
    </motion.div>
  )
}

const features = [
  {
    icon: PenSquare,
    color: "#2E5E99",
    bg: "rgba(46,94,153,0.15)",
    title: "Multi-platform publishing",
    desc: "LinkedIn, X, Facebook — one compose window.",
  },
  {
    icon: Calendar,
    color: "#363630",
    bg: "rgba(54,54,48,0.15)",
    title: "Smart scheduling",
    desc: "Queue posts for the best engagement windows.",
  },
  {
    icon: Radio,
    color: "#675B47",
    bg: "rgba(103,91,71,0.15)",
    title: "Sentiment listening",
    desc: "AI-powered analysis of your content reception.",
  },
  {
    icon: Activity,
    color: "#7BA4D0",
    bg: "rgba(123,164,208,0.15)",
    title: "Real-time analytics",
    desc: "Track growth across every platform in one view.",
  },
]

/* ─── Right panel illustration ───────────────────────────────── */
function FeatureShowcase() {
  return (
    <div className="relative w-full h-full flex items-center justify-center p-12 overflow-hidden">
      {/* Glow orbs */}
      <div className="absolute top-1/3 right-1/4 w-72 h-72 rounded-full bg-[#2E5E99]/12 blur-[90px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-52 h-52 rounded-full bg-indigo-500/8 blur-[70px] pointer-events-none" />

      <div className="relative w-full max-w-sm space-y-4">

        {/* Header card */}
        <FloatCard delay={0.05} className="text-center pb-5">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="w-12 h-12 rounded-2xl bg-[#2E5E99] flex items-center justify-center mx-auto mb-3"
            style={{ boxShadow: "var(--nm-raised-sm)" }}
          >
            <Sparkles className="w-6 h-6 text-white" />
          </motion.div>
          <p className="font-display text-base font-bold text-foreground mb-1">
            Unified social management
          </p>
          <p className="text-xs text-muted-foreground">
            For ambitious creators and growing brands.
          </p>
        </FloatCard>

        {/* Feature cards grid */}
        <div className="grid grid-cols-2 gap-4">
          {features.map((f, i) => (
            <FloatCard key={i} delay={0.15 + i * 0.1} className="flex flex-col gap-3">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: f.bg, boxShadow: "var(--nm-inset-sm)" }}
              >
                <f.icon className="w-4 h-4" style={{ color: f.color }} />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground leading-tight">{f.title}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{f.desc}</p>
              </div>
            </FloatCard>
          ))}
        </div>

        {/* Social proof */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.9 }}
          className="text-center"
        >
          <p className="text-xs text-muted-foreground">
            Trusted by <span className="font-semibold text-[#2E5E99]">2,400+</span> creators worldwide
          </p>
        </motion.div>
      </div>
    </div>
  )
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function RegisterPage() {
  const [state, formAction] = useActionState(register, null)

  return (
    <div className="flex min-h-screen bg-background overflow-hidden flex-row-reverse">

      {/* ── Right: form panel ── */}
      <div className="flex-1 lg:flex-none lg:w-[480px] flex flex-col justify-center px-8 sm:px-12 lg:px-16 py-12 relative z-10">

        {/* Ambient glow */}
        <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-[#2E5E99]/8 blur-[100px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-sm mx-auto"
        >
          {/* Logo */}
          <div className="flex items-center gap-3 mb-10">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#2E5E99]"
              style={{ boxShadow: "var(--nm-raised-sm)" }}
            >
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-display text-lg font-bold tracking-tight text-foreground">
              LinXar Ops: Social
            </span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground mb-2">
              Create your account
            </h1>
            <p className="text-muted-foreground text-sm">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-semibold text-[#2E5E99] hover:underline transition-colors"
              >
                Sign in here
              </Link>
            </p>
          </div>

          {/* Form card */}
          <div
            className="rounded-2xl p-6 bg-[var(--nm-bg)]"
            style={{ boxShadow: "var(--nm-raised)" }}
          >
            <form action={formAction} className="space-y-5">
              {state?.error && (
                <div
                  className="rounded-xl px-4 py-3 text-sm text-rose-400 bg-[var(--nm-bg)]"
                  style={{ boxShadow: "var(--nm-inset-sm)" }}
                >
                  {state.error}
                </div>
              )}

              {/* Full name */}
              <div className="space-y-2">
                <label htmlFor="name" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Full name
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <input
                    id="name" name="name" type="text"
                    placeholder="John Doe" required
                    className="w-full h-10 pl-10 pr-4 rounded-xl text-sm text-foreground bg-[var(--nm-bg)] placeholder:text-muted-foreground focus:outline-none"
                    style={{ boxShadow: "var(--nm-inset-sm)" }}
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <label htmlFor="email" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <input
                    id="email" name="email" type="email"
                    placeholder="name@company.com" required
                    className="w-full h-10 pl-10 pr-4 rounded-xl text-sm text-foreground bg-[var(--nm-bg)] placeholder:text-muted-foreground focus:outline-none"
                    style={{ boxShadow: "var(--nm-inset-sm)" }}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label htmlFor="password" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <input
                    id="password" name="password" type="password" required
                    className="w-full h-10 pl-10 pr-4 rounded-xl text-sm text-foreground bg-[var(--nm-bg)] placeholder:text-muted-foreground focus:outline-none"
                    style={{ boxShadow: "var(--nm-inset-sm)" }}
                  />
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="w-full h-11 rounded-xl text-sm font-semibold text-white bg-[#2E5E99] flex items-center justify-center gap-2 group transition-all mt-2"
                style={{ boxShadow: "var(--nm-raised-sm)" }}
              >
                Create Account
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>

              <p className="text-[10px] text-center text-muted-foreground">
                By signing up you agree to our{" "}
                <Link href="#" className="text-[#2E5E99] hover:underline">Terms of Service</Link>
                {" "}and{" "}
                <Link href="#" className="text-[#2E5E99] hover:underline">Privacy Policy</Link>
              </p>
            </form>
          </div>

          {/* Bottom login link */}
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-[#2E5E99] hover:underline">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>

      {/* ── Left: animated feature showcase ── */}
      <div className="hidden lg:block flex-1 relative overflow-hidden">
        {/* Vertical separator */}
        <div
          className="absolute right-0 top-0 bottom-0 w-px"
          style={{ background: "linear-gradient(to bottom, transparent, rgba(46,94,153,0.25), transparent)" }}
        />
        <FeatureShowcase />
      </div>
    </div>
  )
}
