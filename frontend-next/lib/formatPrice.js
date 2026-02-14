export function formatPrice(price) {
  if (!price) return "0";

  const num = Number(price);

  // Formatter for Indian numbering system
  const formatIndian = (value) => {
    const parts = value.toString().split(".");

    let integerPart = parts[0];
    const decimalPart = parts[1] ? "." + parts[1] : "";

    // Indian comma placement
    const lastThree = integerPart.slice(-3);
    const otherNumbers = integerPart.slice(0, -3);

    if (otherNumbers !== "") {
      integerPart =
        otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") +
        "," +
        lastThree;
    } else {
      integerPart = lastThree;
    }

    return integerPart + decimalPart;
  };

  // If whole number → remove decimals
  if (num % 1 === 0) {
    return formatIndian(num);
  }

  // Otherwise keep up to 2 decimals
  return formatIndian(num.toFixed(2));
}
