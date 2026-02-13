(function () {
  document.addEventListener("DOMContentLoaded", function () {

    // -------------------------------
    // ✅ STOCK TOGGLE
    // -------------------------------
    const stockTypeRadios = document.querySelectorAll(
      'input[name="stock_type"]'
    );

    // ✅ Only hide the stock input row (never hide full Stock Management)
    const stockField =
      document.getElementById("id_stock")?.closest(".form-row") ||
      document.getElementById("id_stock")?.closest(".form-group");

    // ✅ Correct variant inline selector (works for Add + Edit pages)
    const variantInline =
      document.querySelector("#productvariant_set-group") ||
      document.querySelector(".inline-group");

    // -------------------------------
    // ✅ CUSTOM IMAGE LIMIT TOGGLE
    // -------------------------------
    const customImageCheckbox = document.getElementById("id_allow_custom_image");

    const customLimitRow =
      document.querySelector(".form-row.field-custom_image_limit") ||
      document.querySelector(".form-group.field-custom_image_limit");

    function toggleCustomLimit() {
      if (!customImageCheckbox || !customLimitRow) return;

      console.log("Checkbox checked?", customImageCheckbox.checked);

      if (customImageCheckbox.checked) {
        customLimitRow.style.display = "block";
      } else {
        customLimitRow.style.display = "none";
      }
    }

    // ✅ Run once on load
    toggleCustomLimit();

    // ✅ Listen using BOTH click and change (Django-safe)
    customImageCheckbox.addEventListener("change", toggleCustomLimit);
    customImageCheckbox.addEventListener("click", toggleCustomLimit);

    // -------------------------------
    // ✅ MAIN VISIBILITY FUNCTION
    // -------------------------------
    function updateFieldVisibility() {

      // ✅ Stock field toggle
      const selectedType = document.querySelector(
        'input[name="stock_type"]:checked'
      )?.value;

      if (selectedType === "main") {
        if (stockField) stockField.style.display = "block";
        if (variantInline) variantInline.style.display = "none";
      }

      if (selectedType === "variants") {
        if (stockField) stockField.style.display = "none";
        if (variantInline) variantInline.style.display = "block";
      }

      // ✅ Custom image limit toggle
      toggleCustomLimit();
    }

    // ✅ Run once on page load
    updateFieldVisibility();

    // ✅ Listen stock radio changes
    stockTypeRadios.forEach((radio) => {
      radio.addEventListener("change", updateFieldVisibility);
    });

    // ✅ Listen custom image checkbox changes
    if (customImageCheckbox) {
      customImageCheckbox.addEventListener("change", toggleCustomLimit);
    }
    
  });
})();
