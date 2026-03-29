export function normalizeCategory(category) {
  if (!category) return "";
  const categoryStr =
    typeof category === "string" ? category : category.name || category.slug || "";
  return categoryStr.toLowerCase().replace(/\s+/g, "-");
}

export function isProductOutOfStock(product) {
  if (!product) return true;

  if (product.stock_type === "variants") {
    if (typeof product.total_stock === "number") {
      return product.total_stock <= 0;
    }

    if (Array.isArray(product.variants)) {
      return product.variants.every((variant) => Number(variant?.stock || 0) <= 0);
    }

    return true;
  }

  return Number(product.stock || 0) <= 0;
}

export function sortProductsInStockFirst(products = []) {
  return [...products].sort((left, right) => {
    const leftOutOfStock = Number(isProductOutOfStock(left));
    const rightOutOfStock = Number(isProductOutOfStock(right));

    if (leftOutOfStock !== rightOutOfStock) {
      return leftOutOfStock - rightOutOfStock;
    }

    const leftDate = new Date(left?.created_at || 0).getTime();
    const rightDate = new Date(right?.created_at || 0).getTime();

    return rightDate - leftDate;
  });
}
