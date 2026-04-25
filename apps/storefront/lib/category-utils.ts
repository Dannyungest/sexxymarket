import type { Category } from "./storefront-types";

const allCategory: Category = { id: "all", name: "All", slug: "all" };

export function normalizeCategories(input: Category[]): Category[] {
  const bySlug = new Map<string, Category>();
  const ordered: Category[] = [];

  for (const category of input) {
    const slug = category.slug?.trim();
    if (!slug) continue;
    if (slug === "all") continue;
    if (bySlug.has(slug)) continue;
    bySlug.set(slug, category);
    ordered.push(category);
  }

  return [allCategory, ...ordered];
}
