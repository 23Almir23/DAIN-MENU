/**
 * Onboarding — /setup
 *
 * Flow:
 *   name → choose → import → review → done
 *                          ↘ (manual) → done
 *
 * The "import" stage handles both file upload and pasted text via tabs.
 * Gemini parses the content server-side; the operator reviews before saving.
 *
 * API wiring:
 *   File upload  → POST /api/import/menu-upload  (multipart, via uploadMenuFile)
 *   Pasted text  → POST /api/import/menu-text    (JSON, via parseMenuText)
 *   Confirm      → POST /api/import/confirm
 */

import { useState, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useMenu } from "@/hooks/use-menu";
import { useRestaurant } from "@/hooks/use-restaurant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ReviewStage } from "@/components/ReviewStage";
import { uploadMenuFile, parseMenuText } from "@/services/import-service";
import type { UploadPhase } from "@/services/import-service";
import type { ParsedMenu, ParsedCategory, ParsedItem, ImportConfirmResult } from "@/types/import";
import {
  ChefHat, ArrowRight, Upload, FileText, Loader2,
  CheckCircle2, UtensilsCrossed, Eye, Sparkles,
  AlertTriangle, X, FileImage, Camera,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────

type Stage = "name" | "choose" | "import" | "review" | "done";
type ImportTab = "file" | "paste";

const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_FILE_BYTES = 18 * 1024 * 1024; // 18 MB (leaves room for base64 overhead)
const ACCEPTED_DISPLAY = "PDF, JPG, PNG, WEBP — up to 18 MB";

// ─── Helpers ─────────────────────────────────────────────────────────────────

type TFn = (key: string, opts?: Record<string, unknown>) => string;

function fileTypeError(file: File, t: TFn): string | null {
  // Detect iPhone HEIC/HEIF before the generic type check — these won't
  // show in ACCEPTED_TYPES and the server error would be confusing.
  const nameLower = file.name.toLowerCase();
  if (nameLower.endsWith(".heic") || nameLower.endsWith(".heif")) {
    return t("onboarding.errors.heic", { name: file.name });
  }
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return t("onboarding.errors.unsupportedFormat", { name: file.name });
  }
  if (file.size > MAX_FILE_BYTES) {
    return t("onboarding.errors.tooLarge", {
      name: file.name,
      sizeMb: (file.size / 1024 / 1024).toFixed(1),
    });
  }
  return null;
}

