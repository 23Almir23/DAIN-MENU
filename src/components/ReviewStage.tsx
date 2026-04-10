/**
 * ReviewStage — human-in-the-loop review step before import confirm.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle, Trash2, CheckCircle2, ArrowLeft, Loader2,
  UtensilsCrossed, Info, FileX,
} from "lucide-react";
import type { ParsedMenu, ParsedItem, ParsedCategory } from "@/types/import";
import { useTranslation } from "react-i18next";

interface ReviewStageProps {
  parsedMenu: ParsedMenu;
  onConfirm: (categories: ParsedCategory[], items: ParsedItem[]) => void;
  onBack: () => void;
  onSkip: () => void;
  onGoToMenuBuilder: () => void;
  isConfirming: boolean;
  confirmError: string | null;
  existingItemCount?: number;
}

export function ReviewStage({
  parsedMenu,
  onConfirm,
  onBack,
  onSkip,
  onGoToMenuBuilder,
  isConfirming,
  confirmError,
  existingItemCount,
}: ReviewStageProps) {
  const { t } = useTranslation();
  const [items, setItems] = useState<ParsedItem[]>(parsedMenu.items);

  const extractionFoundNothing = parsedMenu.items.length === 0;

  const deleteItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, patch: Partial<ParsedItem>) => {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
  };

  const usedCategoryNames = new Set(items.map((i) => i.categoryName));
  const activeCategories = parsedMenu.categories.filter((c) => usedCategoryNames.has(c.name));

  const knownCatNames = new Set(parsedMenu.categories.map((c) => c.name));
  const uncategorisedItems = items.filter((i) => !knownCatNames.has(i.categoryName));
  if (uncategorisedItems.length > 0 && !activeCategories.find((c) => c.name === "Uncategorized")) {
    activeCategories.push({ name: "Uncategorized" });
  }

  const uncertainItems = items.filter((i) => i.confidence !== "high" || i.warnings.length > 0);
  const hasEmptyName = items.some((i) => !i.name.trim());

  const handleConfirm = () => {
    if (hasEmptyName) return;
    onConfirm(activeCategories, items);
  };

  if (extractionFoundNothing) {
    return (
      <div className="space-y-6 animate-fade-in max-w-2xl mx-auto text-center" data-testid="empty-extraction-state">
        <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
          <FileX className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">{t("review.couldNotRead")}</h2>
          <p className="text-muted-foreground mt-2 max-w-sm mx-auto">{t("review.couldNotReadDesc")}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="outline" onClick={onBack} data-testid="button-back-from-empty-extraction">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("review.tryDifferentFile")}
          </Button>
          <Button onClick={onGoToMenuBuilder} data-testid="button-add-manually-from-empty-extraction">
            <UtensilsCrossed className="h-4 w-4 mr-2" />
            {t("review.addManually")}
          </Button>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in max-w-2xl mx-auto text-center" data-testid="all-items-deleted-state">
        <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
          <UtensilsCrossed className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">{t("review.noDishesLeft")}</h2>
          <p className="text-muted-foreground mt-1">{t("review.noDishesLeftDesc")}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="outline" onClick={onBack} data-testid="button-back-from-all-deleted">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("review.goBack")}
          </Button>
          <Button onClick={onSkip} data-testid="button-add-manually-from-all-deleted">
            {t("review.addManually")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
      <div>
        <button
          onClick={onBack}
          disabled={isConfirming}
          className="text-sm text-muted-foreground hover:text-foreground mb-4 flex items-center gap-1 disabled:opacity-40 disabled:pointer-events-none"
          data-testid="button-back-from-review"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {t("review.back")}
        </button>
        <h2 className="text-2xl font-bold">{t("review.reviewBeforeImport")}</h2>
        <p className="text-muted-foreground mt-1">
          {t("review.reviewBeforeImportDesc")}{" "}
          {uncertainItems.length > 0
            ? t("review.itemsNeedAttention", { count: uncertainItems.length })
            : t("review.everythingLooksGood")}
        </p>
      </div>

      {existingItemCount != null && existingItemCount > 0 && (
        <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800" data-testid="additive-import-notice">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-blue-800 dark:text-blue-300 text-sm">
            {t("review.willBeAdded", { count: existingItemCount })}
          </AlertDescription>
        </Alert>
      )}

      {parsedMenu.partial && (
        <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800" data-testid="partial-extraction-notice">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
            {t("review.foundButMissed", { count: parsedMenu.items.length })}
          </AlertDescription>
        </Alert>
      )}
      {parsedMenu.warnings.filter(Boolean).map((w, i) => (
        <Alert key={i} className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
          <Info className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">{w}</AlertDescription>
        </Alert>
      ))}

      <Card className="bg-muted/40 border-0">
        <CardContent className="p-4">
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              {t("review.reviewBeforeImportDesc")}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        {activeCategories.map((cat) => {
          const catItems = items
            .map((item, idx) => ({ item, idx }))
            .filter(({ item }) => {
              if (cat.name === "Uncategorized") return !knownCatNames.has(item.categoryName);
              return item.categoryName === cat.name;
            });

          if (catItems.length === 0) return null;

          return (
            <div key={cat.name}>
              <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-2 px-1">
                {cat.name}
              </h3>
              <div className="space-y-2">
                {catItems.map(({ item, idx }) => {
                  const needsReview = item.confidence !== "high" || item.warnings.length > 0;
                  return (
                    <div
                      key={idx}
                      data-testid={`review-item-${idx}`}
                      className={`rounded-xl border p-3 transition-colors ${
                        needsReview
                          ? "border-amber-200 bg-amber-50/60 dark:bg-amber-950/10 dark:border-amber-800/50"
                          : "border-border bg-card"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="shrink-0 mt-2.5">
                          {needsReview ? (
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Input
                              data-testid={`edit-item-name-${idx}`}
                              value={item.name}
                              onChange={(e) => updateItem(idx, { name: e.target.value })}
                              className="h-7 px-2 text-sm font-medium border-transparent bg-transparent hover:border-input focus:border-input focus:bg-background transition-colors flex-1 min-w-0"
                              placeholder={t("review.dishNamePlaceholder")}
                            />
                            {needsReview ? (
                              <Badge variant="outline" className="shrink-0 text-[10px] border-amber-300 text-amber-700 dark:text-amber-400">
                                {t("review.pleaseReview")}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="shrink-0 text-[10px] border-primary/30 text-primary">
                                {t("review.looksGood")}
                              </Badge>
                            )}
                          </div>
                          <Textarea
                            data-testid={`edit-item-description-${idx}`}
                            value={item.description}
                            onChange={(e) => updateItem(idx, { description: e.target.value })}
                            rows={2}
                            className="px-2 py-1 text-xs text-muted-foreground border-transparent bg-transparent hover:border-input focus:border-input focus:bg-background transition-colors resize-none leading-relaxed"
                            placeholder={t("review.descriptionPlaceholder")}
                          />
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1">
                              <span className="text-sm text-muted-foreground">$</span>
                              <Input
                                data-testid={`edit-item-price-${idx}`}
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.price > 0 ? item.price : ""}
                                onChange={(e) =>
                                  updateItem(idx, { price: parseFloat(e.target.value) || 0 })
                                }
                                className="h-7 w-24 px-2 text-sm font-medium border-transparent bg-transparent hover:border-input focus:border-input focus:bg-background transition-colors"
                                placeholder={t("review.pricePlaceholder")}
                              />
                            </div>
                            {item.price === 0 && (
                              <span className="text-xs text-amber-600 dark:text-amber-400">
                                {t("review.setPriceBefore")}
                              </span>
                            )}
                            {item.warnings.filter((w) => w !== "price not shown").map((w, wi) => (
                              <span key={wi} className="text-xs text-amber-600 dark:text-amber-400">{w}</span>
                            ))}
                          </div>
                        </div>
                        <button
                          data-testid={`delete-review-item-${idx}`}
                          onClick={() => deleteItem(idx)}
                          className="shrink-0 h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors mt-1"
                          title={t("review.removeFromImport")}
                          aria-label={`Remove ${item.name} from import`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {confirmError && (
        <Alert variant="destructive" data-testid="confirm-error-alert">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{confirmError}</AlertDescription>
        </Alert>
      )}

      {hasEmptyName && (
        <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800" data-testid="empty-name-alert">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            {t("review.emptyNames")}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t">
        <button
          onClick={() => {
            if (window.confirm(t("review.discardAll"))) {
              onSkip();
            }
          }}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          data-testid="skip-to-manual"
        >
          {t("review.addManually")}
        </button>
        <Button
          onClick={handleConfirm}
          disabled={isConfirming || items.length === 0 || hasEmptyName}
          size="lg"
          className="w-full sm:w-auto"
          data-testid="button-confirm-import"
        >
          {isConfirming ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t("review.saving")}</>
          ) : (
            <>{t("review.importDishes", { count: items.length })}</>
          )}
        </Button>
      </div>
    </div>
  );
}
