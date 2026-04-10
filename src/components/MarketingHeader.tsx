import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChefHat, ArrowRight, Menu, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export function MarketingHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t } = useTranslation();

  const NAV_LINKS = [
    { label: t("nav.pricing"), path: "/pricing" },
  ];

  const isActive = (path: string) => location.pathname === path;

  const goTo = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  return (
    <header className="border-b bg-background/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-6 h-16">
        <button onClick={() => goTo("/")} className="flex items-center gap-2.5 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm group-hover:shadow-md transition-shadow">
            <ChefHat className="h-5 w-5" />
          </div>
          <span className="font-serif text-lg tracking-tight">d<span className="text-amber-500">ai</span>n Menu</span>
        </button>

        {/* Desktop nav */}
        <div className="hidden sm:flex items-center gap-1">
          {NAV_LINKS.map((l) => (
            <Button
              key={l.path}
              variant="ghost"
              size="sm"
              onClick={() => goTo(l.path)}
              className={isActive(l.path) ? "text-foreground" : "text-muted-foreground hover:text-foreground"}
            >
              {l.label}
            </Button>
          ))}
          <Button variant="ghost" size="sm" onClick={() => { window.location.href = "/api/login"; }} className="text-muted-foreground hover:text-foreground">
            {t("nav.signIn")}
          </Button>
          <LanguageSwitcher variant="marketing" />
          <Button size="sm" onClick={() => { window.location.href = "/api/login"; }} className="ml-1">
            {t("nav.getStarted")} <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="sm:hidden p-2 rounded-lg hover:bg-muted transition-colors"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile dropdown panel */}
      {mobileOpen && (
        <div className="sm:hidden border-t bg-background px-4 py-3 space-y-1">
          {NAV_LINKS.map((l) => (
            <button
              key={l.path}
              onClick={() => goTo(l.path)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive(l.path)
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {l.label}
            </button>
          ))}
          <div className="pt-1 space-y-1">
            <button
              onClick={() => { window.location.href = "/api/login"; setMobileOpen(false); }}
              className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              {t("nav.signIn")}
            </button>
            <div className="px-3 py-2">
              <LanguageSwitcher variant="marketing" />
            </div>
            <Button className="w-full" onClick={() => { window.location.href = "/api/login"; }}>
              {t("nav.getStarted")} <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