function geminiErrorMessage(err: unknown, t: TFn): string {
  const msg = err instanceof Error ? err.message : String(err);
  // Gemini key missing or invalid — matches server GeminiError messages for NO_KEY and INVALID_KEY
  if (
    msg.includes("not configured") ||
    msg.includes("key is invalid") ||
    msg.includes("API key") ||
    msg.includes("NO_KEY") ||
    msg.includes("INVALID_KEY")
  ) {
    return t("onboarding.errors.aiUnavailable");
  }
  // Quota / rate-limit — matches server GeminiError message for QUOTA
  if (msg.includes("quota") || msg.includes("QUOTA") || msg.includes("limit")) {
    return t("onboarding.errors.aiUnavailable");
  }
  // Network, connectivity, or timeout — treat the same as unavailable.
  // Covers browser-level errors ("Failed to fetch"), server unreachable, and timeouts.
  const lower = msg.toLowerCase();
  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("connect") ||
    lower.includes("network") ||
    lower.includes("timeout")
  ) {
    return t("onboarding.errors.aiUnavailable");
  }
  return msg || t("onboarding.errors.couldNotRead");
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Onboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { menuItems, isLoading: menuLoading } = useMenu();
  const { restaurant } = useRestaurant();
  const hasMenu = !menuLoading && menuItems.length > 0;

  const [stage, setStage] = useState<Stage>(
    () => searchParams.get("stage") === "choose" ? "choose" : "name"
  );
  const [restaurantName, setRestaurantName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);

  // Import stage state
  const [importTab, setImportTab] = useState<ImportTab>("file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [pastedText, setPastedText] = useState("");
  // File upload uses a phase-aware state; text parsing uses a simple boolean.
  const [filePhase, setFilePhase] = useState<"idle" | UploadPhase>("idle");
  const [uploadPercent, setUploadPercent] = useState(0);
  const [isParsing, setIsParsing] = useState(false); // text parse path
  const [parseError, setParseError] = useState<string | null>(null);

  // Review stage state
  const [parsedMenu, setParsedMenu] = useState<ParsedMenu | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // Done stage state
  const [importStats, setImportStats] = useState<ImportConfirmResult | null>(null);

  // ── Name stage ─────────────────────────────────────────────────────────────

  const handleNameContinue = async (name: string) => {
    setIsSavingName(true);
    try {
      const postRes = await fetch("/api/restaurant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name }),
      });
      if (postRes.status === 409) {
        const patchRes = await fetch("/api/restaurant", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ name }),
        });
        if (!patchRes.ok) {
          const err = await patchRes.json().catch(() => ({}));
          toast.error(t("onboarding.stages.name.errorSave") + (err.message ?? "Unknown error"));
          setIsSavingName(false);
          return;
        }
      } else if (postRes.status === 401) {
        window.location.href = "/api/login";
        return;
      } else if (!postRes.ok) {
        const err = await postRes.json().catch(() => ({}));
        toast.error(t("onboarding.stages.name.errorSave") + (err.message ?? "Unknown error"));
        setIsSavingName(false);
        return;
      }
    } catch {
      toast.error(t("onboarding.stages.name.errorNetwork"));
      setIsSavingName(false);
      return;
    }
    setRestaurantName(name);
    setIsSavingName(false);
    setStage("choose");
  };

  // ── Import stage ───────────────────────────────────────────────────────────

  const handleSelectFile = useCallback((file: File) => {
    setFileError(null);
    const err = fileTypeError(file, t as TFn);
    if (err) { setFileError(err); return; }
    setSelectedFile(file);
  }, [t]);

  /** File path: multipart POST to /api/import/menu-upload via uploadMenuFile() */
  const handleParseFile = async () => {
    if (!selectedFile) return;
    setFilePhase("uploading");
    setUploadPercent(0);
    setParseError(null);
    try {
      const result = await uploadMenuFile(selectedFile, (phase, pct) => {
        setFilePhase(phase);
        if (pct !== undefined) setUploadPercent(pct);
      });
      // Treat zero-item results as an error rather than sending to an empty review stage
      if (result.items.length === 0) {
        setParseError(
          result.partial
            ? t("onboarding.stages.import.noDishesFilePartial")
            : t("onboarding.stages.import.noDishesFile")
        );
        return;
      }
      setParsedMenu(result);
      setStage("review");
    } catch (err) {
      setParseError(geminiErrorMessage(err, t as TFn));
    } finally {
      setFilePhase("idle");
    }
  };

  /** Text path: JSON POST to /api/import/menu-text via parseMenuText() */
  const handleParseText = async () => {
    const text = pastedText.trim();
    if (!text) return;
    setIsParsing(true);
    setParseError(null);
    try {
      const result = await parseMenuText(text);
      if (result.items.length === 0) {
        setParseError(t("onboarding.stages.import.noDishesText"));
        return;
      }
      setParsedMenu(result);
      setStage("review");
    } catch (err) {
      setParseError(geminiErrorMessage(err, t as TFn));
    } finally {
      setIsParsing(false);
    }
  };

  // ── Review + confirm ───────────────────────────────────────────────────────

  const handleConfirmImport = async (categories: ParsedCategory[], items: ParsedItem[]) => {
    setIsConfirming(true);
    setConfirmError(null);
    try {
      const res = await fetch("/api/import/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ categories, items }),
      });
      const data = await res.json();
      if (!res.ok) {
        setConfirmError(data.message ?? t("onboarding.errors.saveFailed"));
        return;
      }
      setImportStats(data as ImportConfirmResult);
      // Invalidate menu cache so hasItems becomes true immediately
      // without requiring a page reload or manual navigation.
      await queryClient.invalidateQueries({ queryKey: ["/api/menu"] });
      setStage("done");
    } catch {
      setConfirmError(t("onboarding.errors.networkSave"));
    } finally {
      setIsConfirming(false);
    }
  };

  const goManual = () => {
    setImportStats(null);
    setStage("done");
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="border-b">
        <div className="max-w-2xl mx-auto px-6 h-14 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ChefHat className="h-4 w-4" />
          </div>
          <span className="font-bold text-sm">Dain Menu</span>
          {hasMenu && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto text-muted-foreground"
              onClick={() => navigate("/dashboard")}
            >
              {t("onboarding.skipToDashboard")} <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12">
        {stage === "name" && (
          <NameStage onContinue={handleNameContinue} isLoading={isSavingName} />
        )}
        {stage === "choose" && (
          <ChooseStage
            onImport={() => setStage("import")}
            onScan={() => navigate("/menu?action=scan")}
            onManual={goManual}
          />
        )}
        {stage === "import" && (
          (isParsing || filePhase !== "idle") ? (
            <ParsingOverlay
              fileName={importTab === "file" ? selectedFile?.name ?? null : null}
              filePhase={filePhase === "idle" ? "parsing" : filePhase}
              uploadPercent={uploadPercent}
            />
          ) : (
            <ImportStage
              importTab={importTab}
              onTabChange={setImportTab}
              selectedFile={selectedFile}
              onSelectFile={handleSelectFile}
              onClearFile={() => { setSelectedFile(null); setFileError(null); }}
              fileError={fileError}
              pastedText={pastedText}
              onPastedTextChange={setPastedText}
              onParseFile={handleParseFile}
              onParseText={handleParseText}
              isParsing={isParsing || filePhase !== "idle"}
              parseError={parseError}
              onBack={() => setStage("choose")}
              onSkip={goManual}
              onGoToMenuBuilder={() => navigate("/menu")}
            />
          )
        )}
        {stage === "review" && parsedMenu && (
          <ReviewStage
            parsedMenu={parsedMenu}
            onConfirm={handleConfirmImport}
            onBack={() => { setStage("import"); setParsedMenu(null); setParseError(null); }}
            onSkip={goManual}
            onGoToMenuBuilder={() => navigate("/menu")}
            isConfirming={isConfirming}
            confirmError={confirmError}
            existingItemCount={menuItems.length}
          />
        )}
        {stage === "done" && (
          <DoneStage
            importStats={importStats}
            restaurantName={restaurantName || restaurant?.name || ""}
            onGoToMenu={() => navigate("/menu")}
            onPreview={() => navigate("/preview")}
            onAIStudio={() => navigate("/ai-studio")}
          />
        )}
      </main>
    </div>
  );
}

