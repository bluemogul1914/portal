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
  Menu
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

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
      <div className="flex h-16 shrink-0 items-center px-6 gap-3 border-b border-white/5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
          <Landmark className="w-4 h-4 text-white" />
        </div>
        <span className="font-display font-bold text-lg tracking-tight text-white">Blue Mogul</span>
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
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
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
      <div className="p-4 border-t border-white/5">
        <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10">
          <LogOut className="mr-3 h-5 w-5" />
          Sign Out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full bg-background selection:bg-primary/30">
      {/* Mobile Sidebar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 border-b border-white/5 bg-background/80 backdrop-blur-md z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Landmark className="w-4 h-4 text-white" />
          </div>
          <span className="font-display font-bold tracking-tight text-white">Blue Mogul</span>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0 border-r-white/10 bg-card">
            <NavContent />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:w-72 lg:flex-col lg:fixed lg:inset-y-0 z-50 border-r border-white/5 bg-card/50 backdrop-blur-xl">
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
