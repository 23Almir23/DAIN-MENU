import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useRestaurant } from "@/hooks/use-restaurant";
import { useBilling } from "@/hooks/use-billing";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Save, Settings as SettingsIcon,
  Building2, Phone, Scale, Clock, CreditCard, Share2,
  Plus, X, Check, Lock, Palette, ChevronDown, ChevronUp,
} from "lucide-react";
import { PageWrapper } from "@/components/PageWrapper";
import { PageHeader } from "@/components/PageHeader";
import { GUEST_THEMES } from "@/data/guest-themes";
import type { GuestThemeId } from "@/data/guest-themes";
import { TEMPLATE_LIST } from "@/lib/themes";
import type { Restaurant } from "@/types/menu";
import { SUPPORTED_LANGUAGES } from "@/lib/i18n-utils";

const SERVICE_OPTIONS: string[] = ["dine-in", "takeaway", "delivery", "catering"];
const LANGUAGE_OPTIONS = [
  { code: "en", label: "English" }, { code: "es", label: "Spanish" },
  { code: "fr", label: "French" }, { code: "de", label: "German" },
  { code: "it", label: "Italian" }, { code: "pt", label: "Portuguese" },
  { code: "zh", label: "Chinese" }, { code: "ja", label: "Japanese" },
  { code: "ar", label: "Arabic" }, { code: "ko", label: "Korean" },
  { code: "nl", label: "Dutch" }, { code: "tr", label: "Turkish" },
];
const CURRENCY_OPTIONS = ["USD", "EUR", "GBP", "CHF", "CAD", "AUD", "JPY"];
const SOCIAL_PLATFORMS = ["Instagram", "Facebook", "X / Twitter", "TikTok", "Google Business", "TripAdvisor", "Yelp"];