// ─── Stage: Name ──────────────────────────────────────────────────────────────

function NameStage({
  onContinue,
  isLoading,
}: {
  onContinue: (name: string) => void;
  isLoading: boolean;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) { toast.error(t("onboarding.stages.name.errorEmpty")); return; }
    if (trimmed.length > 100) { toast.error(t("onboarding.stages.name.errorTooLong")); return; }
    onContinue(trimmed);
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-lg mx-auto">
      <div className="text-center">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
          <ChefHat className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{t("onboarding.stages.name.title")}</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {t("onboarding.stages.name.sub")}
        </p>
      </div>
      <div className="space-y-3">
        <Input
          data-testid="input-restaurant-name"
          placeholder={t("onboarding.stages.name.placeholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !isLoading && handleSubmit()}
          className="h-12 text-base"
          autoFocus
        />
        <Button
          data-testid="button-name-continue"
          size="lg"
          className="w-full h-12 text-base"
          onClick={handleSubmit}
          disabled={isLoading || !name.trim()}
        >
          {isLoading ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t("onboarding.stages.name.saving")}</>
          ) : (
            <>{t("onboarding.continue")} <ArrowRight className="h-4 w-4 ml-2" /></>
          )}
        </Button>
        <p className="text-xs text-center text-muted-foreground">
          {t("onboarding.stages.name.changeAnytime")}
        </p>
      </div>
    </div>
  );
}

// ─── Stage: Choose ────────────────────────────────────────────────────────────

