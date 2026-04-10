import { useNavigate } from "react-router-dom";
import { ChefHat } from "lucide-react";
import { useTranslation } from "react-i18next";

export function MarketingFooter() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <footer className="border-t bg-muted/30 py-12">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
              <ChefHat className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-sm font-serif">Dain Menu</span>
            <span className="text-xs text-muted-foreground">© {new Date().getFullYear()}</span>
            <span className="text-xs text-muted-foreground/40">·</span>
            <span className="text-xs text-muted-foreground/60">dainmenu.com</span>
          </div>
          <nav className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-muted-foreground">
            <button onClick={() => navigate("/pricing")} className="hover:text-foreground transition-colors">{t("nav.pricing")}</button>
            <button onClick={() => { window.location.href = "/api/login"; }} className="hover:text-foreground transition-colors">{t("nav.signIn")}</button>
            <button onClick={() => { window.location.href = "/api/login"; }} className="hover:text-foreground transition-colors">{t("nav.getStarted")}</button>
          </nav>
        </div>
        <p className="text-xs text-muted-foreground/70 mt-8">
          {t("footer.tagline")}
        </p>
      </div>
    </footer>
  );
}
