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
  Activity,
  Building2,
  ShoppingCart,
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

  const mainNav = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Transactions", href: "/transactions", icon: Receipt },
    { name: "Purchases", href: "/purchases", icon: ShoppingCart },
    { name: "Vendors", href: "/vendors", icon: Building2 },
    { name: "Budgets", href: "/budgets", icon: Wallet },
    { name: "Taxes", href: "/taxes", icon: Landmark },
    { name: "Reconciliation", href: "/reconciliation", icon: FileText },
    { name: "Reports", href: "/reports", icon: LineChart },
  ];

  const toolsNav = [
    { name: "AI Assistant", href: "/chat", icon: Bot },
    { name: "Integrations", href: "/integrations", icon: Blocks },
  ];

  const NavItem = ({ item }: { item: { name: string; href: string; icon: React.ElementType } }) => {
    const isActive = location === item.href;
    return (
      <Link
        href={item.href}
        className={`
          group flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-all duration-150
          ${isActive
            ? "bg-primary/15 text-primary"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          }
        `}
      >
        <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"} transition-colors`} />
        {item.name}
      </Link>
    );
  };

  const SectionLabel = ({ label }: { label: string }) => (
    <div className="px-3 pt-5 pb-1">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 select-none">
        {label}
      </p>
    </div>
  );

  const NavContent = () => (
    <div className="flex h-full flex-col bg-card">
      {/* Logo — matches "BLUE MOGUL | Admin Panel" portal style */}
      <div className="flex h-14 shrink-0 items-center gap-3 px-4 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded bg-primary flex items-center justify-center shrink-0">
            <Landmark className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="font-display font-bold text-sm tracking-wide text-foreground uppercase">Blue Mogul</span>
            <span className="text-[10px] text-muted-foreground font-medium border-l border-border pl-1.5">Bookkeeping</span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto px-2 py-3">
        {/* Main nav */}
        <nav className="space-y-0.5">
          {mainNav.map(item => <NavItem key={item.name} item={item} />)}
        </nav>

        {/* Tools section */}
        <SectionLabel label="Tools" />
        <nav className="space-y-0.5">
          {toolsNav.map(item => <NavItem key={item.name} item={item} />)}
        </nav>
      </div>

      {/* Bottom — system status + controls */}
      <div className="border-t border-border">
        {/* System status — mirrors portal's status bar */}
        <div className="px-4 py-3 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
            </span>
            <span className="font-medium">System Online</span>
          </div>
          <Activity className="w-3.5 h-3.5 text-muted-foreground/50" />
        </div>

        {/* Theme toggle */}
        <div className="px-2 pb-1 space-y-0.5">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-all duration-150"
            aria-label="Toggle theme"
          >
            <div className="relative w-4 h-4 shrink-0">
              <Sun
                className={`absolute inset-0 h-4 w-4 transition-all duration-200 ${
                  theme === "light" ? "opacity-100 scale-100" : "opacity-0 scale-50"
                } text-amber-500`}
              />
              <Moon
                className={`absolute inset-0 h-4 w-4 transition-all duration-200 ${
                  theme === "dark" ? "opacity-100 scale-100" : "opacity-0 scale-50"
                } text-primary`}
              />
            </div>
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>

          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 px-3"
          >
            <LogOut className="mr-3 h-4 w-4" />
            Sign Out
          </Button>
        </div>
        <div className="px-4 py-2 text-[10px] text-muted-foreground/40 font-medium">
          Blue Mogul Enterprise, LLC
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 border-b border-border bg-card/95 backdrop-blur-md z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
            <Landmark className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-display font-bold text-sm tracking-wide text-foreground uppercase">Blue Mogul</span>
            <span className="text-[10px] text-muted-foreground border-l border-border pl-1.5">Bookkeeping</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            {theme === "dark" ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-primary" />}
          </button>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 border-r border-border">
              <NavContent />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:w-60 lg:flex-col lg:fixed lg:inset-y-0 z-50 border-r border-border">
        <NavContent />
      </div>

      {/* Main Content */}
      <div className="flex-1 lg:pl-60 flex flex-col min-h-screen">
        <main className="flex-1 pt-14 lg:pt-0 pb-10 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
