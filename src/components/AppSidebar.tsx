import {
  LayoutDashboard, UtensilsCrossed, Eye, QrCode, CreditCard, Settings, ChefHat,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { useBilling } from "@/hooks/use-billing";
import { useRestaurant } from "@/hooks/use-restaurant";
import { useMenu } from "@/hooks/use-menu";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export function AppSidebar() {
  const { state: sidebarState } = useSidebar();
  const collapsed = sidebarState === "collapsed";
  const location = useLocation();
  const { credits, plan } = useBilling();
  const { restaurant } = useRestaurant();
  const { menuItems } = useMenu();
  const needsReviewCount = menuItems.filter((i) => i.needsReview).length;
  const { t } = useTranslation();

  const mainItems = [
    { titleKey: "sidebar.dashboard", url: "/dashboard", icon: LayoutDashboard },
    { titleKey: "sidebar.menuBuilder", url: "/menu", icon: UtensilsCrossed },
    { titleKey: "sidebar.guestPreview", url: "/preview", icon: Eye },
    { titleKey: "sidebar.qrSharing", url: "/qr-codes", icon: QrCode },
  ];

  const bottomItems = [
    { titleKey: "sidebar.planCredits", url: "/billing", icon: CreditCard },
    { titleKey: "sidebar.settings", url: "/settings", icon: Settings },
  ];

  const isActive = (url: string) => {
    if (url === "/dashboard") return location.pathname === "/dashboard";
    return location.pathname.startsWith(url);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <ChefHat className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight text-sidebar-foreground font-serif">d<span className="text-amber-500">ai</span>n</span>
              <span className="text-[11px] text-sidebar-foreground/50">{t("sidebar.digitalMenus")}</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-sidebar-foreground/40">{t("sidebar.workspace")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.titleKey}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} end={item.url === "/"}>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{t(item.titleKey)}</span>}
                      {!collapsed && item.titleKey === "sidebar.menuBuilder" && needsReviewCount === 0 && (
                        <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0 bg-sidebar-accent text-sidebar-accent-foreground">
                          {credits}
                        </Badge>
                      )}
                      {item.titleKey === "sidebar.menuBuilder" && needsReviewCount > 0 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge className="ml-auto text-[10px] px-1.5 py-0 bg-amber-500 text-white" data-testid="badge-needs-review-count">
                              {needsReviewCount}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            {t("sidebar.reviewTooltip", { count: needsReviewCount })}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-sidebar-foreground/40">{t("sidebar.account")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {bottomItems.map((item) => (
                <SidebarMenuItem key={item.titleKey}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url}>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{t(item.titleKey)}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        {!collapsed && (
          <div className="rounded-xl bg-sidebar-accent/60 p-3.5 border border-sidebar-border space-y-2">
            <div>
              <p className="text-xs font-medium text-sidebar-foreground">{restaurant?.name ?? ""}</p>
              <p className="text-[10px] text-sidebar-foreground/50 capitalize mt-0.5">
                {t("sidebar.planLine", { plan, credits })}
              </p>
            </div>
            <LanguageSwitcher variant="sidebar" />
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
