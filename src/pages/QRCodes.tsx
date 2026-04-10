import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import { useMenuStats } from "@/hooks/use-menu-stats";
import { useMenu } from "@/hooks/use-menu";
import { useRestaurant } from "@/hooks/use-restaurant";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Download, QrCode, Copy, ExternalLink, Eye, UtensilsCrossed,
  CheckCircle2, AlertTriangle, Smartphone, Printer, CreditCard,
  ArrowRight, Sparkles, Globe,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { PageWrapper } from "@/components/PageWrapper";
import { PageHeader } from "@/components/PageHeader";

/** Convert a restaurant name into a safe filename slug. */
function toSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "menuai-qr";
}

export default function QRCodes() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const stats = useMenuStats();
  const { isLoading } = useMenu();
  const { restaurant } = useRestaurant();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);

  const guestUrl = restaurant?.id
    ? `${window.location.origin}/guest?r=${restaurant.id}`
    : "";
  const menuReady = !isLoading && stats.availableItems >= 3 && stats.totalCategories >= 1;
  const hasIssues = !isLoading && stats.unavailableItems > 0;

  const copyLink = async () => {
    if (!guestUrl) return;
    try {
      await navigator.clipboard.writeText(guestUrl);
      toast.success(t("qr.toasts.linkCopied"));
    } catch {
      toast.error(t("qr.toasts.linkCopied"));
    }
  };

  const slug = toSlug(restaurant?.name ?? "");
  const fileBase = slug !== "menuai-qr" ? `menuai-qr-${slug}` : "menuai-qr";

  const handleDownloadPng = () => {
    if (!guestUrl) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${fileBase}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success(t("qr.toasts.qrDownloaded"));
  };

  const handleDownloadSvg = () => {
    if (!guestUrl) return;
    const container = svgContainerRef.current;
    const svgEl = container?.querySelector("svg");
    if (!svgEl) return;
    const serializer = new XMLSerializer();
    let svgStr = serializer.serializeToString(svgEl);
    if (!svgStr.includes('xmlns="http://www.w3.org/2000/svg"')) {
      svgStr = svgStr.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    const blob = new Blob(
      ['<?xml version="1.0" encoding="UTF-8"?>\n', svgStr],
      { type: "image/svg+xml" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileBase}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(t("qr.toasts.qrDownloaded"));
  };

  const handlePrint = () => window.print();

  const placementTips = [
    { icon: CreditCard, titleKey: "qr.tableTents", descKey: "qr.tableTentDesc" },
    { icon: Printer, titleKey: "qr.receiptsFlyers", descKey: "qr.receiptsFlyersDesc" },
    { icon: Smartphone, titleKey: "qr.windowDoor", descKey: "qr.windowDoorDesc" },
  ];

  return (
    <>
      {/* Print-only output — hidden on screen, visible only during print */}
      {guestUrl && (
        <div className="hidden print:flex print:flex-col print:items-center print:justify-center print:min-h-screen print:gap-8 print:p-16 print:bg-white" data-testid="qr-print-target">
          <p className="print:text-3xl print:font-bold print:text-black print:tracking-tight">
            {restaurant?.name ?? ""}
          </p>
          <QRCodeSVG value={guestUrl} size={300} bgColor="#ffffff" fgColor="#000000" />
          <p className="print:text-sm print:text-gray-500 print:font-mono print:break-all print:text-center print:max-w-sm">
            {guestUrl}
          </p>
        </div>
      )}

    {/* Screen-only content */}
    <div className="print:hidden">
    <PageWrapper maxWidth="lg">
      <PageHeader
        title={t("qr.title")}
        icon={QrCode}
        description={t("qr.title")}
      />

      {/* Menu readiness banner */}
      <Card className={menuReady ? "border-primary/20 bg-primary/[0.03]" : "border-destructive/20 bg-destructive/[0.03]"}>
        <CardContent className="p-5 flex items-start gap-4">
          {menuReady ? (
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-4 w-4 text-primary" />
            </div>
          ) : (
            <div className="h-9 w-9 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-sans-heading text-sm">
              {menuReady ? t("qr.menuReady") : t("qr.menuNeedsItems")}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              {menuReady
                ? t("qr.itemsLive", { count: stats.availableItems, cats: stats.totalCategories })
                : t("qr.addMoreItems", { count: stats.availableItems })}
            </p>
            {hasIssues && menuReady && (
              <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {t("qr.unavailableItems", { count: stats.unavailableItems })}
              </p>
            )}
          </div>
          {!menuReady && (
            <Button size="sm" variant="outline" onClick={() => navigate("/menu")}>
              <UtensilsCrossed className="h-3.5 w-3.5 mr-1" /> {t("qr.actions.editMenu")}
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* QR Code — left column */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-sans-heading">{t("qr.qrCode")}</CardTitle>
              <CardDescription>
                {restaurant?.name ?? ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Visible QR code (SVG) — ref'd for SVG download */}
              <div ref={svgContainerRef} className="border rounded-2xl p-6 bg-card flex items-center justify-center">
                {guestUrl ? (
                  <QRCodeSVG value={guestUrl} size={220} />
                ) : (
                  <div className="w-[220px] h-[220px] rounded-xl bg-muted/40 animate-pulse" />
                )}
              </div>

              {/* Hidden high-resolution canvas for PNG download */}
              {guestUrl && (
                <div style={{ display: "none" }}>
                  <QRCodeCanvas
                    ref={canvasRef}
                    value={guestUrl}
                    size={512}
                    bgColor="#ffffff"
                    fgColor="#000000"
                  />
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <Button
                  onClick={handleDownloadPng}
                  disabled={!guestUrl}
                  data-testid="button-download-png"
                >
                  <Download className="h-4 w-4 mr-1" /> {t("qr.actions.png")}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDownloadSvg}
                  disabled={!guestUrl}
                  data-testid="button-download-svg"
                >
                  <Download className="h-4 w-4 mr-1" /> {t("qr.actions.svg")}
                </Button>
                <Button
                  variant="outline"
                  onClick={handlePrint}
                  disabled={!guestUrl}
                  data-testid="button-print-qr"
                >
                  <Printer className="h-4 w-4 mr-1" /> {t("qr.actions.print")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="lg:col-span-3 space-y-4">
          {/* Guest link */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-sans-heading">{t("qr.guestMenuLink")}</CardTitle>
              <CardDescription>{t("qr.guestMenuLink")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-xl border">
                <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                <code className="text-sm flex-1 truncate font-mono">{guestUrl || t("common.loading")}</code>
                <Button variant="ghost" size="sm" className="h-8 px-2" onClick={copyLink} disabled={!guestUrl}>
                  <Copy className="h-3.5 w-3.5 mr-1" /> {t("qr.actions.copy")}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={() => window.open(guestUrl, "_blank")} disabled={!guestUrl}>
                  <ExternalLink className="h-4 w-4 mr-1" /> {t("qr.actions.openAsGuest")}
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate("/preview")}>
                  <Eye className="h-4 w-4 mr-1" /> {t("qr.actions.adminPreview")}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* What guests see */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-sans-heading">{t("qr.whatGuestsSee")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: t("qr.statItems"), value: isLoading ? "—" : stats.availableItems, sub: isLoading ? "" : t("qr.statOf", { total: stats.totalItems }) },
                  { label: t("qr.statCategories"), value: isLoading ? "—" : stats.totalCategories },
                  { label: t("qr.statLanguages"), value: isLoading ? "—" : (stats.languageCount + 1) },
                ].map((s) => (
                  <div key={s.label} className="text-center p-3 bg-muted/40 rounded-xl">
                    <div className="text-xl font-serif">{s.value}</div>
                    <div className="text-[11px] text-muted-foreground">{s.label}</div>
                    {s.sub && <div className="text-[10px] text-muted-foreground">{s.sub}</div>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Placement ideas */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-sans-heading">{t("qr.whereToPut")}</CardTitle>
              <CardDescription>{t("qr.whereToPut")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { icon: CreditCard, title: t("qr.tableTents"), desc: t("qr.tableTentDesc") },
                  { icon: Printer, title: t("qr.receiptsFlyers"), desc: t("qr.receiptsFlyersDesc") },
                  { icon: Smartphone, title: t("qr.windowDoor"), desc: t("qr.windowDoorDesc") },
                ].map((tip) => (
                  <div key={tip.title} className="flex gap-3 p-3.5 rounded-xl border bg-muted/20">
                    <div className="h-9 w-9 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                      <tip.icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-sans-heading">{tip.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{tip.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom CTAs */}
      <Separator />
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {t("qr.bottomCtaText")}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/menu")}>
            <UtensilsCrossed className="h-4 w-4 mr-1" /> {t("qr.actions.menuBuilder")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/ai-studio")}>
            <Sparkles className="h-4 w-4 mr-1" /> {t("qr.actions.aiStudio")}
          </Button>
          <Button size="sm" onClick={() => navigate("/preview")}>
            <Eye className="h-4 w-4 mr-1" /> {t("sidebar.guestPreview")} <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
      </div>
    </PageWrapper>
    </div>
    </>
  );
}
