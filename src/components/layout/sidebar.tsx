import Link from "next/link";
import { Calendar, Inbox, LayoutDashboard, Settings, Activity, PenSquare, Sparkles } from "lucide-react";

export function Sidebar() {
  const navItems = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Publishing", href: "/publishing", icon: PenSquare },
    { name: "Calendar", href: "/calendar", icon: Calendar },
    { name: "Inbox", href: "/inbox", icon: Inbox },
    { name: "Analytics", href: "/analytics", icon: Activity },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <aside className="w-64 border-r border-slate-200 bg-white h-screen hidden md:flex flex-col shrink-0 z-20 shadow-xs relative">
      <div className="h-16 border-b border-slate-100 flex items-center px-6">
        <div className="bg-violet-100 p-1.5 rounded-lg border border-violet-200 shadow-xs flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-violet-600" />
        </div>
        <h1 className="ml-2.5 text-lg font-bold tracking-tight text-slate-900">VistaClone</h1>
      </div>
      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => (
          <Link key={item.name} href={item.href} className="flex items-center space-x-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-violet-600 transition-colors group">
            <item.icon className="h-4 w-4 text-slate-400 group-hover:text-violet-600 transition-colors" />
            <span>{item.name}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
