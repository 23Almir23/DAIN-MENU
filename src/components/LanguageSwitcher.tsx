import { useTranslation } from "react-i18next";

interface Props {
  variant?: "marketing" | "sidebar";
}

export function LanguageSwitcher({ variant = "marketing" }: Props) {
  const { i18n, t } = useTranslation();
  const current = i18n.language;

  const toggle = (lang: string) => {
    if (lang !== current) i18n.changeLanguage(lang);
  };

  const base =
    variant === "sidebar"
      ? "flex items-center gap-0.5 text-[11px] font-medium text-sidebar-foreground/60"
      : "flex items-center gap-0.5 text-xs font-medium text-muted-foreground";

  const active =
    variant === "sidebar"
      ? "text-sidebar-foreground underline underline-offset-2"
      : "text-foreground underline underline-offset-2";

  const sep =
    variant === "sidebar" ? "text-sidebar-foreground/30" : "text-muted-foreground/40";

  return (
    <div className={base} aria-label={t("common.languageSwitcher")}>
      <button
        onClick={() => toggle("de")}
        className={`px-1 py-0.5 rounded transition-colors hover:text-foreground ${current === "de" ? active : ""}`}
        aria-pressed={current === "de"}
      >
        DE
      </button>
      <span className={sep}>|</span>
      <button
        onClick={() => toggle("en")}
        className={`px-1 py-0.5 rounded transition-colors hover:text-foreground ${current === "en" ? active : ""}`}
        aria-pressed={current === "en"}
      >
        EN
      </button>
    </div>
  );
}
