(function() {
  document.addEventListener('DOMContentLoaded', function() {
    const form = document.querySelector('form');
    if (!form) return;
    
    const inlineGroups = Array.from(document.querySelectorAll('.inline-group'));
    const stockFieldset = document.querySelector('fieldset');
    
    if (inlineGroups.length === 0 || !stockFieldset) return;
    
    // Find the "is_active" field
    const isActiveField = document.getElementById('id_is_active');
    if (!isActiveField) return;
    
    const isActiveContainer = isActiveField.closest('.form-row');
    
    // Insert ProductImage inline right after is_active field
    if (isActiveContainer && inlineGroups[0]) {
      isActiveContainer.parentNode.insertAdjacentElement('afterend', inlineGroups[0]);
    }
  });
})();
