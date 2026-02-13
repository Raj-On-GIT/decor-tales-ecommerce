(function() {
  document.addEventListener('DOMContentLoaded', function() {
    const stockTypeRadios = document.querySelectorAll('input[name="stock_type"]');
    
    function getStockFieldContainer() {
      // Try multiple selectors to find the stock field
      const stockInput = document.getElementById('id_stock');
      if (!stockInput) return null;
      
      // Find the parent container (could be form-row or fieldBox depending on Django version)
      let container = stockInput.closest('.form-row');
      if (!container) container = stockInput.closest('.fieldBox');
      if (!container) container = stockInput.parentElement?.parentElement;
      
      return container;
    }

    function toggleStockField() {
      const selectedType = document.querySelector('input[name="stock_type"]:checked')?.value;
      const stockFieldContainer = getStockFieldContainer();
      
      if (!stockFieldContainer) {
        console.log('Stock field container not found');
        return;
      }
      
      if (selectedType === 'main') {
        stockFieldContainer.style.display = 'block';
      } else if (selectedType === 'variants') {
        stockFieldContainer.style.display = 'none';
      }
    }

    // Initial call on page load
    setTimeout(toggleStockField, 100);

    // Listen for radio button changes
    stockTypeRadios.forEach(radio => {
      radio.addEventListener('change', toggleStockField);
    });
  });
})();
