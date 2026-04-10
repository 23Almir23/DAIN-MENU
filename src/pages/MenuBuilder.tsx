/**
 * MenuBuilder — Phase 1.4
 *
 * READS from: GET /api/menu (via useMenu hook)
 * WRITES to:  API mutations → invalidateQueries → re-fetch
 */

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useLocation } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRestaurant } from "@/hooks/use-restaurant";
import { useMenu } from "@/hooks/use-menu";
import { useBilling } from "@/hooks/use-billing";
import type { MenuItem, MenuCategory } from "@/types/menu";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Plus, Pencil, Trash2, Star, FolderPlus, Search, UtensilsCrossed,
  QrCode, MoreHorizontal, Copy, X, Flame, Globe, Lock,
  AlertCircle, Sparkles, GripVertical, Check, CheckCircle2, Camera, Upload, ArrowRight, Ban, Printer,
} from "lucide-react";
import { PrintMenuView } from "@/components/PrintMenuView";
import { toast } from "sonner";
import { CopilotStrip } from "@/components/CopilotStrip";
import { MenuPreviewPanel } from "@/components/MenuPreviewPanel";
import { WorkspaceEnhanceSection } from "@/components/WorkspaceEnhanceSection";
import { formatPrice, sortCategories } from "@/lib/menu-utils";
import { ALLERGEN_OPTIONS, ALLERGEN_ICONS } from "@/data/allergens";
import {
  DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ── Sortable wrapper for category rows ────────────────────────────────────────

function SortableCategoryRow({ id, disabled, children }: {
  id: string;
  disabled: boolean;
  children: (
    handleRef: (el: HTMLElement | null) => void,
    handleListeners: Record<string, unknown> | undefined,
  ) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition } = useSortable({ id, disabled });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="space-y-3"
      {...attributes}
    >
      {children(setActivatorNodeRef, listeners)}
    </div>
  );
}

type DeleteTarget = { type: "item"; id: string; name: string } | { type: "category"; id: string; name: string; itemCount: number };

const ITEM_NAME_MAX = 80;
const ITEM_DESC_MAX = 300;

// ── Shared fetch helpers ──────────────────────────────────────────────────────

