import { Bell, Menu, Search, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signout } from "@/app/actions/auth";

export async function Header() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <header className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-xl px-6 flex items-center justify-between sticky top-0 z-10 w-full shadow-xs">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="icon" className="md:hidden text-slate-500 hover:text-slate-900 hover:bg-slate-100">
          <Menu className="h-5 w-5" />
        </Button>
        <div className="relative hidden sm:flex items-center">
          <Search className="absolute left-3 h-4 w-4 text-slate-400" />
          <input
            type="search"
            placeholder="Search..."
            className="h-9 rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#128C7E] disabled:cursor-not-allowed disabled:opacity-50 pl-9 w-64 lg:w-80 text-slate-900 placeholder:text-slate-400 hover:border-slate-300 hover:bg-white"
          />
        </div>
      </div>
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="icon" className="text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-full">
          <Bell className="h-5 w-5" />
        </Button>

        {user ? (
          <form action={signout}>
            <button title="Sign Out" className="flex items-center rounded-full ring-2 ring-transparent ring-offset-2 ring-offset-white transition-all hover:ring-[#128C7E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#128C7E] shadow-xs">
              <Avatar className="border border-slate-200">
                <AvatarImage src={user.user_metadata?.avatar_url || ""} alt={user.user_metadata?.name || "User"} />
                <AvatarFallback className="bg-[#128C7E]/10 text-[#0B1020] font-medium">
                  {user.user_metadata?.name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
            </button>
          </form>
        ) : (
          <Link href="/login">
            <Button variant="default" size="sm" className="flex gap-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 shadow-xs transition-all">
              <LogIn className="h-4 w-4" /> Sign In
            </Button>
          </Link>
        )}
      </div>
    </header>
  );
}
