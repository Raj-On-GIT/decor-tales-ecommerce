document.addEventListener("DOMContentLoaded", function () {
  const categoryField = document.getElementById("id_category");
  const subCategoryField = document.getElementById("id_sub_category");

  if (!categoryField || !subCategoryField) return;

  // Store all options initially
  const allOptions = Array.from(subCategoryField.options);

  function filterSubCategories() {
    const selectedCategory =
      categoryField.options[categoryField.selectedIndex]?.text;

    // Reset dropdown
    subCategoryField.innerHTML = "";

    // Default blank option
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = "---------";
    subCategoryField.appendChild(blank);

    // Filter matching options
    allOptions.forEach((option) => {
      if (!option.value) return;

      if (option.text.startsWith(selectedCategory + " →")) {
        subCategoryField.appendChild(option.cloneNode(true));
      }
    });
  }

  // Run once on load
  filterSubCategories();

  // Run on category change
  categoryField.addEventListener("change", filterSubCategories);
});
