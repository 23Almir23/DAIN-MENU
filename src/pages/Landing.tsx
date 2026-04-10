import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  QrCode, Globe, Sparkles, ArrowRight, Upload,
  ShieldCheck, Smartphone, CheckCircle2, ChefHat,
  Utensils, Star,
} from "lucide-react";
import { SUPPORTED_LANGUAGES } from "@/lib/i18n-utils";
import { useTranslation } from "react-i18next";

const VALIDATED_LANG_CODES = ["en", "es", "fr", "de", "it", "pt"];
const validatedLanguages = SUPPORTED_LANGUAGES.filter((l) =>
  VALIDATED_LANG_CODES.includes(l.code)
);

export default function Landing() {
  const { t } = useTranslation();

  const features = [
    { icon: QrCode,       title: t("landing.features.qr.title"),          desc: t("landing.features.qr.desc") },
    { icon: Sparkles,     title: t("landing.features.ai.title"),           desc: t("landing.features.ai.desc") },
    { icon: Globe,        title: t("landing.features.multilingual.title"), desc: t("landing.features.multilingual.desc") },
    { icon: ShieldCheck,  title: t("landing.features.allergens.title"),    desc: t("landing.features.allergens.desc") },
    { icon: Upload,       title: t("landing.features.import.title"),       desc: t("landing.features.import.desc") },
    { icon: Smartphone,   title: t("landing.features.noapp.title"),        desc: t("landing.features.noapp.desc") },
  ];

  const beforeText = t("landing.steps.ai.before");
  const afterText  = t("landing.steps.ai.after");

  return (
    <>
      {/* ─── HERO ─── */}
      <section className="relative overflow-hidden bg-[#100e0b] text-white">
        <div className="absolute -top-24 right-0 w-[700px] h-[700px] bg-primary/[0.08] rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-0 -left-32 w-[500px] h-[500px] bg-primary/[0.04] rounded-full blur-[120px] pointer-events-none" />
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(hsl(18 76% 48% / 0.4) 1px, transparent 1px), linear-gradient(90deg, hsl(18 76% 48% / 0.4) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <div className="relative max-w-6xl mx-auto px-6 py-24 lg:py-32">
          <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-10">

            {/* ── Left copy ── */}
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] backdrop-blur-sm px-4 py-1.5 text-xs text-white/50 mb-8">
                <ChefHat className="h-3.5 w-3.5 text-primary shrink-0" />
                {t("landing.heroBadge")}
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-[3.75rem] font-serif leading-[1.08] tracking-tight text-white">
                {t("landing.heroH1a")}
                <br />
                <span className="text-primary">{t("landing.heroH1b")}</span>
              </h1>

              <p className="mt-6 text-base sm:text-lg text-white/50 leading-relaxed max-w-lg mx-auto lg:mx-0">
                {t("landing.heroSub1")}
              </p>

              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3">
                <Button
                  size="lg"
                  className="text-sm px-7 h-12 shadow-xl shadow-primary/25 w-full sm:w-auto"
                  data-testid="button-hero-cta"
                  onClick={() => { window.location.href = "/api/login"; }}
                >
                  {t("landing.heroCta")} <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  className="text-sm px-7 h-12 text-white/50 hover:text-white hover:bg-white/[0.06] w-full sm:w-auto border border-white/10"
                  data-testid="button-hero-pricing"
                  onClick={() => { window.location.href = "/pricing"; }}
                >
                  {t("nav.pricing")}
                </Button>
              </div>

              <p className="mt-5 text-xs text-white/25">{t("landing.heroFine")}</p>
            </div>

            {/* ── Right: product mockup ── */}
            <div className="shrink-0 w-full lg:w-[480px]">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm shadow-2xl overflow-hidden">
                <div className="bg-white/[0.05] border-b border-white/10 px-4 py-2.5 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-white/10" />
                    <div className="h-3 w-3 rounded-full bg-white/10" />
                    <div className="h-3 w-3 rounded-full bg-white/10" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="text-[10px] text-white/30 bg-white/[0.06] rounded px-3 py-0.5 font-medium">
                      {t("landing.mockup.menuBuilder")}
                    </div>
                  </div>
                </div>
                <div className="flex">
                  <div className="flex-1 p-4 space-y-3 border-r border-white/10">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-medium text-white/70">La Trattoria</p>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                        {t("landing.mockup.itemsFlagged", { count: 3 })}
                      </span>
                    </div>
                    <div className="rounded-lg bg-primary/15 border border-primary/20 px-3 py-2 flex items-center gap-2">
                      <Sparkles className="h-3 w-3 text-primary shrink-0" />
                      <p className="text-[10px] text-primary leading-snug">{t("landing.mockup.rewritePrompt")}</p>
                    </div>
                    <p className="text-[9px] text-white/30 font-medium uppercase tracking-wider">{t("landing.mockup.starters")}</p>
                    {[
                      { name: "Bruschetta",  desc: "Grilled bread, tomato, basil.", review: true },
                      { name: "Burrata",     desc: "Fresh burrata with cherry tomatoes and basil oil.", review: false },
                    ].map((item) => (
                      <div
                        key={item.name}
                        className={`rounded-lg border p-2.5 ${
                          item.review
                            ? "border-amber-500/20 bg-amber-500/[0.07]"
                            : "border-white/8 bg-white/[0.03]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[11px] font-medium text-white/80 leading-tight">{item.name}</p>
                          {item.review && (
                            <span className="text-[8px] px-1 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20 shrink-0">
                              {t("landing.mockup.review")}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-white/35 mt-0.5 leading-snug">{item.desc}</p>
                        <div className="flex gap-1 mt-1.5">
                          <span className="text-[8px] px-1.5 py-0.5 rounded-full border border-white/10 text-white/40">
                            {t("landing.mockup.allergenGluten")}
                          </span>
                          <span className="text-[8px] px-1.5 py-0.5 rounded-full border border-white/10 text-white/40">
                            {t("landing.mockup.allergenDairy")}
                          </span>
                        </div>
                      </div>
                    ))}
                    <div className="rounded-lg border border-primary/20 bg-primary/[0.08] px-3 py-2 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="h-3 w-3 text-primary" />
                        <p className="text-[10px] font-medium text-primary">{t("landing.mockup.aiEnhance")}</p>
                      </div>
                      <p className="text-[9px] text-white/30">{t("landing.mockup.rewriteTranslateAllergens")}</p>
                    </div>
                  </div>

                  <div className="w-[130px] shrink-0 p-3 space-y-2 bg-white/[0.02]">
                    <p className="text-[9px] text-white/30 font-medium">{t("landing.mockup.guestViewMobile")}</p>
                    <div className="rounded-lg bg-primary text-primary-foreground p-2 text-center">
                      <p className="text-[10px] font-serif">La Trattoria</p>
                      <p className="text-[8px] opacity-70 mt-0.5">{t("landing.mockup.demoTag")}</p>
                    </div>
                    <div className="flex gap-0.5 flex-wrap">
                      {["EN", "DE", "FR"].map((code) => (
                        <span key={code} className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/8 text-white/40">
                          {code}
                        </span>
                      ))}
                    </div>
                    {[
                      { name: "Bruschetta", price: "$12" },
                      { name: "Burrata",    price: "$16" },
                    ].map((item) => (
                      <div key={item.name} className="rounded-lg border border-white/10 p-1.5 bg-white/[0.04]">
                        <div className="flex items-center justify-between">
                          <p className="text-[9px] font-medium text-white/70 leading-tight">{item.name}</p>
                          <span className="text-[9px] font-bold text-primary ml-1">{item.price}</span>
                        </div>
                      </div>
                    ))}
                    <p className="text-[8px] text-center text-white/20 pt-1">
                      Powered by <span className="text-primary/70 font-semibold">Dain</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ─── STATS STRIP ─── */}
      <section className="border-y bg-background">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex flex-wrap items-center justify-center gap-x-16 gap-y-6">
            {[
              { value: "6", label: t("landing.stats.languages") },
              { value: "< 2 min", label: t("landing.stats.importTime") },
              { value: "0", label: t("landing.stats.noApp") },
            ].map(({ value, label }) => (
              <div key={label} className="text-center" data-testid={`stat-${label}`}>
                <p className="text-3xl font-serif font-bold text-foreground tracking-tight">{value}</p>
                <p className="text-sm text-muted-foreground mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary mb-3">
              {t("landing.features.sectionLabel")}
            </p>
            <h2 className="text-3xl sm:text-4xl font-serif">{t("landing.features.title")}</h2>
            <p className="text-muted-foreground mt-4 max-w-lg mx-auto leading-relaxed">
              {t("landing.features.subtitle")}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-2xl border bg-card p-6 hover:shadow-md hover:border-primary/20 transition-all"
                data-testid={`feature-card-${title}`}
              >
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-sans-heading text-sm text-foreground mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="bg-[#100e0b] text-white py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary mb-3">
              {t("landing.steps.sectionLabel")}
            </p>
            <h2 className="text-3xl sm:text-4xl font-serif text-white">{t("landing.steps.title")}</h2>
            <p className="text-white/40 mt-4 max-w-lg mx-auto">{t("landing.steps.subtitle")}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-10 md:gap-6">
            {[
              { n: "01", icon: Upload,   title: t("landing.steps.import.title"), desc: t("landing.steps.import.desc") },
              { n: "02", icon: Sparkles, title: t("landing.steps.ai.title"),     desc: t("landing.steps.ai.desc") },
              { n: "03", icon: QrCode,   title: t("landing.steps.qr.title"),     desc: t("landing.steps.qr.desc") },
            ].map(({ n, icon: Icon, title, desc }) => (
              <div key={n} className="relative">
                <div className="text-[5rem] font-serif font-bold text-white/[0.04] leading-none select-none mb-3">
                  {n}
                </div>
                <div className="h-11 w-11 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center mb-5">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-sans-heading text-base text-white mb-3">{title}</h3>
                <p className="text-sm text-white/45 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── AI DEMO ─── */}
      <section className="py-24 bg-muted/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <Badge
              variant="outline"
              className="mb-4 text-xs rounded-full px-4 py-1 bg-primary/5 text-primary border-primary/20"
            >
              <Sparkles className="h-3 w-3 mr-1.5" /> {t("landing.aiProof.badge")}
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-serif">{t("landing.aiProof.title")}</h2>
            <p className="text-muted-foreground mt-4 max-w-lg mx-auto leading-relaxed">
              {t("landing.aiProof.subtitle")}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div className="rounded-2xl border bg-card p-6">
              <Badge variant="outline" className="text-xs rounded-full mb-4">
                {t("landing.aiProof.youTyped")}
              </Badge>
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  <Utensils className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-sans-heading text-sm">Grilled Chicken</p>
                  <p className="text-muted-foreground text-sm mt-1 leading-relaxed">{beforeText}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border-2 border-primary/25 bg-primary/[0.02] p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/[0.06] rounded-full -translate-y-1/2 translate-x-1/2" />
              <Badge className="text-xs bg-primary/10 text-primary border-primary/20 hover:bg-primary/10 rounded-full mb-4">
                <Sparkles className="h-3 w-3 mr-1" /> {t("landing.aiProof.guestSees")}
              </Badge>
              <div className="flex items-start gap-3 relative">
                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Utensils className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-sans-heading text-sm">Pan-Seared Free-Range Chicken</p>
                    <Star className="h-3.5 w-3.5 text-primary fill-primary shrink-0" />
                  </div>
                  <p className="text-muted-foreground text-sm mt-1 leading-relaxed">{afterText}</p>
                  <p className="font-bold mt-2">$18.00</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-10">
            <div className="rounded-2xl border bg-card p-6">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                {t("landing.aiProof.translate")}
              </p>
              <div className="space-y-2">
                {[
                  { lang: "EN", label: t("landing.aiProof.englishOrig"), text: "Toasted sourdough topped with fresh tomatoes, basil, and extra virgin olive oil.", highlight: false },
                  { lang: "ES", label: "Español", text: "Pan de masa madre tostado con tomates frescos, albahaca y aceite de oliva virgen extra.", highlight: true },
                  { lang: "FR", label: "Français", text: "Pain au levain grillé garni de tomates fraîches, basilic et huile d'olive vierge extra.", highlight: true },
                ].map(({ lang, label, text, highlight }) => (
                  <div
                    key={lang}
                    className={`rounded-xl border p-3 ${highlight ? "border-primary/20 bg-primary/[0.02]" : ""}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${highlight ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {lang}
                      </span>
                      <span className={`text-[10px] font-medium ${highlight ? "text-primary" : "text-muted-foreground"}`}>{label}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">Bruschetta Classica — {text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-6">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                {t("landing.aiProof.allergens")}
              </p>
              <div className="space-y-3">
                <div className="rounded-xl border bg-muted/40 p-4">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">{t("landing.aiProof.youEntered")}</p>
                  <p className="text-sm font-medium">Spaghetti Carbonara</p>
                  <p className="text-xs text-muted-foreground mt-0.5 italic">{t("landing.aiProof.noAllergenInfo")}</p>
                </div>
                <div className="flex items-center justify-center gap-2 text-primary text-xs">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{t("landing.aiProof.aiDetects")}</span>
                </div>
                <div className="rounded-xl border-2 border-primary/25 bg-primary/[0.02] p-4">
                  <p className="text-[10px] text-primary uppercase tracking-wider mb-2">{t("landing.aiProof.withAllergens")}</p>
                  <p className="text-sm font-medium mb-2">Spaghetti Carbonara</p>
                  <div className="flex flex-wrap gap-1.5">
                    {["Gluten", "Eggs", "Dairy"].map((a) => (
                      <span key={a} className="text-[10px] border border-primary/20 rounded-full px-2.5 py-0.5 text-primary bg-primary/5">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
            <span>{t("landing.aiProof.trust")}</span>
          </div>
        </div>
      </section>

      {/* ─── GUEST VIEW ─── */}
      <section className="py-24 overflow-hidden">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col-reverse lg:flex-row items-center gap-14 lg:gap-20">
            <div className="flex-1 text-center lg:text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary mb-3">
                {t("landing.guestShowcase.badge")}
              </p>
              <h2
                className="text-3xl sm:text-4xl font-serif tracking-tight leading-[1.15]"
                style={{ whiteSpace: "pre-line" }}
              >
                {t("landing.guestShowcase.title")}
              </h2>
              <p className="text-muted-foreground mt-4 max-w-md mx-auto lg:mx-0 leading-relaxed">
                {t("landing.guestShowcase.subtitle")}
              </p>
              <div className="mt-8 space-y-3 max-w-sm mx-auto lg:mx-0">
                {[
                  { icon: Smartphone,   label: t("landing.guestShowcase.pill1") },
                  { icon: Globe,        label: t("landing.guestShowcase.pill2") },
                  { icon: CheckCircle2, label: t("landing.guestShowcase.pill3") },
                ].map(({ icon: Icon, label }) => (
                  <div
                    key={label}
                    className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm text-foreground shadow-sm"
                  >
                    <Icon className="h-4 w-4 text-primary shrink-0" />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="shrink-0">
              <div className="w-[300px] rounded-[3rem] border-[6px] border-foreground/10 bg-card shadow-[0_32px_80px_rgba(0,0,0,0.12)] overflow-hidden">
                <div className="bg-muted/50 h-7 flex items-center justify-center">
                  <div className="h-2 w-12 rounded-full bg-muted-foreground/25" />
                </div>
                <div className="bg-primary px-5 pt-4 pb-5 text-primary-foreground">
                  <p className="text-base font-serif font-medium text-center">La Trattoria</p>
                  <p className="text-xs opacity-70 mt-0.5 text-center">Italian · Bern, Switzerland</p>
                  <div className="flex gap-1.5 mt-3 justify-center flex-wrap">
                    {[
                      { code: "EN", active: true },
                      { code: "DE", active: false },
                      { code: "FR", active: false },
                      { code: "ES", active: false },
                    ].map(({ code, active }) => (
                      <span
                        key={code}
                        className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          active ? "bg-white/20 text-white" : "opacity-50 text-white"
                        }`}
                      >
                        {code}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 px-4 pt-3 pb-2 border-b">
                  {[
                    t("landing.mockup.starters"),
                    t("landing.mockup.mains"),
                    t("landing.mockup.desserts"),
                  ].map((cat, i) => (
                    <span
                      key={cat}
                      className={`text-xs px-3 py-1 rounded-full font-medium ${
                        i === 0 ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {cat}
                    </span>
                  ))}
                </div>
                <div className="px-4 py-3 space-y-3">
                  {[
                    { name: "Bruschetta Classica",  price: "$12", desc: "Toasted sourdough with fresh tomatoes, basil, and extra virgin olive oil.", tags: ["Gluten"] },
                    { name: "Burrata & Prosciutto", price: "$18", desc: "Creamy burrata with cured prosciutto and fresh rocket.", tags: ["Dairy"] },
                    { name: "Caprese Salad",        price: "$14", desc: "Buffalo mozzarella, heritage tomatoes, basil oil.", tags: ["Dairy"] },
                  ].map((item) => (
                    <div key={item.name} className="rounded-2xl border bg-card p-3 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold leading-tight">{item.name}</p>
                        <span className="text-sm font-bold text-primary shrink-0">{item.price}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.desc}</p>
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {item.tags.map((tag) => (
                          <span key={tag} className="text-[10px] border rounded-full px-2 py-0.5 text-muted-foreground">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-center text-muted-foreground/40 pb-4">
                  Powered by <span className="text-primary/60 font-semibold">Dain</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── LANGUAGES ─── */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-serif mb-4">{t("landing.languages.title")}</h2>
          <p className="text-muted-foreground mb-10 max-w-lg mx-auto leading-relaxed">
            {t("landing.languages.subtitle")}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {validatedLanguages.map((lang) => (
              <div
                key={lang.code}
                className="flex items-center gap-2 rounded-full border bg-card px-5 py-2.5 text-sm font-medium shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
                data-testid={`lang-pill-${lang.code}`}
              >
                <span className="text-xl">{lang.flag}</span>
                <span>{lang.nativeLabel}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-6">{t("landing.languages.note")}</p>
        </div>
      </section>

      {/* ─── TERMINAL CTA ─── */}
      <section className="bg-[#100e0b] py-24 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-primary/[0.12] rounded-full blur-[100px] pointer-events-none" />

        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-14 sm:p-20">
            <h2 className="text-4xl sm:text-5xl font-serif text-white leading-tight">
              {t("landing.terminalCta.title")}
            </h2>
            <p className="text-white/45 text-lg mt-6 max-w-lg mx-auto leading-relaxed">
              {t("landing.terminalCta.subtitle")}
            </p>
            <div className="mt-10">
              <Button
                size="lg"
                className="text-sm px-8 h-12 shadow-xl shadow-primary/25"
                data-testid="button-terminal-cta"
                onClick={() => { window.location.href = "/api/login"; }}
              >
                {t("landing.terminalCta.cta")} <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
            <p className="mt-6 text-xs text-white/20">{t("landing.terminalCta.fine")}</p>
          </div>
        </div>
      </section>
    </>
  );
}