async function apiFetch(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.message ?? `Request failed (${res.status})`);
  }
  return res.json();
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MenuBuilder() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { restaurant } = useRestaurant();
  const { plan } = useBilling();
  const queryClient = useQueryClient();

  // ── API data (primary source) ──────────────────────────────────────────────
  const { categories: apiCategories, menuItems: apiMenuItems, isLoading: isMenuLoading } = useMenu();

  // Invalidate shared menu cache after any mutation
  const invalidateMenu = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["/api/menu"] }),
    [queryClient]
  );

  // ── UI state ───────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [filterNeedsReview, setFilterNeedsReview] = useState(false);
  // Track in-session CopilotStrip dismissal for recovery ghost.
  // Initialize from sessionStorage so the ghost persists across same-session
  // route changes (sessionStorage resets on page reload, so fresh loads start clean).
  const [stripDismissed, setStripDismissed] = useState(() => {
    try {
      const stored = sessionStorage.getItem("copilot_strip_dismissed");
      return stored ? (JSON.parse(stored) as string[]).length > 0 : false;
    } catch {
      return false;
    }
  });
  const [stripKey, setStripKey] = useState(0);

  // Bidirectional sync with ?filter=needsReview deep-link from Copilot panel.
  // Also handles ?action=scan deep-link from Dashboard "Scan a dish photo" entry.
  // Reactive to location.search: activates filter on arrival and clears it
  // when the user navigates away from /menu?filter=needsReview.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setFilterNeedsReview(params.get("filter") === "needsReview");
    if (params.get("action") === "scan") {
      // Store the intent; a separate data-aware useEffect resolves it once
      // categories are loaded so we can branch before touching the file picker.
      setPendingScanIntent(true);
    }
    // W1: workspace intent routing — ?intent=rewrite|translate|allergens|calories
    const intent = params.get("intent");
    if (intent) {
      setEnhanceOpen(true);
      setEnhanceIntent(intent);
      setEnhanceLang(params.get("lang"));
    }
  }, [location.search]);

  // ── Category drag-to-reorder state ─────────────────────────────────────────
  const [categoryOrder, setCategoryOrder] = useState<string[]>(() =>
    sortCategories(apiCategories).map((c) => c.id)
  );
  const [isReordering, setIsReordering] = useState(false);
  const isDragging = useRef(false);

  // Re-seed from server when not dragging or saving
  useEffect(() => {
    if (!isDragging.current && !isReordering) {
      setCategoryOrder(sortCategories(apiCategories).map((c) => c.id));
    }
  }, [apiCategories, isReordering]);

  const [itemDialog, setItemDialog] = useState(false);
  const [categoryDialog, setCategoryDialog] = useState(false);
  const [editCategoryDialog, setEditCategoryDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editingCategory, setEditingCategory] = useState<{ id: string; name: string } | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [pendingScanAfterCategory, setPendingScanAfterCategory] = useState(false);
  // Set to true when ?action=scan arrives; resolved in a data-aware useEffect below
  const [pendingScanIntent, setPendingScanIntent] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  // Resolve the scan intent only after category data is loaded.
  // Branching before touching the file picker makes the Dashboard "Scan a Dish"
  // entry trustworthy in both the zero-category and has-categories cases.
  useEffect(() => {
    if (!pendingScanIntent || isMenuLoading) return;
    setPendingScanIntent(false);
    if (apiCategories.length === 0) {
      // No categories yet: walk the operator through category creation first,
      // then the existing pendingScanAfterCategory mechanism fires the picker.
      setPendingScanAfterCategory(true);
      setCategoryDialog(true);
    } else {
      // Has categories: open the file picker directly.
      setTimeout(() => photoInputRef.current?.click(), 100);
    }
  }, [pendingScanIntent, isMenuLoading, apiCategories]);

  // ── Add-from-photo state ───────────────────────────────────────────────────
  const [photoScanning, setPhotoScanning] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Quick-confirm dialog state — opens after a successful Scan Dish parse
  const [quickConfirmDraft, setQuickConfirmDraft] = useState<{ name: string; description: string } | null>(null);

  // Smart category default: prefer a category named "special" / "daily"; fall back to first
  const smartDefaultCategoryId = useMemo(() => {
    const special = apiCategories.find((c) => /special|daily/i.test(c.name));
    return (special ?? apiCategories[0])?.id ?? "";
  }, [apiCategories]);

  const [form, setForm] = useState({
    name: "", description: "", price: "", categoryId: "",
    allergens: [] as string[], calories: "", isAvailable: true, isPopular: false,
    isSpecial: false, soldOut: false,
    image: "" as string | undefined,
  });

  // ── Derived data ───────────────────────────────────────────────────────────

  const filteredItems = useMemo(() => {
    const q = search.toLowerCase();
    return apiMenuItems.filter((item) => {
      const matchesSearch = !q || item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q) || item.allergens.some((a) => a.includes(q));
      const matchesCategory = selectedCategory === "all" || item.categoryId === selectedCategory;
      const matchesReview = !filterNeedsReview || item.needsReview;
      return matchesSearch && matchesCategory && matchesReview;
    });
  }, [apiMenuItems, search, selectedCategory, filterNeedsReview]);

  // Categories in drag order (falls back to server sort order when not dragging)
  const orderedCategories = useMemo(() => {
    const catMap = new Map(apiCategories.map((c) => [c.id, c]));
    return categoryOrder.flatMap((id) => { const c = catMap.get(id); return c ? [c] : []; });
  }, [apiCategories, categoryOrder]);

  const groupedByCategory = useMemo(() => {
    return orderedCategories
      .map((cat) => ({ ...cat, items: filteredItems.filter((i) => i.categoryId === cat.id) }))
      .filter((g) => selectedCategory === "all" ? true : g.id === selectedCategory);
  }, [orderedCategories, filteredItems, selectedCategory]);

  // Inline stats derived directly from API data so they update in the same render as the list
  const stats = useMemo(() => {
    const total = apiMenuItems.length;
    const available = apiMenuItems.filter((i) => i.isAvailable).length;
    const langCount = total ? Math.max(0, ...apiMenuItems.map((i) => Object.keys(i.translations || {}).length)) : 0;
    return {
      totalItems: total,
      totalCategories: apiCategories.length,
      availableItems: available,
      unavailableItems: total - available,
      specialItems: apiMenuItems.filter((i) => i.isSpecial && i.isAvailable && !i.soldOut).length,
      soldOutItems: apiMenuItems.filter((i) => i.soldOut && i.isAvailable).length,
      withAllergens: apiMenuItems.filter((i) => i.allergens.length > 0).length,
      languageCount: langCount,
      needsReviewItems: apiMenuItems.filter((i) => i.needsReview).length,
    };
  }, [apiMenuItems, apiCategories]);

  const hasSearchResults = filteredItems.length > 0;
  const isSearching = search.length > 0;
  const isEmpty = apiMenuItems.length === 0 && apiCategories.length === 0;

  // Review complete transient message state — shown briefly when all AI changes are approved
  const [reviewCompleteMsg, setReviewCompleteMsg] = useState(false);

  // W3: Review mode auto-exit — when all items have been approved (needsReviewItems → 0),
  // clear the review filter and show a brief success message.
  useEffect(() => {
    if (filterNeedsReview && stats.needsReviewItems === 0 && !isMenuLoading) {
      setFilterNeedsReview(false);
      setReviewCompleteMsg(true);
      const t = setTimeout(() => setReviewCompleteMsg(false), 4000);
      return () => clearTimeout(t);
    }
  }, [filterNeedsReview, stats.needsReviewItems, isMenuLoading]);

  // Cleanup: cancel any pending preview badge timer on unmount to avoid stale state updates.
  useEffect(() => {
    return () => {
      if (previewBadgeTimerRef.current) clearTimeout(previewBadgeTimerRef.current);
    };
  }, []);

  // First-item success prompt — fires only within the session immediately after the first item is added.
  // Uses a session-only state (no localStorage) so it won't surface for operators who already have items.
  const [showFirstItemPrompt, setShowFirstItemPrompt] = useState(false);
  const [enhanceOpen, setEnhanceOpen] = useState(false);
  const [enhanceIntent, setEnhanceIntent] = useState<string | null>(null);
  const [enhanceLang, setEnhanceLang] = useState<string | null>(null);
  // Improve mode: dock is open AND an action is active — suppress CopilotStrip noise
  const [isImproveMode, setIsImproveMode] = useState(false);
  // Preview updated badge — shows for 8s after a successful AI run
  const [previewUpdatedAt, setPreviewUpdatedAt] = useState<number | null>(null);
  const previewBadgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const addCatMutation = useMutation({
    mutationFn: (name: string) => apiFetch("/api/categories", "POST", { name }),
    onSuccess: invalidateMenu,
    onError: (e: Error) => toast.error(e.message),
  });

  const updateCatMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => apiFetch(`/api/categories/${id}`, "PATCH", { name }),
    onSuccess: invalidateMenu,
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteCatMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/categories/${id}`, "DELETE"),
    onSuccess: invalidateMenu,
    onError: (e: Error) => toast.error(e.message),
  });

  const addItemMutation = useMutation({
    mutationFn: (data: unknown) => apiFetch("/api/items", "POST", data),
    onSuccess: invalidateMenu,
    onError: (e: Error) => toast.error(e.message),
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => apiFetch(`/api/items/${id}`, "PATCH", data),
    onSuccess: invalidateMenu,
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/items/${id}`, "DELETE"),
    onSuccess: invalidateMenu,
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicateItemMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/items/${id}/duplicate`, "POST"),
    onSuccess: invalidateMenu,
    onError: (e: Error) => toast.error(e.message),
  });

  const markReviewedMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/items/${id}/reviewed`, "POST"),
    onSuccess: invalidateMenu,
    onError: (e: Error) => toast.error(e.message),
  });

  const markAllReviewedMutation = useMutation({
    mutationFn: () => apiFetch("/api/items/reviewed", "POST"),
    onSuccess: () => { invalidateMenu(); toast.success(t("menuBuilder.toasts.allReviewed")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const isSavingItem = addItemMutation.isPending || updateItemMutation.isPending;

  // ── Drag-to-reorder ────────────────────────────────────────────────────────

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = useCallback(async ({ active, over }: DragEndEvent) => {
    isDragging.current = false;
    if (!over || active.id === over.id) return;
    const oldIndex = categoryOrder.indexOf(active.id as string);
    const newIndex = categoryOrder.indexOf(over.id as string);
    const newOrder = arrayMove(categoryOrder, oldIndex, newIndex);
    setCategoryOrder(newOrder);
    setIsReordering(true);
    const results = await Promise.allSettled(
      newOrder.map((id, index) => apiFetch(`/api/categories/${id}`, "PATCH", { order: index }))
    );
    const failCount = results.filter((r) => r.status === "rejected").length;
    if (failCount > 0) {
      toast.error(t("menuBuilder.toasts.reorderFailed", { count: failCount }));
    }
    await invalidateMenu();
    setIsReordering(false);
  }, [categoryOrder, invalidateMenu, t]);

  // ── Form helpers ───────────────────────────────────────────────────────────

  const resetForm = (categoryId?: string) => ({
    name: "", description: "", price: "", categoryId: categoryId || apiCategories[0]?.id || "",
    allergens: [] as string[], calories: "", isAvailable: true, isPopular: false,
    isSpecial: false, soldOut: false,
    image: undefined as string | undefined,
  });

  const openNewItem = (categoryId?: string) => {
    setEditingItem(null);
    setForm(resetForm(categoryId));
    setItemDialog(true);
  };

  const openEditItem = (item: MenuItem) => {
    setEditingItem(item);
    setForm({
      name: item.name, description: item.description, price: item.price.toString(),
      categoryId: item.categoryId, allergens: [...item.allergens],
      calories: item.calories?.toString() || "", isAvailable: item.isAvailable, isPopular: item.isPopular,
      isSpecial: item.isSpecial, soldOut: item.soldOut,
      image: item.image,
    });
    setItemDialog(true);
  };

  const validateForm = (): boolean => {
    if (!form.name.trim()) { toast.error(t("menuBuilder.toasts.nameRequired")); return false; }
    if (form.name.trim().length > ITEM_NAME_MAX) { toast.error(t("menuBuilder.toasts.nameTooLong", { max: ITEM_NAME_MAX })); return false; }
    if (!form.price || parseFloat(form.price) <= 0) { toast.error(t("menuBuilder.toasts.validPrice")); return false; }
    if (!form.categoryId) { toast.error(t("menuBuilder.toasts.selectCategory")); return false; }
    return true;
  };

  const buildItemData = () => ({
    name: form.name.trim(), description: form.description.trim(),
    price: Math.round(parseFloat(form.price) * 100) / 100,
    categoryId: form.categoryId,
    allergens: form.allergens,
    calories: form.calories ? parseInt(form.calories) : undefined,
    isAvailable: form.isAvailable, isPopular: form.isPopular,
    isSpecial: form.isSpecial, soldOut: form.soldOut,
    image: form.image,
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { uploadPhoto } = await import("@/services/photo-service");
      const { url } = await uploadPhoto(file);
      setForm((f) => ({ ...f, image: url }));
    } catch (err: any) {
      toast.error(t("menuBuilder.toasts.photoFailed", { msg: err.message || "" }));
    }
  };

  // ── Add-from-photo handler (V2) ───────────────────────────────────────────
  // Sends the image to /api/items/parse-photo — a dedicated endpoint with a
  // visual-recognition prompt tuned for single plated dishes (not menu cards).
  // Response: { name, description, confidence }. No price, no category.
  // Falls back to the normal empty dialog on any error or empty parse.
  const handleAddFromPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset immediately so the same photo can be re-selected later
    e.target.value = "";
    if (!file) return;

    if (apiCategories.length === 0) {
      toast.error(t("menuBuilder.toasts.noCategoryForScan"));
      return;
    }

    setPhotoScanning(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      // V2: dedicated single-dish endpoint with visual-recognition prompt
      const res = await fetch("/api/items/parse-photo", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(err.message ?? `Request failed (${res.status})`);
      }
      const draft = await res.json() as { name?: string; description?: string; confidence?: string };

      if (!draft?.name?.trim()) {
        toast.error(t("menuBuilder.toasts.cantIdentify"));
        openNewItem();
        return;
      }

      // Low confidence: still open the dialog but warn the operator to verify
      if (draft.confidence === "low") {
        toast.warning(t("menuBuilder.toasts.lowConfidence"));
      }

      // Open the compact Quick Confirm dialog instead of the full 9-field dialog.
      // Price is intentionally left blank — it cannot be inferred from a photo.
      // The operator can expand to the full dialog via "More details".
      setQuickConfirmDraft({
        name: draft.name.trim().slice(0, ITEM_NAME_MAX),
        description: (draft.description ?? "").trim().slice(0, ITEM_DESC_MAX),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Scan failed";
      toast.error(t("menuBuilder.toasts.scanFailed", { msg }));
      openNewItem();
    } finally {
      setPhotoScanning(false);
    }
  };

  const toggleAllergen = (a: string) => {
    setForm((f) => ({
      ...f,
      allergens: f.allergens.includes(a) ? f.allergens.filter((x) => x !== a) : [...f.allergens, a],
    }));
  };

  const formatPriceOnBlur = useCallback(() => {
    if (form.price) {
      const num = parseFloat(form.price);
      if (!isNaN(num) && num > 0) setForm((f) => ({ ...f, price: num.toFixed(2) }));
    }
  }, [form.price]);

  // ── CRUD handlers ──────────────────────────────────────────────────────────

  const addCategory = () => {
    const name = newCategoryName.trim();
    if (!name) return;
    if (apiCategories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      toast.error(t("menuBuilder.toasts.categoryExists"));
      return;
    }
    addCatMutation.mutate(name, {
      onSuccess: () => {
        setNewCategoryName("");
        setCategoryDialog(false);
        toast.success(t("menuBuilder.toasts.categoryCreated", { name }));
        if (pendingScanAfterCategory) {
          setPendingScanAfterCategory(false);
          setTimeout(() => photoInputRef.current?.click(), 100);
        }
      },
    });
  };

  const saveCategory = () => {
    if (!editingCategory) return;
    const name = editingCategory.name.trim();
    if (!name) return;
    if (apiCategories.some((c) => c.id !== editingCategory.id && c.name.toLowerCase() === name.toLowerCase())) {
      toast.error(t("menuBuilder.toasts.categoryDuplicateExists"));
      return;
    }
    updateCatMutation.mutate({ id: editingCategory.id, name }, {
      onSuccess: () => {
        setEditCategoryDialog(false);
        setEditingCategory(null);
        toast.success(t("menuBuilder.toasts.categoryRenamed"));
      },
    });
  };

  const saveItem = () => {
    if (!validateForm()) return;
    const data = buildItemData();
    if (editingItem) {
      updateItemMutation.mutate({ id: editingItem.id, data }, {
        onSuccess: () => { toast.success(t("menuBuilder.toasts.itemUpdated", { name: data.name })); setItemDialog(false); },
      });
    } else {
      const isFirstItem = apiMenuItems.length === 0;
      addItemMutation.mutate(data, {
        onSuccess: () => {
          toast.success(t("menuBuilder.toasts.itemAdded", { name: data.name }));
          setItemDialog(false);
          if (isFirstItem) setShowFirstItemPrompt(true);
        },
      });
    }
  };

  const saveAndAddAnother = () => {
    if (!validateForm()) return;
    const data = buildItemData();
    const isFirstItem = apiMenuItems.length === 0;
    addItemMutation.mutate(data, {
      onSuccess: () => {
        toast.success(t("menuBuilder.toasts.itemAddedMore", { name: data.name }));
        setForm(resetForm(form.categoryId));
        if (isFirstItem) setShowFirstItemPrompt(true);
      },
    });
  };

  const duplicateItem = (item: MenuItem) => {
    duplicateItemMutation.mutate(item.id, {
      onSuccess: () => toast.success(t("menuBuilder.toasts.itemDuplicated")),
    });
  };

  // ── Quick Confirm handlers (scan → compact dialog) ─────────────────────────

  const saveFromQuickConfirm = (data: { name: string; price: number; categoryId: string; description: string }) => {
    const isFirstItem = apiMenuItems.length === 0;
    addItemMutation.mutate(
      { name: data.name, description: data.description, price: data.price, categoryId: data.categoryId, allergens: [], isAvailable: true, isPopular: false },
      {
        onSuccess: () => {
          toast.success(t("menuBuilder.toasts.itemAdded", { name: data.name }));
          setQuickConfirmDraft(null);
          if (isFirstItem) setShowFirstItemPrompt(true);
        },
      }
    );
  };

  const openFullFromQuickConfirm = (name: string, price: string, categoryId: string) => {
    setEditingItem(null);
    setForm({
      name,
      description: quickConfirmDraft?.description ?? "",
      price,
      categoryId: categoryId || apiCategories[0]?.id || "",
      allergens: [],
      calories: "",
      isAvailable: true,
      isPopular: false,
      isSpecial: false,
      soldOut: false,
      image: undefined,
    });
    setQuickConfirmDraft(null);
    setItemDialog(true);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === "item") {
      deleteItemMutation.mutate(deleteTarget.id, {
        onSuccess: () => { toast.success(t("menuBuilder.toasts.itemRemoved", { name: deleteTarget.name })); setDeleteTarget(null); },
      });
    } else {
      if (selectedCategory === deleteTarget.id) setSelectedCategory("all");
      deleteCatMutation.mutate(deleteTarget.id, {
        onSuccess: () => {
          toast.success(t("menuBuilder.toasts.categoryAndItemsRemoved", { name: deleteTarget.name, count: deleteTarget.itemCount }));
          setDeleteTarget(null);
        },
      });
    }
  };

  // ── Workspace shell (loading / empty / editing — single return) ─────────────
  return (
    <>
      {/* Always-mounted print view — hidden on screen, visible only when window.print() is called */}
      {restaurant && (
        <PrintMenuView
          restaurant={restaurant}
          categories={apiCategories}
          menuItems={apiMenuItems}
        />
      )}

      {/* Always-mounted photo file input for Scan Dish */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleAddFromPhoto}
      />

      {/* Workspace: left working area + right sticky preview panel */}
      <div className="flex" style={{ minHeight: "calc(100vh - 3.5rem)" }}>

        {/* ── Left working area ───────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Ambient Copilot signal strip — hidden during initial load, improve mode, and review mode */}
          {!isMenuLoading && !stripDismissed && !isImproveMode && !filterNeedsReview && (
            <CopilotStrip
              key={stripKey}
              onExpandEnhance={() => setEnhanceOpen(true)}
              onAllDismissed={() => setStripDismissed(true)}
            />
          )}
          {/* Recovery ghost — shown only after strip was dismissed in this session */}
          {!isMenuLoading && stripDismissed && (
            <div className="flex items-center px-4 py-1.5 border-b bg-muted/30">
              <button
                onClick={() => {
                  try { sessionStorage.removeItem("copilot_strip_dismissed"); } catch {}
                  setStripDismissed(false);
                  setStripKey((k) => k + 1);
                }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                data-testid="button-show-guidance"
              >
                <Sparkles className="h-3 w-3" />
                {t("menuBuilder.showGuidance")}
              </button>
            </div>
          )}

          <div className="flex-1 overflow-auto">
            {isMenuLoading ? (
              /* Loading */
              <div className="flex h-64 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>

            ) : isEmpty ? (
              /* Empty state: 3 entry cards */
              <div className="flex items-center justify-center px-6 py-12 min-h-[calc(100vh-14rem)]">
                <div className="w-full max-w-md space-y-4">
                  <div className="text-center mb-6">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                      <UtensilsCrossed className="h-6 w-6 text-primary" />
                    </div>
                    <h2 className="text-xl font-semibold">{t("menuBuilder.empty.title")}</h2>
                    <p className="text-sm text-muted-foreground mt-1.5 max-w-sm mx-auto">
                      {t("menuBuilder.empty.subtitle")}
                    </p>
                  </div>
                  <div className="grid gap-3">
                    <button
                      className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:border-primary/40 hover:bg-primary/5 transition-colors text-left"
                      onClick={() => setCategoryDialog(true)}
                      data-testid="empty-action-create"
                    >
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <FolderPlus className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{t("menuBuilder.empty.createCategory")}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{t("menuBuilder.empty.createCategoryHint")}</p>
                      </div>
                    </button>
                    <button
                      className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:border-primary/40 hover:bg-primary/5 transition-colors text-left"
                      onClick={() => navigate("/setup?stage=choose")}
                      data-testid="empty-action-import"
                    >
                      <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                        <Upload className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{t("menuBuilder.empty.importMenu")}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{t("menuBuilder.empty.importMenuHint")}</p>
                      </div>
                    </button>
                    <button
                      className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:border-primary/40 hover:bg-primary/5 transition-colors text-left"
                      onClick={() => {
                        setPendingScanAfterCategory(true);
                        setCategoryDialog(true);
                      }}
                      disabled={photoScanning}
                      data-testid="empty-action-scan"
                    >
                      <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                        {photoScanning ? (
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
                        ) : (
                          <Camera className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{t("menuBuilder.empty.scanDish")}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{t("menuBuilder.empty.scanDishHint")}</p>
                      </div>
                    </button>
                  </div>
                </div>
              </div>

            ) : (
              /* Main editing view */
              <div className="p-4 lg:p-6 space-y-5 max-w-3xl mx-auto">
                {/* Header */}
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <h1 className="text-2xl font-bold flex items-center gap-2">
                        <UtensilsCrossed className="h-6 w-6 text-primary" />
                        {t("menuBuilder.title")}
                      </h1>
                      <p className="text-sm text-muted-foreground mt-1">
                        {t("menuBuilder.subtitle", { name: restaurant?.name ?? "", count: stats.totalItems, cats: stats.totalCategories })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (plan === "free") {
                                toast.info("PDF export is available on Starter and Pro plans.");
                                return;
                              }
                              window.print();
                            }}
                          >
                            {plan === "free"
                              ? <><Lock className="h-4 w-4 mr-1" /> Export PDF</>
                              : <><Printer className="h-4 w-4 mr-1" /> Export PDF</>
                            }
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {plan === "free" ? "Upgrade to Starter or Pro to export a PDF menu" : "Print or save as PDF — clean A4 layout"}
                        </TooltipContent>
                      </Tooltip>
                      <Button variant="outline" size="sm" onClick={() => setCategoryDialog(true)}>
                        <FolderPlus className="h-4 w-4 mr-1" /> {t("menuBuilder.addCategory")}
                      </Button>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={photoScanning}
                            onClick={() => photoInputRef.current?.click()}
                            data-testid="button-scan-dish"
                          >
                            {photoScanning ? (
                              <div className="h-4 w-4 mr-1 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            ) : (
                              <Camera className="h-4 w-4 mr-1" />
                            )}
                            {photoScanning ? t("menuBuilder.scanning") : t("menuBuilder.scanDish")}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t("menuBuilder.scanTooltip")}</TooltipContent>
                      </Tooltip>
                      <Button size="sm" onClick={() => openNewItem()} data-testid="button-add-item">
                        <Plus className="h-4 w-4 mr-1" /> {t("menuBuilder.addItem")}
                      </Button>
                    </div>
                  </div>

                  {/* Stats ribbon */}
                  <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
                    {[
                      { label: t("menuBuilder.stats.total"), value: stats.totalItems },
                      { label: t("menuBuilder.stats.available"), value: stats.availableItems },
                      { label: t("menuBuilder.stats.unavailable"), value: stats.unavailableItems, warn: stats.unavailableItems > 0 },
                      { label: t("menuBuilder.stats.special"), value: stats.specialItems, accent: stats.specialItems > 0 },
                      { label: t("menuBuilder.stats.soldOut"), value: stats.soldOutItems, warn: stats.soldOutItems > 0 },
                      { label: t("menuBuilder.stats.allergens"), value: stats.withAllergens },
                      { label: t("menuBuilder.stats.translations"), value: stats.languageCount > 0 ? `+${stats.languageCount}` : "—" },
                    ].map((s) => (
                      <div
                        key={s.label}
                        className={`text-center py-2 px-3 rounded-lg border ${s.warn ? "border-destructive/30 bg-destructive/5" : (s as { accent?: boolean }).accent ? "border-primary/30 bg-primary/5" : "bg-muted/50"}`}
                      >
                        <div className={`text-lg font-bold ${s.warn ? "text-destructive" : (s as { accent?: boolean }).accent ? "text-primary" : ""}`}>{s.value}</div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Inline AI enhance section */}
                <WorkspaceEnhanceSection
                  open={enhanceOpen}
                  onOpenChange={setEnhanceOpen}
                  onAIRunComplete={() => {
                    setFilterNeedsReview(true);
                    setPreviewUpdatedAt(Date.now());
                    if (previewBadgeTimerRef.current) clearTimeout(previewBadgeTimerRef.current);
                    previewBadgeTimerRef.current = setTimeout(() => setPreviewUpdatedAt(null), 8000);
                  }}
                  onImproveModeChange={setIsImproveMode}
                  intent={enhanceIntent}
                  initialLang={enhanceLang}
                />

                {/* Search & filter */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t("menuBuilder.search")}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9 pr-9"
                    />
                    {search && (
                      <button
                        onClick={() => setSearch("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder={t("menuBuilder.allCategories", { count: stats.totalItems })} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("menuBuilder.allCategories", { count: stats.totalItems })}</SelectItem>
                      {orderedCategories.map((c) => {
                        const count = apiMenuItems.filter((i) => i.categoryId === c.id).length;
                        return (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} ({count})
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {stats.needsReviewItems > 0 && (
                    <Button
                      variant={filterNeedsReview ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFilterNeedsReview((v) => !v)}
                      className="self-center whitespace-nowrap"
                      data-testid="button-filter-needs-review"
                    >
                      <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                      {filterNeedsReview
                        ? t("menuBuilder.reviewMode.showingToReview", { count: filteredItems.filter((i) => i.needsReview).length })
                        : t("menuBuilder.reviewMode.toReview", { count: stats.needsReviewItems })}
                    </Button>
                  )}
                </div>

                {/* W3: Review mode — prominent header replaces the previous subtle blue bar.
                    Only visible when the operator is actively in review mode (filterNeedsReview). */}
                {filterNeedsReview && (
                  <div
                    className="rounded-lg border-2 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/40 px-4 py-3"
                    data-testid="review-mode-header"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 shrink-0">
                        <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-blue-900 dark:text-blue-200">
                          {t("menuBuilder.reviewMode.title", { count: stats.needsReviewItems })}
                        </p>
                        <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
                          {t("menuBuilder.reviewMode.desc")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60"
                          onClick={() => setFilterNeedsReview(false)}
                          data-testid="button-exit-review"
                        >
                          {t("menuBuilder.reviewMode.exitReview")}
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-700 dark:hover:bg-blue-600"
                          disabled={markAllReviewedMutation.isPending}
                          onClick={() => markAllReviewedMutation.mutate()}
                          data-testid="button-mark-all-reviewed"
                        >
                          <Check className="h-3 w-3 mr-1" />
                          {markAllReviewedMutation.isPending ? t("menuBuilder.reviewMode.approving") : t("menuBuilder.reviewMode.approveAll")}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Review complete success — shown briefly when all AI changes are approved */}
                {reviewCompleteMsg && (
                  <div
                    className="rounded-lg border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/40 px-4 py-3 flex items-center gap-3"
                    data-testid="review-complete-success"
                  >
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-green-900 dark:text-green-200">{t("menuBuilder.reviewComplete.title")}</p>
                      <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">{t("menuBuilder.reviewComplete.desc")}</p>
                    </div>
                  </div>
                )}

                {/* No search results */}
                {isSearching && !hasSearchResults && (
                  <div className="py-12 text-center space-y-3">
                    <Search className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                    <p className="text-muted-foreground">
                      {t("menuBuilder.noSearchResults", { query: search })}
                      {selectedCategory !== "all" && <span>{t("menuBuilder.noSearchResultsInCategory")}</span>}
                    </p>
                    <div className="flex items-center justify-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setSearch("")}>{t("menuBuilder.clearSearch")}</Button>
                      {selectedCategory !== "all" && (
                        <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setSelectedCategory("all"); }}>
                          {t("menuBuilder.showAllCategories")}
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Category groups with drag-to-reorder */}
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={() => { isDragging.current = true; }}
                  onDragEnd={handleDragEnd}
                  onDragCancel={() => { isDragging.current = false; }}
                >
                  <SortableContext items={categoryOrder} strategy={verticalListSortingStrategy}>
                    {groupedByCategory.map((group) => {
                      const itemCount = apiMenuItems.filter((i) => i.categoryId === group.id).length;
                      return (
                        <SortableCategoryRow key={group.id} id={group.id} disabled={isReordering}>
                          {(handleRef, handleListeners) => (<>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div
                                ref={handleRef}
                                {...(handleListeners as React.HTMLAttributes<HTMLDivElement>)}
                                className={isReordering ? "cursor-not-allowed opacity-30" : "cursor-grab touch-none"}
                              >
                                <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                              </div>
                              <h3 className="font-semibold text-lg">{group.name}</h3>
                          <Badge variant="secondary" className="text-xs">
                            {group.items.length}{isSearching ? ` / ${itemCount}` : ""}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost" size="sm"
                            className="h-8 gap-1 text-muted-foreground hover:text-foreground"
                            onClick={() => openNewItem(group.id)}
                          >
                            <Plus className="h-3.5 w-3.5" /> {t("menuBuilder.actions.addItemToCategory")}
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setEditingCategory({ id: group.id, name: group.name }); setEditCategoryDialog(true); }}>
                                <Pencil className="h-4 w-4 mr-2" /> {t("menuBuilder.actions.renameCategory")}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleteTarget({ type: "category", id: group.id, name: group.name, itemCount })}
                              >
                                <Trash2 className="h-4 w-4 mr-2" /> {t("menuBuilder.actions.deleteCategory")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      {group.items.length === 0 && !isSearching && (
                        <Card className="border-dashed border-2 hover:border-primary/30 transition-colors cursor-pointer group" onClick={() => openNewItem(group.id)}>
                          <CardContent className="p-8 text-center">
                            <Plus className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2 group-hover:text-primary/50 transition-colors" />
                            <p className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                              {t("menuBuilder.addFirstDish", { category: group.name.toLowerCase() })}
                            </p>
                          </CardContent>
                        </Card>
                      )}

                      {group.items.length > 0 && (
                        <div className="grid gap-2">
                          {group.items.map((item) => (
                            <ItemCard
                              key={item.id}
                              item={item}
                              currency={restaurant?.currency}
                              reviewMode={filterNeedsReview}
                              onEdit={() => openEditItem(item)}
                              onDuplicate={() => duplicateItem(item)}
                              onDelete={() => setDeleteTarget({ type: "item", id: item.id, name: item.name })}
                              onToggleAvailability={() => updateItemMutation.mutate({ id: item.id, data: { isAvailable: !item.isAvailable } })}
                              onTogglePopular={() => updateItemMutation.mutate({ id: item.id, data: { isPopular: !item.isPopular } })}
                              onToggleSpecial={() => updateItemMutation.mutate({ id: item.id, data: { isSpecial: !item.isSpecial } })}
                              onToggleSoldOut={() => updateItemMutation.mutate({ id: item.id, data: { soldOut: !item.soldOut } })}
                              onPriceUpdate={(price) => updateItemMutation.mutate({ id: item.id, data: { price } })}
                              onMarkReviewed={() => markReviewedMutation.mutate(item.id)}
                            />
                          ))}
                        </div>
                      )}
                          </>)}
                        </SortableCategoryRow>
                      );
                    })}
                  </SortableContext>
                </DndContext>

                {/* Bottom quick links */}
                <div className="flex items-center justify-center gap-6 pt-4 border-t text-sm text-muted-foreground">
                  <button onClick={() => navigate("/qr-codes")} className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                    <QrCode className="h-4 w-4" /> {t("menuBuilder.generateQr")}
                  </button>
                  <button onClick={() => { setEnhanceOpen(true); }} className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                    <Sparkles className="h-4 w-4" /> {t("menuBuilder.aiEnhance")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right sticky preview panel (xl+ screens) ────────────────────── */}
        <div className="hidden xl:flex w-[380px] shrink-0 flex-col border-l bg-background sticky top-0 self-start overflow-y-auto" style={{ height: "calc(100vh - 3.5rem)" }}>
          <MenuPreviewPanel previewUpdatedAt={previewUpdatedAt} filterNeedsReview={filterNeedsReview} />
        </div>
      </div>

      {/* ── Always-rendered dialogs ──────────────────────────────────────────── */}

      {/* Quick Confirm Dialog — compact 3-field dialog after Scan Dish */}
      {quickConfirmDraft && (
        <QuickConfirmDialog
          open={quickConfirmDraft !== null}
          draft={quickConfirmDraft}
          categories={apiCategories}
          defaultCategoryId={smartDefaultCategoryId}
          isSaving={addItemMutation.isPending}
          onSave={saveFromQuickConfirm}
          onMoreDetails={openFullFromQuickConfirm}
          onClose={() => setQuickConfirmDraft(null)}
        />
      )}

      {/* Item Dialog */}
      <Dialog open={itemDialog} onOpenChange={setItemDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? t("menuBuilder.dialogs.editItem") : t("menuBuilder.dialogs.newItem")}</DialogTitle>
            <DialogDescription>
              {editingItem ? t("menuBuilder.dialogs.editItemDesc") : t("menuBuilder.dialogs.newItemDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            {/* Name */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="item-name">{t("menuBuilder.itemName")} <span className="text-destructive">*</span></Label>
                <span className={`text-[11px] ${form.name.length > ITEM_NAME_MAX ? "text-destructive" : "text-muted-foreground"}`}>
                  {form.name.length}/{ITEM_NAME_MAX}
                </span>
              </div>
              <Input
                id="item-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value.slice(0, ITEM_NAME_MAX + 10) }))}
                placeholder={t("menuBuilder.dialogs.dishNamePlaceholder")}
                autoFocus
              />
            </div>

            {/* Photo upload */}
            <div className="space-y-1.5">
              <Label>{t("menuBuilder.dialogs.photoOptional")}</Label>
              {form.image ? (
                <div className="relative group w-full">
                  <img src={form.image} alt="Item preview" className="w-full h-40 object-cover rounded-lg border" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                    <label className="cursor-pointer">
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                      <Button type="button" variant="secondary" size="sm" asChild>
                        <span><Upload className="h-3.5 w-3.5 mr-1" /> {t("menuBuilder.actions.replacePhoto")}</span>
                      </Button>
                    </label>
                    <Button type="button" variant="secondary" size="sm" onClick={() => setForm((f) => ({ ...f, image: undefined }))}>
                      <X className="h-3.5 w-3.5 mr-1" /> {t("menuBuilder.actions.removePhoto")}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <label className="flex-1 cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    <div className="flex items-center justify-center gap-2 h-20 rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/40 hover:bg-primary/5 transition-colors">
                      <Upload className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{t("menuBuilder.actions.uploadPhoto")}</span>
                    </div>
                  </label>
                  <label className="flex-1 cursor-pointer">
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageUpload} />
                    <div className="flex items-center justify-center gap-2 h-20 rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/40 hover:bg-primary/5 transition-colors">
                      <Camera className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{t("menuBuilder.actions.takePhoto")}</span>
                    </div>
                  </label>
                </div>
              )}
              <p className="text-xs text-muted-foreground">{t("menuBuilder.dialogs.photoOptionalHint")}</p>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="item-desc">{t("menuBuilder.description")}</Label>
                <span className={`text-[11px] ${form.description.length > ITEM_DESC_MAX ? "text-destructive" : "text-muted-foreground"}`}>
                  {form.description.length}/{ITEM_DESC_MAX}
                </span>
              </div>
              <Textarea
                id="item-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value.slice(0, ITEM_DESC_MAX + 20) }))}
                placeholder={t("menuBuilder.dialogs.descriptionPlaceholder")}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                {t("menuBuilder.dialogs.descriptionHint")}{" "}
                <button type="button" onClick={() => { setItemDialog(false); setEnhanceOpen(true); setEnhanceIntent("rewrite"); }} className="text-primary hover:underline">
                  {t("menuBuilder.dialogs.openAiEnhance")}
                </button>.
              </p>
            </div>

            {/* Price + Calories */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="item-price">{t("menuBuilder.price")} <span className="text-destructive">*</span></Label>
                <Input
                  id="item-price" type="number" step="0.01" min="0.01"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  onBlur={formatPriceOnBlur}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item-cal">{t("menuBuilder.calories")}</Label>
                <Input
                  id="item-cal" type="number" min="0"
                  value={form.calories}
                  onChange={(e) => setForm((f) => ({ ...f, calories: e.target.value }))}
                  placeholder={t("common.optional")}
                />
              </div>
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label>{t("menuBuilder.dialogs.categoryRequired")} <span className="text-destructive">*</span></Label>
              <Select value={form.categoryId} onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}>
                <SelectTrigger><SelectValue placeholder={t("menuBuilder.dialogs.selectCategory")} /></SelectTrigger>
                <SelectContent>
                  {sortCategories(apiCategories).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Allergens */}
            <div className="space-y-1.5">
              <Label>{t("menuBuilder.allergens")}</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {ALLERGEN_OPTIONS.map((a) => (
                  <Badge
                    key={a}
                    variant={form.allergens.includes(a) ? "default" : "outline"}
                    className="cursor-pointer capitalize gap-1"
                    onClick={() => toggleAllergen(a)}
                  >
                    <span>{ALLERGEN_ICONS[a]}</span> {a}
                  </Badge>
                ))}
              </div>
              {form.allergens.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t("menuBuilder.dialogs.allergenCount", { count: form.allergens.length })}
                </p>
              )}
            </div>

            <Separator />

            {/* Availability + Popular + Special + Sold Out toggles */}
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch id="item-available" checked={form.isAvailable} onCheckedChange={(v) => setForm((f) => ({ ...f, isAvailable: v }))} />
                <Label htmlFor="item-available" className="flex items-center gap-1">
                  {t("menuBuilder.available")}
                  {!form.isAvailable && <span className="text-xs text-muted-foreground">{t("menuBuilder.hiddenFromGuests")}</span>}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="item-popular" checked={form.isPopular} onCheckedChange={(v) => setForm((f) => ({ ...f, isPopular: v }))} />
                <Label htmlFor="item-popular">
                  <span className="flex items-center gap-1"><Star className="h-3 w-3" /> {t("menuBuilder.popular")}</span>
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="item-special" checked={form.isSpecial} onCheckedChange={(v) => setForm((f) => ({ ...f, isSpecial: v }))} />
                <Label htmlFor="item-special">
                  <span className="flex items-center gap-1 text-amber-700"><Sparkles className="h-3 w-3" /> {t("menuBuilder.special")}</span>
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="item-soldout" checked={form.soldOut} onCheckedChange={(v) => setForm((f) => ({ ...f, soldOut: v }))} />
                <Label htmlFor="item-soldout">
                  <span className="flex items-center gap-1 text-orange-700"><Ban className="h-3 w-3" /> {t("menuBuilder.soldOut")}</span>
                </Label>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setItemDialog(false)}>{t("menuBuilder.actions.cancel")}</Button>
            {!editingItem && (
              <Button variant="secondary" onClick={saveAndAddAnother} disabled={isSavingItem}>
                <Check className="h-4 w-4 mr-1" /> {isSavingItem ? t("menuBuilder.actions.saving") : t("menuBuilder.actions.saveAndAdd")}
              </Button>
            )}
            <Button onClick={saveItem} disabled={isSavingItem}>
              {isSavingItem ? t("menuBuilder.actions.saving") : editingItem ? t("menuBuilder.actions.save") : t("menuBuilder.addItem")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Category Dialog */}
      <CategoryDialog
        open={categoryDialog}
        onOpenChange={(open) => {
          if (!open) setPendingScanAfterCategory(false);
          setCategoryDialog(open);
        }}
        value={newCategoryName}
        onChange={setNewCategoryName}
        onSave={addCategory}
      />

      {/* Rename Category Dialog */}
      <Dialog open={editCategoryDialog} onOpenChange={setEditCategoryDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("menuBuilder.dialogs.renameCategory")}</DialogTitle>
            <DialogDescription>{t("menuBuilder.dialogs.renameCategoryDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>{t("menuBuilder.categoryName")}</Label>
            <Input
              value={editingCategory?.name || ""}
              onChange={(e) => setEditingCategory((c) => c ? { ...c, name: e.target.value } : c)}
              onKeyDown={(e) => e.key === "Enter" && saveCategory()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCategoryDialog(false)}>{t("menuBuilder.actions.cancel")}</Button>
            <Button
              onClick={saveCategory}
              disabled={!editingCategory?.name.trim() || updateCatMutation.isPending}
            >
              {updateCatMutation.isPending ? t("menuBuilder.actions.saving") : t("menuBuilder.actions.rename")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              {deleteTarget?.type === "category" ? t("menuBuilder.dialogs.deleteCategory") : t("menuBuilder.dialogs.deleteItem")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === "category"
                ? t("menuBuilder.dialogs.deleteCategoryDesc", { name: deleteTarget.name, count: deleteTarget.itemCount })
                : t("menuBuilder.dialogs.deleteItemDesc", { name: deleteTarget?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("menuBuilder.actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteItemMutation.isPending || deleteCatMutation.isPending}
            >
              {(deleteItemMutation.isPending || deleteCatMutation.isPending) ? t("menuBuilder.dialogs.deleting") : t("menuBuilder.actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Sub-components (unchanged from original) ──────────────────────────────────

function ItemCard({
  item, onEdit, onDuplicate, onDelete, onToggleAvailability, onTogglePopular, onToggleSpecial, onToggleSoldOut, onPriceUpdate, onMarkReviewed, currency = "USD", reviewMode = false,
}: {
  item: MenuItem;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleAvailability: () => void;
  onTogglePopular: () => void;
  onToggleSpecial: () => void;
  onToggleSoldOut: () => void;
  onPriceUpdate: (price: number) => void;
  onMarkReviewed: () => void;
  currency?: string;
  reviewMode?: boolean;
}) {
  const { t } = useTranslation();
  const translationCount = Object.keys(item.translations || {}).length;
  const [priceEditing, setPriceEditing] = useState(false);
  const [priceInput, setPriceInput] = useState("");

  const commitPrice = () => {
    const n = parseFloat(priceInput);
    if (!isNaN(n) && n > 0) {
      const rounded = Math.round(n * 100) / 100;
      if (rounded !== item.price) onPriceUpdate(rounded);
    }
    setPriceEditing(false);
    setPriceInput("");
  };

  const showReviewTreatment = reviewMode && item.needsReview;

  return (
    <Card
      className={`transition-all hover:shadow-sm group cursor-pointer ${!item.isAvailable ? "opacity-60" : ""} ${showReviewTreatment ? "border-l-4 border-l-blue-400 dark:border-l-blue-500" : ""}`}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest("button, [role='switch'], [role='menuitem'], [data-radix-collection-item]")) return;
        onEdit();
      }}
    >
      <CardContent className="p-4 flex items-start gap-4">
        <div className="pt-1 shrink-0 opacity-0 group-hover:opacity-40 transition-opacity cursor-grab">
          <GripVertical className="h-4 w-4" />
        </div>

        {item.image && (
          <div className="shrink-0">
            <img src={item.image} alt="" className="w-14 h-14 rounded-lg object-cover" />
          </div>
        )}

        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-medium ${item.soldOut ? "line-through text-muted-foreground" : ""}`}>{item.name}</span>
            {item.needsReview && (
              <Badge className="text-[10px] gap-0.5 px-1.5 py-0 bg-blue-500/15 text-blue-700 border-blue-400/40 hover:bg-blue-500/20" variant="outline" data-testid={`badge-needs-review-${item.id}`}>
                <Sparkles className="h-2.5 w-2.5" /> {t("menuBuilder.badges.aiUpdated")}
              </Badge>
            )}
            {item.isSpecial && (
              <Badge className="text-[10px] gap-0.5 px-1.5 py-0 bg-amber-500/15 text-amber-700 border-amber-400/40 hover:bg-amber-500/20" variant="outline">
                <Sparkles className="h-2.5 w-2.5" /> {t("menuBuilder.badges.special")}
              </Badge>
            )}
            {item.soldOut && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5 border-orange-400/40 text-orange-700">
                <Ban className="h-2.5 w-2.5" /> {t("menuBuilder.badges.soldOut")}
              </Badge>
            )}
            {item.isPopular && (
              <Badge variant="secondary" className="text-[10px] gap-0.5 px-1.5 py-0">
                <Star className="h-2.5 w-2.5 text-primary fill-primary" /> {t("menuBuilder.badges.popular")}
              </Badge>
            )}
            {!item.isAvailable && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-destructive/40 text-destructive">
                {t("menuBuilder.badges.unavailable")}
              </Badge>
            )}
            {translationCount > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5">
                <Globe className="h-2.5 w-2.5" /> {t("menuBuilder.badges.lang", { count: translationCount })}
              </Badge>
            )}
          </div>

          {item.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
          )}

          <div className="flex gap-1.5 flex-wrap items-center">
            {item.allergens.map((a) => (
              <Badge key={a} variant="outline" className="text-[10px] capitalize gap-0.5 px-1.5 py-0">
                <span>{ALLERGEN_ICONS[a] || "⚠️"}</span> {a}
              </Badge>
            ))}
            {item.calories && (
              <Badge variant="secondary" className="text-[10px] gap-0.5 px-1.5 py-0">
                <Flame className="h-2.5 w-2.5" /> {item.calories} cal
              </Badge>
            )}
          </div>

          {showReviewTreatment && (
            <div className="pt-1.5 border-t border-blue-200/60 dark:border-blue-800/60">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-400 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-950/40 gap-1"
                onClick={(e) => { e.stopPropagation(); onMarkReviewed(); }}
                data-testid={`button-approve-${item.id}`}
              >
                <Check className="h-3 w-3" />
                {t("menuBuilder.actions.approve")}
              </Button>
            </div>
          )}
        </div>

        <div className="text-right shrink-0 pt-0.5">
          {priceEditing ? (
            <input
              type="number"
              step="0.01"
              min="0.01"
              className="w-20 text-right text-lg font-semibold rounded border border-primary px-1 py-0.5 outline-none focus:ring-1 focus:ring-primary bg-background"
              value={priceInput}
              autoFocus
              onChange={(e) => setPriceInput(e.target.value)}
              onBlur={commitPrice}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); commitPrice(); }
                if (e.key === "Escape") { setPriceEditing(false); setPriceInput(""); }
              }}
              onClick={(e) => e.stopPropagation()}
              data-testid={`price-input-${item.id}`}
            />
          ) : (
            <button
              className="font-semibold text-lg hover:text-primary hover:underline transition-colors"
              title={t("menuBuilder.dialogs.editPriceTooltip")}
              onClick={(e) => { e.stopPropagation(); setPriceInput(item.price.toFixed(2)); setPriceEditing(true); }}
              data-testid={`price-${item.id}`}
            >
              {formatPrice(item.price, currency)}
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 pt-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Switch
                  checked={item.isAvailable}
                  onCheckedChange={onToggleAvailability}
                  className="data-[state=unchecked]:bg-destructive/30"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>{item.isAvailable ? t("menuBuilder.actions.markUnavailable") : t("menuBuilder.actions.markAvailable")}</TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}><Pencil className="h-4 w-4 mr-2" /> {t("menuBuilder.actions.edit")}</DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}><Copy className="h-4 w-4 mr-2" /> {t("menuBuilder.actions.duplicate")}</DropdownMenuItem>
              {item.needsReview && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onMarkReviewed} data-testid={`button-mark-reviewed-${item.id}`}>
                    <Check className="h-4 w-4 mr-2 text-blue-600" /> {t("menuBuilder.actions.markReviewed")}
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onToggleSpecial}>
                <Sparkles className="h-4 w-4 mr-2 text-amber-500" /> {item.isSpecial ? t("menuBuilder.actions.removeSpecial") : t("menuBuilder.actions.markSpecial")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onToggleSoldOut}>
                <Ban className="h-4 w-4 mr-2 text-orange-500" /> {item.soldOut ? t("menuBuilder.actions.removeSoldOut") : t("menuBuilder.actions.markSoldOut")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onTogglePopular}>
                <Star className="h-4 w-4 mr-2" /> {item.isPopular ? t("menuBuilder.actions.removePopular") : t("menuBuilder.actions.markPopular")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
                <Trash2 className="h-4 w-4 mr-2" /> {t("menuBuilder.actions.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

function CategoryDialog({
  open, onOpenChange, value, onChange, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("menuBuilder.dialogs.newCategory")}</DialogTitle>
          <DialogDescription>{t("menuBuilder.dialogs.newCategoryDesc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="cat-name">{t("menuBuilder.categoryName")}</Label>
          <Input
            id="cat-name"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t("menuBuilder.dialogs.categoryNewPlaceholder")}
            onKeyDown={(e) => e.key === "Enter" && onSave()}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("menuBuilder.actions.cancel")}</Button>
          <Button onClick={onSave} disabled={!value.trim()}>{t("menuBuilder.addCategory")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── QuickConfirmDialog ─────────────────────────────────────────────────────────
// Compact 3-field dialog that opens after a successful Scan Dish parse.
// Operator confirms/edits Name, enters Price, picks Category — then saves directly
// or expands to the full Add Item dialog via "More details".

function QuickConfirmDialog({
  open, draft, categories, defaultCategoryId, isSaving, onSave, onMoreDetails, onClose,
}: {
  open: boolean;
  draft: { name: string; description: string };
  categories: MenuCategory[];
  defaultCategoryId: string;
  isSaving: boolean;
  onSave: (data: { name: string; price: number; categoryId: string; description: string }) => void;
  onMoreDetails: (name: string, price: string, categoryId: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(draft.name);
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState(defaultCategoryId);

  // Re-sync when a new draft arrives (different scan result)
  useEffect(() => {
    if (open) {
      setName(draft.name);
      setPrice("");
      setCategoryId(defaultCategoryId);
    }
  }, [open, draft.name, defaultCategoryId]);

  const canSave = name.trim().length > 0 && parseFloat(price) > 0 && categoryId.length > 0;

  const handleSave = () => {
    if (!canSave) {
      toast.error(t("menuBuilder.toasts.quickConfirmRequired"));
      return;
    }
    onSave({
      name: name.trim().slice(0, ITEM_NAME_MAX),
      price: Math.round(parseFloat(price) * 100) / 100,
      categoryId,
      description: draft.description,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-primary" /> {t("menuBuilder.dialogs.scanDish")}
          </DialogTitle>
          <DialogDescription>{t("menuBuilder.dialogs.scanDishDesc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="qc-name">{t("menuBuilder.dialogs.dishName")} <span className="text-destructive">*</span></Label>
            <Input
              id="qc-name"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, ITEM_NAME_MAX))}
              placeholder={t("menuBuilder.dialogs.dishNamePlaceholder")}
            />
          </div>

          {/* Price — autofocused, the one field the operator must fill */}
          <div className="space-y-1.5">
            <Label htmlFor="qc-price">{t("menuBuilder.price")} <span className="text-destructive">*</span></Label>
            <Input
              id="qc-price"
              type="number"
              step="0.01"
              min="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="0.00"
              autoFocus
              data-testid="input-qc-price"
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label>{t("menuBuilder.dialogs.categoryRequired")} <span className="text-destructive">*</span></Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger data-testid="select-qc-category">
                <SelectValue placeholder={t("menuBuilder.dialogs.selectCategory")} />
              </SelectTrigger>
              <SelectContent>
                {sortCategories(categories).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description preview — read-only, reassures operator it was captured */}
          {draft.description && (
            <p className="text-xs text-muted-foreground border rounded-lg px-3 py-2 line-clamp-2 bg-muted/30">
              "{draft.description}"
            </p>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            className="w-full"
            onClick={handleSave}
            disabled={isSaving || !canSave}
            data-testid="button-qc-save"
          >
            {isSaving ? t("menuBuilder.actions.adding") : t("menuBuilder.actions.addToMenu")} <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          </Button>
          <Button
            variant="ghost"
            className="w-full text-muted-foreground text-sm"
            onClick={() => onMoreDetails(name, price, categoryId)}
            data-testid="button-qc-more-details"
          >
            {t("menuBuilder.actions.moreDetails")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
