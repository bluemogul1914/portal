import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Receipt,
  Wallet,
  LineChart,
  Landmark,
  FileText,
  Bot,
  Blocks,
  LogOut,
  Menu,
  Sun,
  Moon,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/context/ThemeContext";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { theme, toggleTheme } = useTheme();

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Transactions", href: "/transactions", icon: Receipt },
    { name: "Budgets", href: "/budgets", icon: Wallet },
    { name: "Taxes", href: "/taxes", icon: Landmark },
    { name: "Reconciliation", href: "/reconciliation", icon: FileText },
    { name: "Reports", href: "/reports", icon: LineChart },
    { name: "AI Assistant", href: "/chat", icon: Bot },
    { name: "Integrations", href: "/integrations", icon: Blocks },
  ];

  const NavContent = () => (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center px-6 gap-3 border-b border-border">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
          <Landmark className="w-4 h-4 text-white" />
        </div>
        <span className="font-display font-bold text-lg tracking-tight">Blue Mogul</span>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto px-4 py-6">
        <nav className="flex-1 space-y-1.5">
          {navigation.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`
                  group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200
                  ${isActive
                    ? "bg-primary/10 text-primary shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] border border-primary/20"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }
                `}
              >
                <item.icon className={`h-5 w-5 ${isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"} transition-colors`} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-border space-y-2">
        {/* Dark / Light Toggle */}
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-200 group"
          aria-label="Toggle theme"
        >
          <div className="relative w-5 h-5">
            <Sun
              className={`absolute inset-0 h-5 w-5 transition-all duration-300 ${
                theme === "light" ? "opacity-100 rotate-0 scale-100" : "opacity-0 rotate-90 scale-50"
              } text-amber-500`}
            />
            <Moon
              className={`absolute inset-0 h-5 w-5 transition-all duration-300 ${
                theme === "dark" ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-50"
              } text-primary`}
            />
          </div>
          {theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
        </button>

        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <LogOut className="mr-3 h-5 w-5" />
          Sign Out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full bg-background selection:bg-primary/30">
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 border-b border-border bg-background/80 backdrop-blur-md z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Landmark className="w-4 h-4 text-white" />
          </div>
          <span className="font-display font-bold tracking-tight">Blue Mogul</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-primary" />}
          </button>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 border-r border-border bg-card">
              <NavContent />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:w-72 lg:flex-col lg:fixed lg:inset-y-0 z-50 border-r border-border bg-card/50 backdrop-blur-xl">
        <NavContent />
      </div>

      {/* Main Content */}
      <div className="flex-1 lg:pl-72 flex flex-col min-h-screen">
        <main className="flex-1 pt-16 lg:pt-0 pb-12 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
