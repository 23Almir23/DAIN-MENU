import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChefHat, ArrowLeft, Home } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function NotFound() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="text-center max-w-md space-y-6">
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <ChefHat className="h-8 w-8 text-primary" />
          </div>
        </div>
        <div>
          <p className="text-6xl font-serif text-primary">{t("notFound.code")}</p>
          <h1 className="text-xl font-semibold mt-3">{t("notFound.title")}</h1>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            {t("notFound.desc")}
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-1.5" /> {t("notFound.goBack")}
          </Button>
          <Button onClick={() => navigate("/dashboard")}>
            <Home className="h-4 w-4 mr-1.5" /> {t("notFound.dashboard")}
          </Button>
        </div>
      </div>
    </div>
  );
}
