"use client"

import { register } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { motion } from "framer-motion"
import { Compass, ArrowRight } from "lucide-react"

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 relative overflow-hidden flex-row-reverse">
      {/* Decorative premium background elements */}
      <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full bg-violet-200/50 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] rounded-full bg-teal-200/50 blur-[100px] pointer-events-none" />

      {/* Right side form panel (rendered on the left via flex-row-reverse, but conceptually the primary action zone) */}
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:flex-none lg:px-20 xl:px-24 z-10 w-full lg:w-[500px] mx-auto bg-white/80 backdrop-blur-xl border-l border-slate-100">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto w-full max-w-sm lg:w-[400px]"
        >
          <div className="flex items-center mb-10">
            <div className="bg-emerald-100 p-2.5 rounded-xl border border-emerald-200 shadow-sm flex items-center justify-center">
              <Compass className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="ml-3 text-xl font-bold tracking-tight text-slate-900">VistaClone</span>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-2">
              Create an account
            </h2>
            <p className="text-slate-500 text-sm">
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-emerald-600 hover:text-emerald-500 transition-colors">
                Sign in here
              </Link>
            </p>
          </div>

          <form action={register} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-slate-700 font-medium">Full Name</Label>
              <Input
                id="name"
                name="name"
                type="text"
                placeholder="John Doe"
                required
                className="bg-white border-slate-200 text-slate-900 focus-visible:ring-emerald-500 rounded-lg h-11 px-4 shadow-sm hover:border-slate-300 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-slate-700 font-medium">Email address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="name@company.com"
                required
                className="bg-white border-slate-200 text-slate-900 focus-visible:ring-emerald-500 rounded-lg h-11 px-4 shadow-sm hover:border-slate-300 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-slate-700 font-medium">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                className="bg-white border-slate-200 text-slate-900 focus-visible:ring-emerald-500 rounded-lg h-11 px-4 shadow-sm hover:border-slate-300 transition-colors"
              />
            </div>
            <Button
              type="submit"
              className="w-full h-11 mt-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-base transition-all group shadow-md"
            >
              Sign Up
              <ArrowRight className="w-4 h-4 ml-2 opacity-70 group-hover:translate-x-1 group-hover:opacity-100 transition-all" />
            </Button>
          </form>
        </motion.div>
      </div>

      {/* Left side visual panel - Editorial Minimalist style */}
      <div className="hidden lg:block relative w-full flex-1 bg-slate-50 overflow-hidden">
        <div className="absolute inset-0 bg-slate-100/50 backdrop-blur-3xl z-0" />

        <div className="absolute inset-0 flex items-center justify-center z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="w-[80%] max-w-2xl aspect-4/3 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex items-center justify-center p-12 bg-[radial-gradient(ellipse_at_top_left,var(--tw-gradient-stops))] from-emerald-50 via-white to-white"
          >
            <div className="text-center max-w-md">
               <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight mb-4">
                 Unified management for ambitious creators.
               </h3>
               <p className="text-slate-500 text-lg leading-relaxed">
                 Schedule content, analyze growth loops, and interact with your audience across every platform natively.
               </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
