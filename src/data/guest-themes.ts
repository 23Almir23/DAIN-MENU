/**
 * Guest-facing menu theme definitions.
 * Each theme controls the visual presentation of the guest menu experience.
 * In Replit: stored as restaurant.guest_theme in the database.
 */

export type GuestThemeId = "elegant" | "contemporary" | "warm" | "custom";

export interface GuestTheme {
  id: GuestThemeId;
  name: string;
  tagline: string;
  description: string;
  idealFor: string;
  preview: {
    headerBg: string;
    headerText: string;
    bodyBg: string;
    cardBg: string;
    accentColor: string;
    fontHeading: string;
    fontBody: string;
    borderRadius: string;
    itemStyle: "minimal" | "card" | "warm";
  };
}

export const GUEST_THEMES: GuestTheme[] = [
  {
    id: "elegant",
    name: "Maison",
    tagline: "Fine dining & editorial",
    description: "Refined serif typography, restrained palette, and generous spacing. Designed for upscale restaurants where every detail signals quality.",
    idealFor: "Fine dining, tasting menus, wine bars, chef-driven restaurants",
    preview: {
      headerBg: "linear-gradient(135deg, #1a1a1a, #2d2d2d)",
      headerText: "#f5f0eb",
      bodyBg: "#faf8f5",
      cardBg: "#ffffff",
      accentColor: "#8b7355",
      fontHeading: "'DM Serif Display', Georgia, serif",
      fontBody: "'DM Sans', system-ui, sans-serif",
      borderRadius: "0.5rem",
      itemStyle: "minimal",
    },
  },
  {
    id: "contemporary",
    name: "Studio",
    tagline: "Modern & urban",
    description: "Sharp sans-serif hierarchy, high contrast, and confident density. Designed for trend-aware restaurants and modern hospitality brands.",
    idealFor: "Cafés, cocktail bars, brunch spots, urban bistros",
    preview: {
      headerBg: "linear-gradient(135deg, #0f1419, #1a2332)",
      headerText: "#ffffff",
      bodyBg: "#f4f5f7",
      cardBg: "#ffffff",
      accentColor: "#2563eb",
      fontHeading: "'DM Sans', system-ui, sans-serif",
      fontBody: "'DM Sans', system-ui, sans-serif",
      borderRadius: "0.75rem",
      itemStyle: "card",
    },
  },
  {
    id: "warm",
    name: "Osteria",
    tagline: "Warm & Mediterranean",
    description: "Earthy tones, warm textures, and an inviting atmosphere. Designed for restaurants where the experience is as important as the food.",
    idealFor: "Trattorias, tavernas, family restaurants, lifestyle venues",
    preview: {
      headerBg: "linear-gradient(135deg, #5c3d2e, #7a5540)",
      headerText: "#faf3ec",
      bodyBg: "#fdf6ef",
      cardBg: "#fffcf7",
      accentColor: "#b0703c",
      fontHeading: "'DM Serif Display', Georgia, serif",
      fontBody: "'DM Sans', system-ui, sans-serif",
      borderRadius: "1rem",
      itemStyle: "warm",
    },
  },
  {
    id: "custom",
    name: "Your Brand",
    tagline: "Custom identity",
    description: "Adapt the guest menu to your restaurant's visual identity — your colors, your logo, your tone. Available with Starter and Pro plans.",
    idealFor: "Established brands, multi-location restaurants, franchise concepts",
    preview: {
      headerBg: "linear-gradient(135deg, #6366f1, #8b5cf6)",
      headerText: "#ffffff",
      bodyBg: "#f8f7ff",
      cardBg: "#ffffff",
      accentColor: "#6366f1",
      fontHeading: "'DM Sans', system-ui, sans-serif",
      fontBody: "'DM Sans', system-ui, sans-serif",
      borderRadius: "0.75rem",
      itemStyle: "card",
    },
  },
];

export function getGuestTheme(id: GuestThemeId): GuestTheme {
  return GUEST_THEMES.find((t) => t.id === id) || GUEST_THEMES[0];
}
