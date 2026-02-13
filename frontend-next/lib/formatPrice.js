export function formatPrice(price) {
  if (!price) return "0";

  const num = Number(price);

  // If whole number → remove decimals
  if (num % 1 === 0) {
    return num.toString();
  }

  // Otherwise keep up to 2 decimals
  return num.toFixed(2);
}
