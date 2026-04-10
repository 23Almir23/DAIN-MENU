import { formatPrice } from "@/lib/menu-utils";
import { resolveTranslation } from "@/lib/i18n-utils";
import type { MenuItem, MenuCategory, Restaurant } from "@/types/menu";

interface PrintMenuViewProps {
  restaurant?: Restaurant | null;
  restaurantName?: string;
  categories: MenuCategory[];
  menuItems?: MenuItem[];
  items?: MenuItem[];
  currency?: string;
  lang?: string;
  baseLang?: string;
}

export function PrintMenuView({
  restaurant,
  restaurantName,
  categories,
  menuItems,
  items,
  currency,
  lang = "en",
  baseLang = "en",
}: PrintMenuViewProps) {
  const resolvedName = restaurantName ?? restaurant?.name ?? "";
  const resolvedItems = items ?? menuItems ?? [];
  const resolvedCurrency = currency ?? restaurant?.currency ?? "USD";
  return (
    <div
      style={{
        fontFamily: "'DM Sans', system-ui, sans-serif",
        color: "#111",
        background: "#fff",
        padding: "40px 48px",
        maxWidth: 680,
        margin: "0 auto",
      }}
    >
      {/* Header */}
      <div style={{ borderBottom: "2px solid #111", paddingBottom: 16, marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>{resolvedName}</h1>
      </div>

      {/* Categories */}
      {categories.map((cat) => {
        const catItems = resolvedItems.filter((i) => i.categoryId === cat.id && i.isAvailable);
        if (catItems.length === 0) return null;

        const catName =
          lang !== baseLang && cat.translations?.[lang]?.name
            ? cat.translations[lang].name
            : cat.name;

        return (
          <div key={cat.id} style={{ marginBottom: 32 }}>
            <h2
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#666",
                borderBottom: "1px solid #e5e5e5",
                paddingBottom: 6,
                marginBottom: 16,
                margin: "0 0 16px 0",
              }}
            >
              {catName}
            </h2>

            {catItems.map((item) => {
              const resolved = resolveTranslation(
                { name: item.name, description: item.description },
                item.translations,
                lang,
                baseLang
              );

              return (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 16,
                    paddingBottom: 12,
                    marginBottom: 12,
                    borderBottom: "1px solid #f0f0f0",
                    opacity: item.soldOut ? 0.5 : 1,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: 14,
                          textDecoration: item.soldOut ? "line-through" : undefined,
                        }}
                      >
                        {resolved.name}
                      </span>
                      {item.soldOut && (
                        <span style={{ fontSize: 10, color: "#999" }}>— sold out</span>
                      )}
                      {item.isSpecial && !item.soldOut && (
                        <span
                          style={{
                            fontSize: 9,
                            padding: "1px 6px",
                            borderRadius: 999,
                            backgroundColor: "#fff3e0",
                            color: "#c9703a",
                            fontWeight: 600,
                          }}
                        >
                          SPECIAL
                        </span>
                      )}
                    </div>
                    {resolved.description && (
                      <p style={{ fontSize: 12, color: "#666", margin: "3px 0 0", lineHeight: 1.5 }}>
                        {resolved.description}
                      </p>
                    )}
                    {item.allergens.length > 0 && (
                      <p style={{ fontSize: 10, color: "#999", margin: "4px 0 0" }}>
                        {item.allergens.join(", ")}
                      </p>
                    )}
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 14, flexShrink: 0, color: "#111" }}>
                    {formatPrice(item.price, resolvedCurrency)}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Footer */}
      <div style={{ marginTop: 40, borderTop: "1px solid #e5e5e5", paddingTop: 12, textAlign: "center", fontSize: 10, color: "#bbb" }}>
        Powered by Dain Menu · dainmenu.com
      </div>
    </div>
  );
}
