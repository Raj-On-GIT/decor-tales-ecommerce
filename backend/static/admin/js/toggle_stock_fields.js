document.addEventListener("DOMContentLoaded", function () {
  // -----------------------------
  // Stock Type Radios
  // -----------------------------
  const stockTypeRadios = document.querySelectorAll('input[name="stock_type"]');

  // -----------------------------
  // Main Product Fields
  // -----------------------------
  const stockField = document.getElementById("id_stock");
  const mrpField = document.getElementById("id_mrp");
  const slashedField = document.getElementById("id_slashed_price");
  const discountField = document.getElementById("id_discount_percent");

  if (!stockField || !mrpField || !slashedField || !discountField) return;

  // Field Rows
  const stockRow = stockField.closest(".form-row");
  const mrpRow = mrpField.closest(".form-row");
  const slashedRow = slashedField.closest(".form-row");
  const discountRow = discountField.closest(".form-row");

  // Variant Inline Section
  let variantInline = document.querySelector(".inline-group");

  // ==================================================
  // ✅ Helper Functions (Main Product)
  // ==================================================

  function roundFieldValue(field) {
    if (!field || !field.value) return;

    let value = parseFloat(field.value);

    if (!isNaN(value)) {
      field.value = Math.round(value);
    }
  }


  function updateDiscountFromSlashed() {
    let mrp = parseFloat(mrpField.value);
    let slashed = parseFloat(slashedField.value);

    if (!mrp || !slashed || slashed >= mrp) {
      discountField.value = "";
      return;
    }

    slashed = Math.round(slashed);
    let percent = Math.round(((mrp - slashed) / mrp) * 100);
    discountField.value = percent;
    slashedField.value = slashed;

    discountField.value = percent;
  }

  function updateSlashedFromDiscount() {
    let mrp = parseFloat(mrpField.value);
    let percent = parseFloat(discountField.value);

    if (!mrp || !percent || percent <= 0 || percent >= 100) {
      return;
    }

    let slashed = mrp - (mrp * percent) / 100;
    slashed = Math.round(slashed);

    slashedField.value = slashed;
  }

  // ==================================================
  // ✅ Toggle Fields Based on Stock Type
  // ==================================================

  function toggleFields() {
    const selected = document.querySelector(
      'input[name="stock_type"]:checked',
    )?.value;

    // Hide all by default
    stockRow.style.display = "none";
    mrpRow.style.display = "none";
    slashedRow.style.display = "none";
    discountRow.style.display = "none";

    if (variantInline) variantInline.style.display = "none";

    // ✅ Main Stock → Show pricing + stock
    if (selected === "main") {
      stockRow.style.display = "block";
      mrpRow.style.display = "block";
      slashedRow.style.display = "block";
      discountRow.style.display = "block";
    }

    // ✅ Variant Stock → Show inline variants only
    if (selected === "variants") {
      if (variantInline) variantInline.style.display = "block";
    }
  }

  // Run toggle once at load
  toggleFields();

  // Run toggle on radio change
  stockTypeRadios.forEach((radio) =>
    radio.addEventListener("change", toggleFields),
  );

  // ==================================================
  // ✅ Auto Discount Sync (Main Product Only)
  // ==================================================

  // Slashed Price → update Discount %
  slashedField.addEventListener("input", function () {
    updateDiscountFromSlashed();
  });

  // Discount % → update Slashed Price
  discountField.addEventListener("input", function () {
    updateSlashedFromDiscount();
  });

  // MRP change → update whichever exists
  mrpField.addEventListener("input", function () {
    if (slashedField.value) {
      updateDiscountFromSlashed();
    }

    if (discountField.value) {
      updateSlashedFromDiscount();
    }
  });

  // ==================================================
  // ✅ VARIANT INLINE: Discount Auto Sync
  // ==================================================

  function setupVariantRow(row) {
    const mrpInput = row.querySelector('input[name$="-mrp"]');
    const slashedInput = row.querySelector('input[name$="-slashed_price"]');
    const discountInput = row.querySelector('input[name$="-discount_percent"]');

    if (!mrpInput || !slashedInput || !discountInput) return;

    if (row.dataset.syncAttached) return;
    row.dataset.syncAttached = "true";

    [mrpInput, slashedInput].forEach((field) => {
      field.addEventListener("blur", function () {
        roundFieldValue(field);
      });
    });


    // ✅ Update Discount % from Slashed Price
    function updateDiscount() {
      let mrp = parseFloat(mrpInput.value);
      let slashed = Math.round(parseFloat(slashedInput.value));
      slashedInput.value = slashed;


      if (!mrp || !slashed || slashed >= mrp) {
        discountInput.value = "";
        return;
      }

      let percent = Math.round(((mrp - slashed) / mrp) * 100);
      discountInput.value = percent;
    }

    // ✅ Update Slashed Price from Discount %
    function updateSlashed() {
      let mrp = parseFloat(mrpInput.value);
      let percent = parseFloat(discountInput.value);

      if (!mrp || !percent || percent <= 0 || percent >= 100) return;

      let slashed = mrp - (mrp * percent) / 100;
      slashedInput.value = Math.round(slashed);
    }

    // ✅ Listeners
    slashedInput.addEventListener("input", updateDiscount);
    discountInput.addEventListener("input", updateSlashed);

    // ✅ MRP Change Updates Both
    mrpInput.addEventListener("input", function () {
      if (slashedInput.value) updateDiscount();
      if (discountInput.value) updateSlashed();
    });
  }

    // ==================================================
    // ✅ VARIANT INLINE SYNC (Final Working Version)
    // ==================================================

    function bindVariantRows() {

    // ✅ All existing variant rows
    const rows = document.querySelectorAll(
        ".inline-group tbody tr.form-row:not(.empty-form)"
    );

    rows.forEach((row) => {
        setupVariantRow(row);
    });
    }

    // ✅ Run once on page load
    bindVariantRows();

    // ✅ Re-run whenever user clicks "Add another"
    document.addEventListener("click", function (e) {

    if (e.target && e.target.closest(".add-row")) {

        // Wait for Django to insert the new row
        setTimeout(() => {
        bindVariantRows();
        }, 200);

    }
    });

    // Force rounding on blur
    [mrpField, slashedField].forEach((field) => {
      field.addEventListener("blur", function () {
        roundFieldValue(field);
      });
    });

    // Also round while typing
    [mrpField, slashedField].forEach((field) => {
      field.addEventListener("input", function () {
        roundFieldValue(field);
      });
    });




});
