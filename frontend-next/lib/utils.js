export function normalizeCategory(category) {
  if (!category) return "";
  const categoryStr =
    typeof category === "string" ? category : category.name || category.slug || "";
  return categoryStr.toLowerCase().replace(/\s+/g, "-");
}