function ChooseStage({
  onImport,
  onScan,
  onManual,
}: {
  onImport: () => void;
  onScan: () => void;
  onManual: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">{t("onboarding.stages.choose.title")}</h1>
        <p className="text-muted-foreground mt-2 max-w-lg mx-auto">
          {t("onboarding.stages.choose.sub")}
        </p>
      </div>

      {/* Primary import option */}
      <Card
        className="cursor-pointer border-2 border-primary/30 hover:border-primary/60 hover:shadow-lg transition-all group"
        onClick={onImport}
        data-testid="card-import-menu"
      >
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors shrink-0">
              <Upload className="h-7 w-7 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-lg">{t("onboarding.stages.choose.importTitle")}</h3>
                <Badge className="text-[10px]">{t("onboarding.stages.choose.recommended")}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {t("onboarding.stages.choose.importSub")}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-full">
              <FileText className="h-3 w-3" /> {t("onboarding.stages.import.pdfMenus")}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-full">
              <FileImage className="h-3 w-3" /> {t("onboarding.stages.import.menuPhotos")}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-full">
              <FileText className="h-3 w-3" /> {t("onboarding.stages.import.pastedText")}
            </div>
          </div>
          <div className="flex items-center gap-1 text-primary text-sm font-medium">
            {t("onboarding.stages.choose.importCta")} <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </CardContent>
      </Card>

      {/* Scan option */}
      <Card
        className="cursor-pointer border hover:border-primary/40 hover:shadow-md transition-all group"
        onClick={onScan}
        data-testid="card-scan-dishes"
      >
        <CardContent className="p-6 space-y-3">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center group-hover:bg-muted/80 transition-colors shrink-0">
              <Camera className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base">{t("onboarding.stages.choose.scanTitle")}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {t("onboarding.stages.choose.scanSub")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground text-sm">
            {t("onboarding.stages.choose.scanCta")} <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </CardContent>
      </Card>

      {/* Manual option */}
      <div className="text-center pt-2">
        <button
          data-testid="button-skip-to-manual"
          onClick={onManual}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {t("onboarding.stages.choose.manualCta")}
        </button>
      </div>
    </div>
  );
}

// ─── Parsing overlay ──────────────────────────────────────────────────────────
// Shown in place of ImportStage while the API call is in progress.
// Gated on the real API response — does not auto-advance.

function ParsingOverlay({
  fileName,
  filePhase,
  uploadPercent,
}: {
  fileName: string | null;
  filePhase?: UploadPhase;
  uploadPercent?: number;
}) {
  const { t } = useTranslation();
  const isUploading = filePhase === "uploading";
  const pct = uploadPercent ?? 0;

  return (
    <div
      className="flex flex-col items-center justify-center gap-8 py-20 animate-fade-in"
      data-testid="parsing-overlay"
    >
      <div className="relative">
        <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-9 w-9 text-primary animate-pulse" />
        </div>
        <Loader2 className="absolute -top-2 -right-2 h-6 w-6 text-primary/60 animate-spin" />
      </div>

      <div className="text-center space-y-2 w-full max-w-xs">
        <h2 className="text-xl font-semibold">
          {isUploading ? t("onboarding.stages.import.uploading") : t("onboarding.stages.import.scanning")}
        </h2>

        {fileName ? (
          isUploading ? (
            <p className="text-sm text-muted-foreground">
              {t("onboarding.stages.import.uploading")} <span className="font-medium text-foreground">{fileName}</span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("onboarding.stages.import.reading", { fileName })}
            </p>
          )
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("onboarding.stages.import.scanningText")}
          </p>
        )}

        {/* Upload progress bar — only shown during file upload phase */}
        {isUploading && fileName && (
          <div className="mt-3 space-y-1" data-testid="upload-progress">
            <div className="h-1.5 w-full rounded-full bg-primary/15 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-200"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-right">{pct}%</p>
          </div>
        )}

        {!isUploading && (
          <p className="text-xs text-muted-foreground">{t("onboarding.stages.import.timeEstimate")}</p>
        )}
      </div>
    </div>
  );
}

// ─── Stage: Import ────────────────────────────────────────────────────────────

