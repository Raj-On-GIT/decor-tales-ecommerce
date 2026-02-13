(function() {
  document.addEventListener('DOMContentLoaded', function() {
    const stockTypeRadios = document.querySelectorAll('input[name="stock_type"]');
    const stockField = document.querySelector('#id_stock')?.closest('.fieldBox');
    const variantInline = document.querySelector('[id*="productvariant"]')?.closest('.inline-group');
    const imageInline = document.querySelector('[id*="productimage"]')?.closest('.inline-group');

    function toggleInlines() {
      const selectedType = document.querySelector('input[name="stock_type"]:checked')?.value;
      
      if (selectedType === 'main') {
        // Show stock field, hide variants inline
        if (stockField) stockField.style.display = 'block';
        if (variantInline) variantInline.style.display = 'none';
        if (imageInline) imageInline.style.display = 'block';
      } else if (selectedType === 'variants') {
        // Hide stock field, show variants inline
        if (stockField) stockField.style.display = 'none';
        if (variantInline) variantInline.style.display = 'block';
        if (imageInline) imageInline.style.display = 'block';
      }
    }

    // Initial call
    toggleInlines();

    // Listen for radio button changes
    stockTypeRadios.forEach(radio => {
      radio.addEventListener('change', toggleInlines);
    });
  });
})();

