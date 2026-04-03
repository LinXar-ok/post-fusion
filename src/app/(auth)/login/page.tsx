"use client"

import { login } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { motion } from "framer-motion"
import { Sparkles, ArrowRight } from "lucide-react"
import { useActionState } from "react"

export default function LoginPage() {
  const [state, formAction] = useActionState(login, null)

  return (
    <div className="flex min-h-screen bg-white text-slate-900 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] rounded-full bg-[#128C7E]/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full bg-teal-200/50 blur-[100px] pointer-events-none" />

      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:flex-none lg:px-20 xl:px-24 z-10 w-full lg:w-[500px] mx-auto bg-white/80 backdrop-blur-xl border-r border-slate-100">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto w-full max-w-sm lg:w-[400px]"
        >
          <div className="flex items-center mb-10">
            <div className="bg-[#128C7E]/10 p-2.5 rounded-xl border border-[#128C7E]/20 shadow-sm flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-[#128C7E]" />
            </div>
            <span className="ml-3 text-xl font-bold tracking-tight text-slate-900">LinXar Ops: Social</span>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-2">Sign in to your account</h2>
            <p className="text-slate-500 text-sm">
              Or{" "}
              <Link href="/register" className="font-semibold text-[#128C7E] hover:text-[#128C7E] transition-colors">
                start your 14-day free trial
              </Link>
            </p>
          </div>

          <form action={formAction} className="space-y-5">
            {state?.error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                {state.error}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-slate-700 font-medium">Email address</Label>
              <Input id="email" name="email" type="email" placeholder="name@company.com" required
                className="bg-white border-slate-200 text-slate-900 focus-visible:ring-[#128C7E] rounded-lg h-11 px-4 shadow-sm hover:border-slate-300 transition-colors" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-slate-700 font-medium">Password</Label>
                <Link href="#" className="text-sm font-medium text-[#128C7E] hover:text-[#128C7E]">Forgot password?</Link>
              </div>
              <Input id="password" name="password" type="password" required
                className="bg-white border-slate-200 text-slate-900 focus-visible:ring-[#128C7E] rounded-lg h-11 px-4 shadow-sm hover:border-slate-300 transition-colors" />
            </div>
            <Button type="submit" className="w-full h-11 mt-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium text-base transition-all group shadow-md">
              Sign In
              <ArrowRight className="w-4 h-4 ml-2 opacity-70 group-hover:translate-x-1 group-hover:opacity-100 transition-all" />
            </Button>
          </form>
        </motion.div>
      </div>

      <div className="hidden lg:block relative w-full flex-1 bg-slate-50 overflow-hidden">
        <div className="absolute inset-0 bg-slate-100/50 backdrop-blur-3xl z-0" />
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="w-[80%] max-w-2xl aspect-4/3 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
          >
            <div className="h-12 border-b border-slate-100 flex items-center px-4 space-x-2 bg-slate-50/50">
              <div className="w-3 h-3 rounded-full bg-rose-400" />
              <div className="w-3 h-3 rounded-full bg-amber-400" />
              <div className="w-3 h-3 rounded-full bg-emerald-400" />
            </div>
            <div className="flex-1 p-8 grid grid-cols-3 gap-6 bg-slate-50/30">
              <div className="col-span-2 space-y-4">
                <div className="h-32 bg-indigo-50 rounded-xl border border-indigo-100" />
                <div className="h-48 bg-white rounded-xl border border-slate-100 shadow-sm" />
              </div>
              <div className="col-span-1 space-y-4">
                <div className="h-20 bg-white rounded-xl border border-slate-100 shadow-sm" />
                <div className="h-20 bg-white rounded-xl border border-slate-100 shadow-sm" />
                <div className="h-20 bg-white rounded-xl border border-slate-100 shadow-sm" />
              </div>
            </div>
          </motion.div>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="absolute bottom-12 left-1/2 -translate-x-1/2 z-20 w-full max-w-lg"
        >
          <div className="p-6 bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl text-center">
            <h3 className="text-lg font-medium text-slate-50 mb-2">&quot;The most intuitive way to orchestrate social growth.&quot;</h3>
            <p className="text-slate-400 text-sm font-medium">— Sarah Jenkins, Marketing Director</p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