function ImportStage({
  importTab,
  onTabChange,
  selectedFile,
  onSelectFile,
  onClearFile,
  fileError,
  pastedText,
  onPastedTextChange,
  onParseFile,
  onParseText,
  isParsing,
  parseError,
  onBack,
  onSkip,
  onGoToMenuBuilder,
}: {
  importTab: ImportTab;
  onTabChange: (t: ImportTab) => void;
  selectedFile: File | null;
  onSelectFile: (f: File) => void;
  onClearFile: () => void;
  fileError: string | null;
  pastedText: string;
  onPastedTextChange: (t: string) => void;
  onParseFile: () => void;
  onParseText: () => void;
  isParsing: boolean;
  parseError: string | null;
  onBack: () => void;
  onSkip: () => void;
  /** Navigate directly to MenuBuilder — used for parse-error escape CTAs. */
  onGoToMenuBuilder: () => void;
}) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) onSelectFile(file);
    },
    [onSelectFile]
  );

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  const canSubmitFile = selectedFile && !fileError && !isParsing;
  const canSubmitText = pastedText.trim().length > 20 && !isParsing;

  return (
    <div className="space-y-6 animate-fade-in max-w-xl mx-auto">
      <div>
        <button
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-foreground mb-4 flex items-center gap-1"
        >
          {t("onboarding.stages.import.back")}
        </button>
        <h2 className="text-2xl font-bold">{t("onboarding.stages.import.heading")}</h2>
        <p className="text-muted-foreground mt-1">
          {t("onboarding.stages.import.subheading")}
        </p>
      </div>

      <Tabs value={importTab} onValueChange={(v) => onTabChange(v as ImportTab)}>
        <TabsList className="w-full">
          <TabsTrigger value="file" className="flex-1" data-testid="tab-upload-file">
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            {t("onboarding.stages.import.tabFile")}
          </TabsTrigger>
          <TabsTrigger value="paste" className="flex-1" data-testid="tab-paste-text">
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            {t("onboarding.stages.import.tabPaste")}
          </TabsTrigger>
        </TabsList>

        {/* ── File upload tab ── */}
        <TabsContent value="file" className="space-y-4 mt-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onSelectFile(f); }}
            data-testid="input-file-upload"
          />

          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-2xl p-8 transition-colors cursor-pointer text-center ${
              isDragging
                ? "border-primary bg-primary/5"
                : selectedFile
                ? "border-primary/40 bg-primary/3"
                : "border-muted-foreground/25 hover:border-primary/50"
            }`}
            onClick={() => !selectedFile && fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            data-testid="dropzone"
          >
            {selectedFile ? (
              <div className="flex flex-col items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {(selectedFile.size / 1024 / 1024).toFixed(1)} MB · {t("onboarding.stages.import.readyToScan")}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); onClearFile(); }}
                  data-testid="button-clear-file"
                >
                  <X className="h-3 w-3 mr-1" /> {t("onboarding.stages.import.removeFile")}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-sm">{t("onboarding.stages.import.dropPrompt")}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t("onboarding.stages.import.dropAccepted")}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                >
                  {t("onboarding.stages.import.chooseFile")}
                </Button>
              </div>
            )}
          </div>

          {/* File type error */}
          {fileError && (
            <Alert variant="destructive" data-testid="file-error">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{fileError}</AlertDescription>
            </Alert>
          )}

          {/* What gets extracted + scan tips */}
          <Card className="bg-muted/40 border-0">
            <CardContent className="p-4 space-y-2">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{t("onboarding.stages.import.extractInfo")}</span>{" "}
                {t("onboarding.stages.import.extractDetail")}
              </p>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{t("onboarding.stages.import.bestResults")}</span>{" "}
                {t("onboarding.stages.import.bestResultsDetail")}
              </p>
            </CardContent>
          </Card>

          {/* Parse error */}
          {parseError && importTab === "file" && (
            <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                {parseError}
                <button
                  onClick={onGoToMenuBuilder}
                  className="block mt-1 underline underline-offset-2 text-xs"
                  data-testid="error-add-manually-file"
                >
                  {t("onboarding.stages.import.addManually")}
                </button>
              </AlertDescription>
            </Alert>
          )}

          <Button
            className="w-full"
            size="lg"
            disabled={!canSubmitFile}
            onClick={onParseFile}
            data-testid="button-parse-file"
          >
            {t("onboarding.stages.import.scanMenu")} <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </TabsContent>

        {/* ── Paste text tab ── */}
        <TabsContent value="paste" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Textarea
              data-testid="input-paste-text"
              placeholder={t("onboarding.stages.import.pastePrompt")}
              value={pastedText}
              onChange={(e) => onPastedTextChange(e.target.value)}
              rows={12}
              className="resize-none font-mono text-sm"
            />
            <div className="flex items-center justify-between">
              {pastedText.trim().length > 0 && pastedText.trim().length <= 20 ? (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {t("onboarding.stages.import.pasteMinLength")}
                </p>
              ) : (
                <span />
              )}
              <p className="text-xs text-muted-foreground text-right">
                {pastedText.length.toLocaleString()} {t("onboarding.stages.import.characters")}
              </p>
            </div>
          </div>

          <Card className="bg-muted/40 border-0">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{t("onboarding.stages.import.pasteWorksBestWith")}</span>{" "}
                {t("onboarding.stages.import.pasteWorksBestDetail")}
              </p>
            </CardContent>
          </Card>

          {/* Parse error */}
          {parseError && importTab === "paste" && (
            <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                {parseError}
                <button
                  onClick={onGoToMenuBuilder}
                  className="block mt-1 underline underline-offset-2 text-xs"
                  data-testid="error-add-manually-paste"
                >
                  {t("onboarding.stages.import.addManually")}
                </button>
              </AlertDescription>
            </Alert>
          )}

          <Button
            className="w-full"
            size="lg"
            disabled={!canSubmitText}
            onClick={onParseText}
            data-testid="button-parse-text"
          >
            {t("onboarding.stages.import.importMenu")} <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </TabsContent>
      </Tabs>

      <div className="text-center">
        <button
          onClick={onSkip}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          data-testid="button-skip-import"
        >
          {t("onboarding.stages.import.skipManual")}
        </button>
      </div>
    </div>
  );
}

// ─── Stage: Done ──────────────────────────────────────────────────────────────

function DoneStage({
  importStats,
  restaurantName,
  onGoToMenu,
  onPreview,
  onAIStudio,
}: {
  importStats: ImportConfirmResult | null;
  restaurantName: string;
  onGoToMenu: () => void;
  onPreview: () => void;
  onAIStudio: () => void;
}) {
  const { t } = useTranslation();
  const didImport = importStats && importStats.itemsCreated > 0;

  return (
    <div className="space-y-8 animate-fade-in max-w-lg mx-auto text-center">
      <div>
        <div
          className={`h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
            didImport ? "bg-primary/10" : "bg-muted"
          }`}
        >
          <CheckCircle2 className={`h-10 w-10 ${didImport ? "text-primary" : "text-muted-foreground"}`} />
        </div>

        {didImport ? (
          <>
            <h1 className="text-3xl font-bold tracking-tight">
              {t("onboarding.stages.done.importedDishes", { count: importStats!.itemsCreated })}
            </h1>
            <p className="text-muted-foreground mt-2">
              {t("onboarding.stages.done.importedAcross", { count: importStats!.categoriesCreated })}{" "}
              {restaurantName
                ? t("onboarding.stages.done.restaurantTakingShape", { name: restaurantName })
                : t("onboarding.stages.done.menuTakingShape")}
            </p>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold tracking-tight">
              {restaurantName
                ? t("onboarding.stages.done.readyToBuild", { name: restaurantName })
                : t("onboarding.stages.done.readyToBuildDefault")}
            </h1>
            <p className="text-muted-foreground mt-2">
              {t("onboarding.stages.done.readyToBuildSub")}
            </p>
          </>
        )}
      </div>

      {/* Next steps */}
      <div className="space-y-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider text-center">
          {t("onboarding.stages.done.whereToNext")}
        </p>

        {/* Primary CTA */}
        <Button
          size="lg"
          className="w-full h-12"
          onClick={onGoToMenu}
          data-testid="button-go-to-menu"
        >
          {didImport ? t("onboarding.stages.done.reviewAndImprove") : t("onboarding.stages.done.startBuilding")}
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
        <p className="text-xs text-muted-foreground text-center -mt-1">
          {didImport
            ? t("onboarding.stages.done.reviewCtaSub")
            : t("onboarding.stages.done.buildCtaSub")}
        </p>

        {/* Secondary links */}
        <div className="flex flex-col gap-2 pt-1">
          <button
            onClick={onAIStudio}
            data-testid="button-go-to-ai-studio"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5" /> {t("onboarding.stages.done.enhanceWithAI")}
          </button>
          <button
            onClick={onPreview}
            data-testid="button-go-to-preview"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1.5"
          >
            <Eye className="h-3.5 w-3.5" /> {t("onboarding.stages.done.previewGuestView")}
          </button>
        </div>
      </div>
    </div>
  );
}
