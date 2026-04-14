import { Bell, Menu, Search, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signout } from "@/app/actions/auth";
import { ThemeToggle } from "./theme-toggle";

export async function Header() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <header
      className="h-16 px-6 flex items-center justify-between sticky top-0 z-10 w-full"
      style={{ background: "var(--nm-bg)" }}
    >
      {/* Left: mobile menu + search */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden text-slate-500 hover:text-foreground rounded-xl hover:bg-transparent bg-[var(--nm-bg)]"
          style={{ boxShadow: "var(--nm-raised-sm)" }}
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Neumorphic inset search */}
        <div
          className="relative hidden sm:flex items-center rounded-xl bg-[var(--nm-bg)]"
          style={{ boxShadow: "var(--nm-inset-sm)" }}
        >
          <Search className="absolute left-3 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search..."
            className="h-9 rounded-xl bg-transparent px-3 py-1 text-sm text-foreground placeholder:text-muted-foreground pl-9 w-56 lg:w-72 focus:outline-none"
          />
        </div>
      </div>

      {/* Right: theme toggle + notifications + avatar */}
      <div className="flex items-center gap-2.5">
        <ThemeToggle />

        <button
          className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-[#2E5E99] transition-colors duration-200 bg-[var(--nm-bg)]"
          style={{ boxShadow: "var(--nm-raised-sm)" }}
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
        </button>

        {user ? (
          <form action={signout}>
            <button
              title="Sign Out"
              className="rounded-xl transition-colors duration-200 focus-visible:outline-none bg-[var(--nm-bg)] p-0.5"
              style={{ boxShadow: "var(--nm-raised-sm)" }}
            >
              <Avatar className="w-8 h-8">
                <AvatarImage
                  src={user.user_metadata?.avatar_url || ""}
                  alt={user.user_metadata?.name || "User"}
                />
                <AvatarFallback className="bg-[#2E5E99]/15 text-[#2E5E99] font-semibold text-xs">
                  {user.user_metadata?.name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
            </button>
          </form>
        ) : (
          <Link href="/login">
            <Button
              size="sm"
              className="rounded-xl bg-[#2E5E99] text-white hover:bg-[#0e7066] shadow-none transition-all"
              style={{ boxShadow: "var(--nm-raised-sm)" }}
            >
              <LogIn className="h-4 w-4 mr-1.5" /> Sign In
            </Button>
          </Link>
        )}
      </div>
    </header>
  );
}