function Field({ label, id, required, hint, children }: {
  label: string; id?: string; required?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-1">
        <Label htmlFor={id}>{label}</Label>
        {required && <span className="text-destructive text-xs">*</span>}
      </div>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SectionCard({ title, description, icon: Icon, badge, children }: {
  title: string; description: string; icon: React.ElementType; badge?: string; children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="h-4.5 w-4.5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{title}</CardTitle>
              {badge && <Badge variant="outline" className="text-[10px]">{badge}</Badge>}
            </div>
            <CardDescription className="text-xs mt-0.5">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

export default function Settings() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { plan } = useBilling();

  const { restaurant: serverRestaurant } = useRestaurant();

  const [form, setForm] = useState<Restaurant>(serverRestaurant!);
  const [newSocialPlatform, setNewSocialPlatform] = useState("");
  const [newSocialUrl, setNewSocialUrl] = useState("");
  const [legalOpen, setLegalOpen] = useState(() => sessionStorage.getItem("settings_legal_open") === "1");

  const toggleLegal = () => {
    const next = !legalOpen;
    setLegalOpen(next);
    sessionStorage.setItem("settings_legal_open", next ? "1" : "0");
  };

  useEffect(() => {
    if (serverRestaurant) {
      setForm((f) => {
        const shouldSeed = !f || JSON.stringify(f) === JSON.stringify(serverRestaurant);
        return shouldSeed ? { ...serverRestaurant } : f;
      });
    }
  }, [serverRestaurant]); // eslint-disable-line react-hooks/exhaustive-deps

  const u = (field: keyof Restaurant, value: unknown) =>
    setForm((f) => ({ ...f, [field]: value }));

  const { mutate: patchRestaurant, isPending: isSaving } = useMutation({
    mutationFn: async (data: Restaurant) => {
      const res = await fetch("/api/restaurant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? "Save failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant"] });
      toast.success(t("settings.toasts.saved"));
    },
    onError: (err: Error) => toast.error(t("settings.toasts.saveFailed") + err.message),
  });

  const save = () => {
    if (!form.name.trim()) { toast.error(t("settings.toasts.nameRequired")); return; }
    patchRestaurant(form);
  };

  const toggleService = (svc: string) => {
    const current = form.serviceTypes || [];
    const has = current.includes(svc as any);
    u("serviceTypes", has ? current.filter((s) => s !== svc) : [...current, svc as any]);
  };

  const toggleLanguage = (code: string) => {
    const current = form.supportedLanguages || [];
    u("supportedLanguages", current.includes(code) ? current.filter((c) => c !== code) : [...current, code]);
  };

  const addSocialLink = () => {
    if (!newSocialPlatform || !newSocialUrl.trim()) return;
    const links = form.socialLinks || [];
    u("socialLinks", [...links, { platform: newSocialPlatform, url: newSocialUrl.trim() }]);
    setNewSocialPlatform("");
    setNewSocialUrl("");
  };

  const removeSocialLink = (idx: number) => {
    u("socialLinks", (form.socialLinks || []).filter((_, i) => i !== idx));
  };

  const baseline = serverRestaurant!;
  const hasChanges = JSON.stringify(form) !== JSON.stringify(baseline);

  return (
    <PageWrapper maxWidth="md">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <PageHeader title={t("settings.title")} icon={SettingsIcon} description={t("settings.description")} />
        <Button onClick={save} disabled={!hasChanges || isSaving} className="shrink-0">
          <Save className="h-4 w-4 mr-1.5" /> {isSaving ? t("settings.saving") : t("settings.saveAll")}
        </Button>
      </div>

      {/* 1. Restaurant Identity */}
      <SectionCard
        title={t("settings.sections.identity.title")}
        description={t("settings.sections.identity.desc")}
        icon={Building2}
        badge={t("settings.sections.identity.badge")}
      >
        <Field label={t("settings.fields.restaurantName")} id="s-name" required>
          <Input id="s-name" value={form.name} onChange={(e) => u("name", e.target.value)} />
        </Field>
        <Field label={t("settings.fields.brandName")} id="s-brand" hint={t("settings.fields.brandNameHint")}>
          <Input id="s-brand" value={form.brandName || ""} onChange={(e) => u("brandName", e.target.value)} placeholder={t("common.optional")} />
        </Field>
        <Field label={t("settings.fields.cuisine")} id="s-cuisine">
          <Input id="s-cuisine" value={form.cuisine} onChange={(e) => u("cuisine", e.target.value)} placeholder={t("settings.fields.cuisinePlaceholder")} />
        </Field>
        <Field label={t("settings.fields.shortDesc")} id="s-desc" hint={t("settings.fields.shortDescHint")}>
          <Textarea id="s-desc" value={form.description} onChange={(e) => u("description", e.target.value)} rows={3} />
        </Field>
      </SectionCard>

      {/* 2. Business Contact */}
      <SectionCard title={t("settings.sections.contact.title")} description={t("settings.sections.contact.desc")} icon={Phone}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t("settings.fields.email")} id="s-email">
            <Input id="s-email" type="email" value={form.email || ""} onChange={(e) => u("email", e.target.value)} placeholder={t("settings.fields.emailPlaceholder")} />
          </Field>
          <Field label={t("settings.fields.phone")} id="s-phone">
            <Input id="s-phone" value={form.phone} onChange={(e) => u("phone", e.target.value)} />
          </Field>
        </div>
        <Field label={t("settings.fields.website")} id="s-web">
          <Input id="s-web" value={form.website || ""} onChange={(e) => u("website", e.target.value)} placeholder={t("settings.fields.websitePlaceholder")} />
        </Field>
        <Separator />
        <Field label={t("settings.fields.address")} id="s-addr">
          <Input id="s-addr" value={form.address} onChange={(e) => u("address", e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Field label={t("settings.fields.city")} id="s-city">
            <Input id="s-city" value={form.city || ""} onChange={(e) => u("city", e.target.value)} />
          </Field>
          <Field label={t("settings.fields.postalCode")} id="s-zip">
            <Input id="s-zip" value={form.postalCode || ""} onChange={(e) => u("postalCode", e.target.value)} />
          </Field>
          <Field label={t("settings.fields.country")} id="s-country">
            <Input id="s-country" value={form.country || ""} onChange={(e) => u("country", e.target.value)} />
          </Field>
        </div>
      </SectionCard>

      {/* 3. Legal / Official — collapsed by default */}
      <Card>
        <button
          type="button"
          className="w-full text-left"
          onClick={toggleLegal}
          data-testid="toggle-legal-section"
        >
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Scale className="h-4.5 w-4.5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">
                    {t("settings.sections.legal.titleAdvanced")}
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px]">{t("settings.sections.legal.badge")}</Badge>
                </div>
                <CardDescription className="text-xs mt-0.5">
                  {legalOpen
                    ? t("settings.sections.legal.descOpen")
                    : t("settings.sections.legal.descClosed")}
                </CardDescription>
              </div>
              <div className="shrink-0 text-muted-foreground ml-2">
                {legalOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </div>
          </CardHeader>
        </button>
        {legalOpen && (
          <CardContent className="space-y-4">
            <Field label={t("settings.fields.legalCompanyName")} id="s-legal" hint={t("settings.fields.legalCompanyNameHint")}>
              <Input id="s-legal" value={form.legalCompanyName || ""} onChange={(e) => u("legalCompanyName", e.target.value)} placeholder="e.g., The Corner Bistro GmbH" />
            </Field>
            <Field label={t("settings.fields.ownerDirector")} id="s-owner" hint={t("settings.fields.ownerDirectorHint")}>
              <Input id="s-owner" value={form.ownerName || ""} onChange={(e) => u("ownerName", e.target.value)} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t("settings.fields.taxNumber")} id="s-tax" hint={t("settings.fields.taxNumberHint")}>
                <Input id="s-tax" value={form.taxNumber || ""} onChange={(e) => u("taxNumber", e.target.value)} />
              </Field>
              <Field label={t("settings.fields.vatId")} id="s-vat" hint={t("settings.fields.vatIdHint")}>
                <Input id="s-vat" value={form.vatId || ""} onChange={(e) => u("vatId", e.target.value)} placeholder="e.g., DE123456789" />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t("settings.fields.commercialRegister")} id="s-reg" hint={t("settings.fields.commercialRegisterHint")}>
                <Input id="s-reg" value={form.commercialRegisterNumber || ""} onChange={(e) => u("commercialRegisterNumber", e.target.value)} />
              </Field>
              <Field label={t("settings.fields.legalForm")} id="s-form" hint={t("settings.fields.legalFormHint")}>
                <Input id="s-form" value={form.legalForm || ""} onChange={(e) => u("legalForm", e.target.value)} />
              </Field>
            </div>
            <Field label={t("settings.fields.registeredAddress")} id="s-regaddr" hint={t("settings.fields.registeredAddressHint")}>
              <Input id="s-regaddr" value={form.registeredAddress || ""} onChange={(e) => u("registeredAddress", e.target.value)} placeholder={t("settings.fields.registeredAddressPlaceholder")} />
            </Field>
          </CardContent>
        )}
      </Card>

      {/* 4. Operating Information */}
      <SectionCard title={t("settings.sections.operating.title")} description={t("settings.sections.operating.desc")} icon={Clock}>
        <Field label={t("settings.fields.openingHours")} id="s-hours" hint={t("settings.fields.openingHoursHint")}>
          <Textarea id="s-hours" value={form.openingHours || ""} onChange={(e) => u("openingHours", e.target.value)} rows={2} placeholder={t("settings.fields.openingHoursPlaceholder")} />
        </Field>
        <Field label={t("settings.fields.holidayNotes")} id="s-holiday" hint={t("settings.fields.holidayNotesHint")}>
          <Textarea id="s-holiday" value={form.holidayNotes || ""} onChange={(e) => u("holidayNotes", e.target.value)} rows={2} placeholder={t("common.optional")} />
        </Field>
        <Separator />
        <Field label={t("settings.fields.serviceTypes")}>
          <div className="flex flex-wrap gap-3 mt-1">
            {SERVICE_OPTIONS.map((svc) => (
              <label key={svc} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={(form.serviceTypes || []).includes(svc as any)}
                  onCheckedChange={() => toggleService(svc)}
                />
                <span className="text-sm capitalize">{t(`settings.serviceOptions.${svc}`, svc)}</span>
              </label>
            ))}
          </div>
        </Field>
        <Separator />
        <Field
          label={t("settings.fields.menuLanguage")}
          id="s-base-lang"
          hint={t("settings.fields.menuLanguageHint")}
        >
          <Select value={form.baseLanguage || "en"} onValueChange={(v) => u("baseLanguage", v)}>
            <SelectTrigger id="s-base-lang" data-testid="select-base-language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_LANGUAGES.map((l) => (
                <SelectItem key={l.code} value={l.code}>
                  {l.flag} {l.label} ({l.nativeLabel})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Separator />
        <Field label={t("settings.fields.translationTargets")} hint={t("settings.fields.translationTargetsHint")}>
          <div className="flex flex-wrap gap-2 mt-1">
            {LANGUAGE_OPTIONS.map((lang) => {
              const isSupported = SUPPORTED_LANGUAGES.some((s) => s.code === lang.code);
              return (
                <Badge
                  key={lang.code}
                  variant={(form.supportedLanguages || []).includes(lang.code) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleLanguage(lang.code)}
                >
                  {lang.label}
                  {!isSupported && (
                    <span className="ml-1 font-normal opacity-60 text-[10px]">{t("settings.fields.translationNotYetAvailable")}</span>
                  )}
                </Badge>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {t("settings.fields.supportedLanguagesNote")}
          </p>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t("settings.fields.currency")} id="s-currency">
            <Select value={form.currency || "USD"} onValueChange={(v) => u("currency", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CURRENCY_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("settings.fields.locale")} id="s-locale">
            <Select value={form.defaultLocale || "en"} onValueChange={(v) => u("defaultLocale", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANGUAGE_OPTIONS.map((l) => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </SectionCard>

      {/* 5. Guest Menu Theme */}
      <SectionCard
        title={t("settings.sections.design.title")}
        description={t("settings.sections.design.desc")}
        icon={Palette}
        badge={t("settings.sections.design.badge")}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {GUEST_THEMES.map((theme) => {
            const isSelected = (form.guestTheme || "elegant") === theme.id;
            const isLocked = theme.id === "custom" && plan === "free";
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => {
                  if (isLocked) {
                    navigate("/billing");
                    return;
                  }
                  u("guestTheme", theme.id as GuestThemeId);
                }}
                className={`relative flex flex-col overflow-hidden rounded-xl border text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isSelected ? "ring-2 ring-primary shadow-md" : "hover:shadow-sm"
                } ${isLocked ? "opacity-75" : ""}`}
              >
                {isSelected && (
                  <div className="absolute top-2.5 right-2.5 h-5 w-5 rounded-full bg-primary flex items-center justify-center z-10">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </div>
                )}
                {isLocked && (
                  <div className="absolute top-2.5 right-2.5 h-5 w-5 rounded-full bg-muted flex items-center justify-center z-10">
                    <Lock className="h-3 w-3 text-muted-foreground" />
                  </div>
                )}
                {/* Color swatch */}
                <div className="h-16 relative overflow-hidden" style={{ background: theme.preview.headerBg }}>
                  <div className="absolute bottom-0 left-0 right-0 h-8" style={{ background: `linear-gradient(to top, ${theme.preview.bodyBg}, transparent)` }} />
                  <div className="absolute bottom-1.5 left-2 right-2 flex gap-1">
                    {[1, 2].map((i) => (
                      <div key={i} className="flex-1 h-4 rounded-sm" style={{ backgroundColor: theme.preview.cardBg, boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }} />
                    ))}
                  </div>
                </div>
                <div className="p-3 flex-1">
                  <p className="text-sm font-medium leading-tight">{theme.name}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{theme.tagline}</p>
                </div>
              </button>
            );
          })}
        </div>
        {plan === "free" && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Lock className="h-3 w-3 shrink-0" />
            {t("settings.fields.customBrandingNote")}{" "}
            <button onClick={() => navigate("/billing")} className="text-primary underline underline-offset-2 hover:no-underline">
              {t("settings.fields.seePlans")}
            </button>
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {t("settings.fields.previewNote")}{" "}
          <a href="/preview" className="text-primary underline underline-offset-2">{t("settings.fields.guestPreview")}</a>.
        </p>

        {/* Template picker */}
        <Separator />
        <div className="space-y-2">
          <Label>Menu Template</Label>
          <p className="text-xs text-muted-foreground">Choose the color palette and feel for your guest-facing menu.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {TEMPLATE_LIST.map((tmpl) => {
              const isSelected = (form.template || "noir") === tmpl.id;
              return (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => u("template", tmpl.id)}
                  className={`relative flex flex-col overflow-hidden rounded-xl border text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    isSelected ? "ring-2 ring-primary shadow-md" : "hover:shadow-sm"
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-2.5 right-2.5 h-5 w-5 rounded-full bg-primary flex items-center justify-center z-10">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                  {/* Color swatch */}
                  <div
                    className="h-16 relative overflow-hidden flex items-end"
                    style={{ backgroundColor: tmpl.vars["--bg"] as string }}
                  >
                    <div className="absolute bottom-1.5 left-2 right-2 flex gap-1">
                      {[1, 2].map((i) => (
                        <div
                          key={i}
                          className="flex-1 h-5 rounded"
                          style={{
                            backgroundColor: tmpl.vars["--bg-card"] as string,
                            border: `1px solid ${tmpl.vars["--border"] as string}`,
                          }}
                        />
                      ))}
                    </div>
                    <div
                      className="absolute bottom-3 left-3 w-4 h-1 rounded-full"
                      style={{ backgroundColor: tmpl.vars["--accent"] as string }}
                    />
                  </div>
                  <div className="p-3 flex-1" style={{ backgroundColor: tmpl.vars["--bg"] as string }}>
                    <p className="text-sm font-medium leading-tight" style={{ color: tmpl.vars["--text-primary"] as string }}>{tmpl.name}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: tmpl.vars["--text-secondary"] as string }}>{tmpl.tagline}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </SectionCard>

      {/* 6. Public & Social */}
      <SectionCard
        title={t("settings.sections.social.title")}
        description={t("settings.sections.social.desc")}
        icon={Share2}
        badge={t("settings.sections.identity.badge")}
      >
        <div className="space-y-2">
          <Label>{t("settings.fields.socialLinks")}</Label>
          {(form.socialLinks || []).map((link, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Badge variant="secondary" className="shrink-0 w-28 justify-center text-xs">{link.platform}</Badge>
              <Input value={link.url} readOnly className="flex-1 text-sm" />
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeSocialLink(idx)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <div className="flex items-end gap-2">
            <div className="w-36">
              <Select value={newSocialPlatform} onValueChange={setNewSocialPlatform}>
                <SelectTrigger className="h-9"><SelectValue placeholder={t("settings.fields.platform")} /></SelectTrigger>
                <SelectContent>
                  {SOCIAL_PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Input
              value={newSocialUrl}
              onChange={(e) => setNewSocialUrl(e.target.value)}
              placeholder={t("settings.fields.websitePlaceholder")}
              className="flex-1 h-9"
              onKeyDown={(e) => e.key === "Enter" && addSocialLink()}
            />
            <Button variant="outline" size="sm" onClick={addSocialLink} disabled={!newSocialPlatform || !newSocialUrl.trim()}>
              <Plus className="h-3.5 w-3.5 mr-1" /> {t("settings.fields.addLink")}
            </Button>
          </div>
        </div>
        <Separator />
        <Field label={t("settings.fields.guestContact")} id="s-gcontact" hint={t("settings.fields.guestContact")}>
          <Input id="s-gcontact" value={form.guestContactInfo || ""} onChange={(e) => u("guestContactInfo", e.target.value)} />
        </Field>
        <Field label={t("settings.fields.guestNotes")} id="s-gnotes" hint={t("settings.fields.guestNotes")}>
          <Textarea id="s-gnotes" value={form.guestNotes || ""} onChange={(e) => u("guestNotes", e.target.value)} rows={2} />
        </Field>
        <Field label={t("settings.fields.allergyDefaults")} id="s-allergy" hint={t("settings.fields.allergyDefaults")}>
          <Textarea id="s-allergy" value={form.allergyDefaults || ""} onChange={(e) => u("allergyDefaults", e.target.value)} rows={2} placeholder={t("settings.fields.allergyPlaceholder")} />
        </Field>
      </SectionCard>

      {/* 7. Billing Contact */}
      <SectionCard title={t("billing.title")} description={t("billing.title")} icon={CreditCard} badge={t("settings.sections.legal.badge")}>
        <Field label={t("settings.fields.billingContactPerson")} id="s-bname">
          <Input id="s-bname" value={form.billingContactName || ""} onChange={(e) => u("billingContactName", e.target.value)} />
        </Field>
        <Field label={t("settings.fields.email")} id="s-bemail" hint={t("settings.fields.invoicesHint")}>
          <Input id="s-bemail" type="email" value={form.billingEmail || ""} onChange={(e) => u("billingEmail", e.target.value)} />
        </Field>
        <Field label={t("settings.fields.invoicingNotes")} id="s-bnotes" hint={t("settings.fields.billingNotesHint")}>
          <Textarea id="s-bnotes" value={form.billingNotes || ""} onChange={(e) => u("billingNotes", e.target.value)} rows={2} placeholder={t("common.optional")} />
        </Field>
      </SectionCard>

      {/* Save bar */}
      {hasChanges && (
        <div className="sticky bottom-4 z-10">
          <Card className="border-primary/30 bg-primary/5 shadow-lg">
            <CardContent className="p-3 flex items-center justify-between">
              <p className="text-sm font-medium">{t("settings.fields.unsavedChanges")}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setForm({ ...baseline })}>{t("common.cancel")}</Button>
                <Button size="sm" onClick={save} disabled={isSaving}><Save className="h-3.5 w-3.5 mr-1" /> {isSaving ? t("settings.saving") : t("common.save")}</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

    </PageWrapper>
  );
}
