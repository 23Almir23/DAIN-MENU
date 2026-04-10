import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sparkles, Globe, ShieldCheck, ArrowRight,
  Upload, QrCode, CheckCircle2, ChefHat,
  PenLine, Utensils, Star, Smartphone,
} from "lucide-react";
import { SUPPORTED_LANGUAGES } from "@/lib/i18n-utils";
import { useTranslation } from "react-i18next";

const VALIDATED_LANG_CODES = ["en", "es", "fr", "de", "it", "pt"];
const validatedLanguages = SUPPORTED_LANGUAGES.filter((l) => VALIDATED_LANG_CODES.includes(l.code));

export default function Landing() {
  const { t } = useTranslation();

  const beforeText = t("landing.steps.ai.before");
  const afterText = t("landing.steps.ai.after");

  const trustItems = [
    { icon: Globe,        text: t("landing.trustItems.languages"),   iconClass: "text-primary" },
    { icon: ShieldCheck,  text: t("landing.trustItems.allergen"),    iconClass: "text-primary" },
    { icon: QrCode,       text: t("landing.trustItems.qr"),         iconClass: "text-amber-500" },
    { icon: CheckCircle2, text: t("landing.trustItems.approve"),    iconClass: "text-amber-500" },
    { icon: Upload,       text: t("landing.trustItems.import"),     iconClass: "text-primary" },
    { icon: Smartphone,   text: t("landing.trustItems.noApp"),      iconClass: "text-primary" },
  ];

  const guestShowcasePills = [
    { icon: Smartphone,   label: t("landing.guestShowcase.pill1") },
    { icon: Globe,        label: t("landing.guestShowcase.pill2") },
    { icon: CheckCircle2, label: t("landing.guestShowcase.pill3") },
  ];

  return (
    <>
      {/* ─── HERO ─── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.03] via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-primary/[0.03] rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-5xl mx-auto px-6 pt-20 sm:pt-28 pb-16 relative">
          <div className="flex flex-col lg:flex-row items-start gap-10 lg:gap-12">

            {/* Left: copy + CTAs */}
            <div className="flex-1 text-center lg:text-left">
              <Badge variant="outline" className="mb-8 text-xs px-4 py-1.5 border-primary/20 bg-primary/5 text-primary rounded-full">
                <ChefHat className="h-3 w-3 mr-1.5" /> {t("landing.heroBadge")}
              </Badge>
              <h1 className="text-4xl sm:text-5xl md:text-[3.5rem] lg:text-[4rem] font-serif tracking-tight leading-[1.1]">
                {t("landing.heroH1a")}
                <br />
                <span className="text-primary">{t("landing.heroH1b")}</span>
              </h1>
              <p className="mt-6 text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-lg mx-auto lg:mx-0">
                {t("landing.heroSub1")}
              </p>
              <p className="mt-3 text-sm text-muted-foreground/70 max-w-md mx-auto lg:mx-0">
                {t("landing.heroSub2")}
              </p>
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3">
                <Button size="lg" className="text-base px-8 h-13 shadow-lg shadow-primary/15 w-full sm:w-auto" onClick={() => { window.location.href = "/api/login"; }}>
                  {t("landing.heroCta")} <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
              <p className="mt-5 text-xs text-muted-foreground/70">{t("landing.heroFine")}</p>
            </div>

            {/* Right: workspace mockup */}
            <div className="shrink-0 w-full lg:w-[480px] mx-auto lg:mx-0">
              <div className="rounded-2xl border border-amber-200/50 dark:border-amber-700/20 bg-card shadow-2xl overflow-hidden">
                <div className="bg-muted/60 border-b px-4 py-2.5 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-muted-foreground/20" />
                    <div className="h-3 w-3 rounded-full bg-muted-foreground/20" />
                    <div className="h-3 w-3 rounded-full bg-muted-foreground/20" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="text-[10px] text-muted-foreground bg-background/60 rounded px-3 py-0.5 font-medium">
                      {t("landing.mockup.menuBuilder")}
                    </div>
                  </div>
                </div>
                <div className="flex">
                  <div className="flex-1 p-4 space-y-3 border-r">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-medium text-foreground">La Trattoria</p>
                      <Badge className="text-[9px] px-1.5 py-0 bg-green-500/10 text-green-700 border-0">{t("landing.mockup.itemsFlagged", { count: 3 })}</Badge>
                    </div>
                    <div className="rounded-lg bg-primary/5 border border-primary/15 px-3 py-2 flex items-center gap-2">
                      <Sparkles className="h-3 w-3 text-primary shrink-0" />
                      <p className="text-[10px] text-primary leading-snug">{t("landing.mockup.rewritePrompt")}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{t("landing.mockup.starters")}</p>
                    {[
                      { name: "Bruschetta", desc: "Grilled bread, tomato, basil.", review: true },
                      { name: "Burrata", desc: "Fresh burrata with cherry tomatoes and basil oil.", review: false },
                    ].map((item) => (
                      <div key={item.name} className={`rounded-lg border p-2.5 ${item.review ? "border-amber-300/60 bg-amber-50/40 dark:bg-amber-900/10" : "bg-muted/20"}`}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[11px] font-medium leading-tight">{item.name}</p>
                          {item.review && (
                            <Badge className="text-[8px] px-1 py-0 bg-amber-500/10 text-amber-700 border-amber-300/50 shrink-0">{t("landing.mockup.review")}</Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{item.desc}</p>
                        <div className="flex gap-1 mt-1.5">
                          <Badge variant="outline" className="text-[8px] px-1 py-0 rounded-full">🌾 {t("landing.mockup.allergenGluten")}</Badge>
                          <Badge variant="outline" className="text-[8px] px-1 py-0 rounded-full">🥛 {t("landing.mockup.allergenDairy")}</Badge>
                        </div>
                      </div>
                    ))}
                    <div className="rounded-lg border border-primary/20 bg-primary/[0.03] px-3 py-2 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="h-3 w-3 text-primary" />
                        <p className="text-[10px] font-medium text-primary">{t("landing.mockup.aiEnhance")}</p>
                      </div>
                      <p className="text-[9px] text-muted-foreground">{t("landing.mockup.rewriteTranslateAllergens")}</p>
                    </div>
                  </div>
                  <div className="w-[130px] shrink-0 p-3 space-y-2 bg-muted/10">
                    <p className="text-[9px] text-muted-foreground font-medium">{t("landing.mockup.guestViewMobile")}</p>
                    <div className="rounded-lg bg-primary text-primary-foreground p-2 text-center">
                      <p className="text-[10px] font-serif">La Trattoria</p>
                      <p className="text-[8px] opacity-80 mt-0.5">{t("landing.mockup.demoTag")}</p>
                    </div>
                    <div className="flex gap-0.5 flex-wrap">
                      {["🇬🇧", "🇪🇸", "🇫🇷"].map((f) => (
                        <span key={f} className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{f}</span>
                      ))}
                    </div>
                    {[
                      { name: "Bruschetta", desc: "Pane tostato…", price: "$12" },
                      { name: "Burrata", desc: "Burrata fresca…", price: "$16" },
                    ].map((item) => (
                      <div key={item.name} className="rounded-lg border p-1.5 bg-card">
                        <div className="flex items-center justify-between">
                          <p className="text-[9px] font-medium leading-tight">{item.name}</p>
                          <span className="text-[9px] font-bold ml-1">{item.price}</span>
                        </div>
                        <p className="text-[8px] text-muted-foreground mt-0.5">{item.desc}</p>
                      </div>
                    ))}
                    <p className="text-[8px] text-center text-muted-foreground pt-1">
                      Powered by <span className="text-primary font-semibold">Dain</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ─── TRUST STRIP ─── */}
      <section className="border-y bg-muted/20">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
            {trustItems.map(({ icon: Icon, text, iconClass }) => (
              <span key={text} className="flex items-center gap-1.5 text-sm text-muted-foreground whitespace-nowrap">
                <Icon className={`h-3.5 w-3.5 ${iconClass} shrink-0`} />
                {text}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 3-STEP WORKFLOW ─── */}
      <section className="py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-serif">{t("landing.steps.title")}</h2>
            <p className="text-muted-foreground mt-3">{t("landing.steps.subtitle")}</p>
          </div>

          <div className="flex flex-col md:flex-row items-start gap-0 md:gap-0">
            {[
              {
                n: "1",
                icon: Upload,
                title: t("landing.steps.import.title"),
                desc: t("landing.steps.import.desc"),
                trust: t("landing.steps.import.trust"),
                visual: (
                  <div className="mt-4 rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/20 p-4 flex flex-col items-center gap-2 text-center">
                    <Upload className="h-6 w-6 text-muted-foreground/50" />
                    <p className="text-[11px] text-muted-foreground font-medium">{t("landing.steps.import.visual_file")}</p>
                    <p className="text-[10px] text-muted-foreground/60">{t("landing.steps.import.visual_extracting")}</p>
                    <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
                      <div className="bg-primary h-1 rounded-full w-2/3" />
                    </div>
                  </div>
                ),
              },
              {
                n: "2",
                icon: Sparkles,
                title: t("landing.steps.ai.title"),
                desc: t("landing.steps.ai.desc"),
                trust: null,
                visual: (
                  <div className="mt-4 space-y-2">
                    <div className="rounded-xl border bg-muted/30 px-3 py-2">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">{t("landing.mockup.before")}</p>
                      <p className="text-[11px] text-foreground/70">{beforeText}</p>
                    </div>
                    <div className="flex justify-center">
                      <div className="flex items-center gap-1 text-primary">
                        <Sparkles className="h-3 w-3" />
                        <ArrowRight className="h-3 w-3" />
                      </div>
                    </div>
                    <div className="rounded-xl border-2 border-primary/25 bg-primary/[0.03] px-3 py-2">
                      <p className="text-[9px] text-primary uppercase tracking-wider mb-0.5">{t("landing.mockup.after")}</p>
                      <p className="text-[11px] text-foreground leading-snug">{afterText}</p>
                    </div>
                  </div>
                ),
              },
              {
                n: "3",
                icon: QrCode,
                title: t("landing.steps.qr.title"),
                desc: t("landing.steps.qr.desc"),
                trust: null,
                visual: (
                  <div className="mt-4 flex flex-col items-center gap-2">
                    <div className="rounded-xl border bg-card p-3 shadow-sm">
                      <div className="grid grid-cols-5 gap-0.5 w-[70px]">
                        {Array.from({ length: 25 }).map((_, i) => (
                          <div key={i} className={`h-3 w-3 rounded-[2px] ${[0,1,2,3,5,9,10,12,14,15,16,17,18,21,22,23,24].includes(i) ? "bg-foreground/80" : "bg-transparent"}`} />
                        ))}
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{t("landing.steps.qr.scanLabel")}</p>
                  </div>
                ),
              },
            ].map((step, i, arr) => (
              <div key={step.n} className="flex flex-col md:flex-row items-start flex-1 min-w-0">
                <div className="flex-1 min-w-0 flex flex-col items-center text-center md:items-start md:text-left px-4 md:px-6 py-4 md:py-0">
                  <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-serif text-xl font-bold shadow-sm shadow-primary/20 shrink-0">
                    {step.n}
                  </div>
                  <div className="h-10 w-12 flex items-center justify-center md:hidden">
                    <div className="w-px h-full bg-border" />
                  </div>
                  <div className="hidden md:flex h-11 w-11 rounded-xl bg-primary/8 items-center justify-center mt-5 mb-1">
                    <step.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-sans-heading text-base mt-4 md:mt-5">{step.title}</h3>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-[240px]">{step.desc}</p>
                  {step.trust && (
                    <p className="text-[11px] text-muted-foreground/70 mt-3 italic max-w-[240px]">{step.trust}</p>
                  )}
                  <div className="w-full max-w-[240px]">{step.visual}</div>
                </div>
                {i < arr.length - 1 && (
                  <div className="hidden md:flex items-center self-start mt-6 shrink-0 text-muted-foreground/30">
                    <ArrowRight className="h-5 w-5" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── AI PROOF: BEFORE / AFTER ─── */}
      <section className="border-y bg-muted/40 py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 text-xs rounded-full px-3 bg-amber-50 text-amber-700 border-amber-200/70 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/50">
              <Sparkles className="h-3 w-3 mr-1" /> {t("landing.aiProof.badge")}
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-serif">{t("landing.aiProof.title")}</h2>
            <p className="text-muted-foreground mt-3">{t("landing.aiProof.subtitle")}</p>
          </div>

          {/* Evidence card 1: Rewrite descriptions */}
          <div className="mb-8">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">{t("landing.aiProof.rewrite")}</p>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-2xl border bg-card p-6 space-y-3">
                <Badge variant="outline" className="text-xs rounded-full">{t("landing.aiProof.youTyped")}</Badge>
                <div className="flex items-start gap-3 mt-2">
                  <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Utensils className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-sans-heading text-sm">Grilled Chicken</p>
                    <p className="text-muted-foreground text-sm mt-1 leading-relaxed">{beforeText}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border-2 border-primary/25 bg-card p-6 space-y-3 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/[0.04] rounded-full -translate-y-1/2 translate-x-1/2" />
                <Badge className="text-xs bg-primary/10 text-primary border-primary/20 hover:bg-primary/10 rounded-full">
                  <Sparkles className="h-3 w-3 mr-1" /> {t("landing.aiProof.guestSees")}
                </Badge>
                <div className="flex items-start gap-3 mt-2 relative">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Utensils className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-sans-heading text-sm">Pan-Seared Free-Range Chicken</p>
                      <Star className="h-3.5 w-3.5 text-primary fill-primary shrink-0" />
                    </div>
                    <p className="text-muted-foreground text-sm mt-1 leading-relaxed">{afterText}</p>
                    <p className="font-semibold mt-3">$18.00</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Evidence cards 2 & 3: Translate + Allergens */}
          <div className="grid md:grid-cols-2 gap-4 mb-8">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">{t("landing.aiProof.translate")}</p>
              <div className="rounded-2xl border bg-card p-6 space-y-3 h-full">
                <div className="space-y-2">
                  <div className="rounded-xl border p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm">🇬🇧</span>
                      <span className="text-[10px] text-muted-foreground font-medium">{t("landing.aiProof.englishOrig")}</span>
                    </div>
                    <p className="text-xs font-medium">Bruschetta Classica</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Toasted sourdough topped with fresh tomatoes, basil, and extra virgin olive oil.</p>
                  </div>
                  <div className="rounded-xl border border-primary/20 bg-primary/[0.02] p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm">🇪🇸</span>
                      <span className="text-[10px] text-primary font-medium">Español</span>
                    </div>
                    <p className="text-xs font-medium">Bruschetta Clásica</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Pan de masa madre tostado con tomates frescos, albahaca y aceite de oliva virgen extra.</p>
                  </div>
                  <div className="rounded-xl border border-primary/20 bg-primary/[0.02] p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm">🇫🇷</span>
                      <span className="text-[10px] text-primary font-medium">Français</span>
                    </div>
                    <p className="text-xs font-medium">Bruschetta Classique</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Pan au levain grillé garni de tomates fraîches, basilic et huile d&apos;olive vierge extra.</p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">{t("landing.aiProof.allergens")}</p>
              <div className="rounded-2xl border bg-card p-6 space-y-4 h-full">
                <div className="rounded-xl border bg-muted/30 p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Utensils className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{t("landing.aiProof.youEntered")}</p>
                      <p className="text-sm font-medium">Spaghetti Carbonara</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{t("landing.aiProof.noAllergenInfo")}</p>
                    </div>
                  </div>
                </div>
                <div className="flex justify-center">
                  <div className="flex items-center gap-2 text-primary">
                    <Sparkles className="h-4 w-4" />
                    <span className="text-xs font-medium">{t("landing.aiProof.aiDetects")}</span>
                  </div>
                </div>
                <div className="rounded-xl border-2 border-primary/25 bg-primary/[0.02] p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Utensils className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-primary uppercase tracking-wider mb-1">{t("landing.aiProof.withAllergens")}</p>
                      <p className="text-sm font-medium">Spaghetti Carbonara</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        <Badge variant="outline" className="text-[10px] rounded-full">🌾 Gluten</Badge>
                        <Badge variant="outline" className="text-[10px] rounded-full">🥚 Eggs</Badge>
                        <Badge variant="outline" className="text-[10px] rounded-full">🥛 Dairy</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2.5 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
            <span>{t("landing.aiProof.trust")}</span>
          </div>
        </div>
      </section>

      {/* ─── LANGUAGE COVERAGE ─── */}
      <section className="py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-serif">{t("landing.languages.title")}</h2>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto leading-relaxed">
              {t("landing.languages.subtitle")}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {validatedLanguages.map((lang) => (
              <div
                key={lang.code}
                className="flex items-center gap-2 rounded-full border bg-card px-5 py-2.5 text-sm font-medium shadow-sm hover:shadow-md transition-shadow"
              >
                <span className="text-xl">{lang.flag}</span>
                <span>{lang.nativeLabel}</span>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-muted-foreground mt-6">
            {t("landing.languages.note")}
          </p>
        </div>
      </section>

      {/* ─── GUEST VIEW SHOWCASE ─── */}
      <section className="border-y bg-muted/20 py-24 overflow-hidden">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex flex-col-reverse lg:flex-row items-center gap-14 lg:gap-16">
            <div className="flex-1 text-center lg:text-left">
              <Badge variant="outline" className="mb-5 text-xs px-4 py-1.5 border-primary/20 bg-primary/5 text-primary rounded-full">
                {t("landing.guestShowcase.badge")}
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-serif tracking-tight leading-[1.15]" style={{ whiteSpace: "pre-line" }}>
                {t("landing.guestShowcase.title")}
              </h2>
              <p className="text-muted-foreground mt-4 max-w-md mx-auto lg:mx-0 leading-relaxed">
                {t("landing.guestShowcase.subtitle")}
              </p>
              <div className="mt-8 space-y-3 max-w-sm mx-auto lg:mx-0">
                {guestShowcasePills.map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm text-foreground shadow-sm">
                    <Icon className="h-4 w-4 text-primary shrink-0" />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="shrink-0">
              <div className="w-[300px] rounded-[3rem] border-[6px] border-foreground/10 bg-card shadow-[0_32px_80px_rgba(0,0,0,0.12)] overflow-hidden">
                <div className="bg-muted/50 h-7 w-full flex items-center justify-center">
                  <div className="h-2 w-12 rounded-full bg-muted-foreground/25" />
                </div>
                <div className="bg-primary px-5 pt-4 pb-5 text-primary-foreground">
                  <p className="text-base font-serif font-medium text-center">La Trattoria</p>
                  <p className="text-xs opacity-75 mt-0.5 text-center">Italian · Bern, Switzerland</p>
                  <div className="flex gap-1.5 mt-3 justify-center">
                    {[
                      { flag: "🇬🇧", label: "EN", active: true },
                      { flag: "🇩🇪", label: "DE", active: false },
                      { flag: "🇫🇷", label: "FR", active: false },
                      { flag: "🇪🇸", label: "ES", active: false },
                    ].map(({ flag, label, active }) => (
                      <span key={label} className={`text-xs px-2.5 py-1 rounded-full ${active ? "bg-primary text-primary-foreground font-semibold" : "opacity-60"}`}>
                        {flag} {label}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 px-4 pt-3 pb-2 border-b">
                  {[t("landing.mockup.starters"), t("landing.mockup.mains"), t("landing.mockup.desserts")].map((cat, i) => (
                    <span key={cat} className={`text-xs px-3 py-1 rounded-full font-medium ${i === 0 ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{cat}</span>
                  ))}
                </div>
                <div className="px-4 py-3 space-y-3">
                  {[
                    { name: "Bruschetta Classica", price: "$12", desc: "Toasted sourdough with fresh tomatoes, basil, and extra virgin olive oil.", tags: ["🌾 Gluten"] },
                    { name: "Burrata & Prosciutto", price: "$18", desc: "Creamy burrata with cured prosciutto, fig jam, and fresh rocket leaves.", tags: ["🥛 Dairy"] },
                    { name: "Caprese Salad", price: "$14", desc: "Buffalo mozzarella, heritage tomatoes, basil oil, and aged balsamic.", tags: ["🥛 Dairy"] },
                  ].map((item) => (
                    <div key={item.name} className="rounded-2xl border bg-card p-3 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold leading-tight">{item.name}</p>
                        <span className="text-sm font-bold text-primary shrink-0">{item.price}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.desc}</p>
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {item.tags.map((tag) => (
                          <span key={tag} className="text-[10px] border rounded-full px-2 py-0.5 text-muted-foreground">{tag}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-center text-muted-foreground/50 pb-4">
                  Powered by <span className="text-primary/70 font-semibold">Dain</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── PRICING ENTRY POINT ─── */}
      <section className="border-y bg-muted/40 py-16">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-3 rounded-2xl border bg-card px-8 py-5 shadow-sm">
            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
            <div className="text-left">
              <p className="font-sans-heading text-sm">{t("landing.pricingEntry.text")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t("landing.pricingEntry.sub")}</p>
            </div>
            <Button variant="outline" size="sm" className="ml-4 shrink-0" onClick={() => { window.location.href = "/api/login"; }}>
              {t("landing.pricingEntry.cta")} <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </div>
        </div>
      </section>

      {/* ─── TERMINAL CTA ─── */}
      <section className="py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="rounded-3xl border-2 border-primary/15 bg-gradient-to-b from-primary/[0.03] to-transparent p-12 sm:p-16 space-y-8">
            <h2 className="text-3xl sm:text-4xl font-serif tracking-tight">
              {t("landing.terminalCta.title")}
            </h2>
            <p className="text-muted-foreground text-lg max-w-lg mx-auto leading-relaxed">
              {t("landing.terminalCta.subtitle")}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button size="lg" className="text-base px-8 shadow-lg shadow-primary/15" onClick={() => { window.location.href = "/api/login"; }}>
                {t("landing.terminalCta.cta")} <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground/60">{t("landing.terminalCta.fine")}</p>
          </div>
        </div>
      </section>
    </>
  );
}
