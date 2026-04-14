"use client"

import { login } from "@/app/actions/auth"
import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import {
  Sparkles, ArrowRight, Mail, Lock,
  BarChart3, Calendar, CheckCircle, Users,
} from "lucide-react"
import { useActionState } from "react"

/* ─── Floating preview card ─────────────────────────────────── */
function FloatCard({
  delay, children, className,
}: { delay: number; children: React.ReactNode; className?: string }) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={reduced
        ? { opacity: 1, y: 0 }
        : { opacity: 1, y: [0, -6, 0] }}
      transition={reduced
        ? { duration: 0.5, delay }
        : { opacity: { duration: 0.5, delay }, y: { duration: 4, delay: delay + 0.5, repeat: Infinity, ease: "easeInOut" } }}
      className={`rounded-2xl p-4 bg-[var(--nm-bg)] ${className ?? ""}`}
      style={{ boxShadow: "var(--nm-raised)" }}
    >
      {children}
    </motion.div>
  )
}

/* ─── Animated right-panel illustration ─────────────────────── */
function ProductPreview() {
  return (
    <div className="relative w-full h-full flex items-center justify-center p-12 overflow-hidden">
      {/* Background glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-[#128C7E]/15 blur-[80px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full bg-[#128C7E]/10 blur-[60px] pointer-events-none" />

      {/* Card grid */}
      <div className="relative w-full max-w-sm space-y-4">

        {/* Stat row */}
        <div className="grid grid-cols-2 gap-4">
          <FloatCard delay={0.1} className="flex flex-col gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(18,140,126,0.15)", boxShadow: "var(--nm-inset-sm)" }}
            >
              <BarChart3 className="w-4 h-4 text-[#128C7E]" />
            </div>
            <div>
              <p className="font-display text-2xl font-bold text-foreground leading-none">48</p>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mt-1">Posts</p>
            </div>
          </FloatCard>

          <FloatCard delay={0.2} className="flex flex-col gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(99,102,241,0.15)", boxShadow: "var(--nm-inset-sm)" }}
            >
              <Users className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <p className="font-display text-2xl font-bold text-foreground leading-none">3</p>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mt-1">Profiles</p>
            </div>
          </FloatCard>
        </div>

        {/* Recent activity card */}
        <FloatCard delay={0.3}>
          <p className="text-xs font-semibold text-foreground mb-3">Recent Activity</p>
          <div className="space-y-2.5">
            {[
              { label: "LinkedIn post published", time: "2m ago", ok: true },
              { label: "X thread scheduled",      time: "1h ago", ok: true },
              { label: "Facebook post pending",   time: "3h ago", ok: false },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    background: item.ok ? "rgba(18,140,126,0.15)" : "rgba(245,158,11,0.15)",
                    boxShadow: "var(--nm-inset-sm)",
                  }}
                >
                  <CheckCircle className="w-3 h-3" style={{ color: item.ok ? "#128C7E" : "#F59E0B" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground truncate">{item.label}</p>
                </div>
                <p className="text-[10px] font-semibold text-muted-foreground shrink-0">{item.time}</p>
              </div>
            ))}
          </div>
        </FloatCard>

        {/* Calendar teaser */}
        <FloatCard delay={0.4} className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(244,63,94,0.15)", boxShadow: "var(--nm-inset-sm)" }}
          >
            <Calendar className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">5 posts scheduled</p>
            <p className="text-xs text-muted-foreground">Next 7 days</p>
          </div>
        </FloatCard>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.9 }}
          className="text-center text-xs text-muted-foreground pt-2"
        >
          &ldquo;The most intuitive way to orchestrate social growth.&rdquo;
          <br />
          <span className="font-semibold text-[#128C7E]">— Sarah Jenkins, Marketing Director</span>
        </motion.p>
      </div>
    </div>
  )
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function LoginPage() {
  const [state, formAction] = useActionState(login, null)

  return (
    <div className="flex min-h-screen bg-background overflow-hidden">

      {/* ── Left: form panel ── */}
      <div className="flex-1 lg:flex-none lg:w-[480px] flex flex-col justify-center px-8 sm:px-12 lg:px-16 py-12 relative z-10">

        {/* Ambient glow */}
        <div className="absolute top-0 left-0 w-72 h-72 rounded-full bg-[#128C7E]/8 blur-[100px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-sm mx-auto"
        >
          {/* Logo */}
          <div className="flex items-center gap-3 mb-10">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#128C7E]"
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
              Welcome back
            </h1>
            <p className="text-muted-foreground text-sm">
              Don&apos;t have an account?{" "}
              <Link
                href="/register"
                className="font-semibold text-[#128C7E] hover:underline transition-colors"
              >
                Create one free
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
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Password
                  </label>
                  <Link href="#" className="text-xs font-medium text-[#128C7E] hover:underline">
                    Forgot password?
                  </Link>
                </div>
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
                className="w-full h-11 rounded-xl text-sm font-semibold text-white bg-[#128C7E] flex items-center justify-center gap-2 group transition-all mt-2"
                style={{ boxShadow: "var(--nm-raised-sm)" }}
              >
                Sign In
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </form>
          </div>

          {/* Bottom register link */}
          <p className="mt-6 text-center text-sm text-muted-foreground">
            New to LinXar?{" "}
            <Link href="/register" className="font-semibold text-[#128C7E] hover:underline">
              Create your account
            </Link>
          </p>
        </motion.div>
      </div>

      {/* ── Right: animated product illustration ── */}
      <div className="hidden lg:block flex-1 relative overflow-hidden">
        {/* Vertical separator */}
        <div
          className="absolute left-0 top-0 bottom-0 w-px"
          style={{ background: "linear-gradient(to bottom, transparent, rgba(18,140,126,0.25), transparent)" }}
        />
        <ProductPreview />
      </div>
    </div>
  )
}
