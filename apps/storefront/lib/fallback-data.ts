import type { Category, Product } from "./storefront-types";

export const fallbackCategories: Category[] = [
  { id: "all", name: "All", slug: "all" },
  { id: "c1", name: "Toys (Female)", slug: "toys-female" },
  { id: "c2", name: "Toys (Male)", slug: "toys-male" },
  { id: "c3", name: "Pleasure Materials", slug: "pleasure-materials" },
  { id: "c4", name: "Magazines", slug: "magazines" },
  { id: "c5", name: "Couples Essentials", slug: "couples-essentials" },
  { id: "c6", name: "Lingerie", slug: "lingerie" },
  { id: "c7", name: "Wellness & Care", slug: "wellness-care" },
  { id: "c8", name: "Gift Sets", slug: "gift-sets" },
  { id: "c9", name: "Performance Boosters", slug: "performance-boosters" },
  { id: "c10", name: "Intimate Party Essentials", slug: "intimate-party-essentials" },
];

export const fallbackProducts: Product[] = [
  {
    id: "p101",
    slug: "rose-velvet-suction-massager",
    productCode: "SM-P101",
    name: "Rose Velvet Suction Massager",
    description: "Premium soft-touch stimulator with discreet quiet motor and magnetic charging.",
    priceNgn: 48900,
    stock: 30,
    images: [{ imageUrl: "https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?auto=format&fit=crop&w=900&q=80" }],
    category: { id: "c1", name: "Toys (Female)", slug: "toys-female" },
  },
  {
    id: "p102",
    slug: "pulse-core-mens-trainer",
    productCode: "SM-P102",
    name: "Pulse Core Men's Trainer",
    description: "Textured internal sleeve with app-ready pulse controls.",
    priceNgn: 42900,
    stock: 26,
    images: [{ imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80" }],
    category: { id: "c2", name: "Toys (Male)", slug: "toys-male" },
  },
  {
    id: "p103",
    slug: "hydro-glide-relax-kit",
    productCode: "SM-P103",
    name: "Hydro Glide Relax Kit",
    description: "Water-based lube, toy cleaner, and aftercare blend for comfort.",
    priceNgn: 19400,
    stock: 50,
    images: [{ imageUrl: "https://images.unsplash.com/photo-1626510431120-9f4e6cd4f8a9?auto=format&fit=crop&w=900&q=80" }],
    category: { id: "c7", name: "Wellness & Care", slug: "wellness-care" },
  },
];
