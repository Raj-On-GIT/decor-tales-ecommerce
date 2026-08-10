(function () {
  "use strict";

  function init() {
    var manager = document.querySelector(".js-image-manager");
    if (!manager) return;

    var listEl = manager.querySelector(".image-manager__list");
    var metaInput = manager.querySelector(".image-manager__meta");
    var fileInput = manager.querySelector(".image-manager__file-input");
    var emptyHint = manager.querySelector(".image-manager__empty");
    var form = manager.closest("form");
    if (!listEl || !metaInput || !fileInput) return;

    var MAX_SIZE = 12 * 1024 * 1024;
    var ALLOWED = ["jpg", "jpeg", "png", "webp"];
    var nextKey = 0;
    var fileByKey = {};
    var deletedIds = [];

    function escapeHtml(value) {
      return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function isValidFile(file) {
      var ext = (file.name.split(".").pop() || "").toLowerCase();
      if (ALLOWED.indexOf(ext) === -1) {
        window.alert(
          '"' + file.name + '" is not a supported image. Use JPG, PNG or WebP.'
        );
        return false;
      }
      if (file.size > MAX_SIZE) {
        window.alert('"' + file.name + '" is larger than 12MB.');
        return false;
      }
      return true;
    }

    function addRow(key, name, url, checked) {
      var li = document.createElement("li");
      li.className = "image-manager__row";
      li.dataset.key = key;
      li.setAttribute("draggable", "true");

      var radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "product_images_main";
      radio.value = key;
      radio.checked = !!checked;

      var label = document.createElement("label");
      label.className = "image-manager__radio";
      label.appendChild(radio);
      label.appendChild(document.createTextNode("Main"));

      var handle = document.createElement("span");
      handle.className = "image-manager__handle";
      handle.title = "Drag to reorder";
      handle.textContent = "⠿";

      var thumb = document.createElement("img");
      thumb.className = "image-manager__thumb";
      thumb.src = url;
      thumb.alt = "";

      var nameEl = document.createElement("span");
      nameEl.className = "image-manager__name";
      nameEl.textContent = name;

      var removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "image-manager__remove";
      removeBtn.title = "Remove image";
      removeBtn.textContent = "✕";

      li.appendChild(handle);
      li.appendChild(thumb);
      li.appendChild(nameEl);
      li.appendChild(label);
      li.appendChild(removeBtn);

      listEl.appendChild(li);
      return li;
    }

    function checkedRow() {
      return listEl.querySelector('input[name="product_images_main"]:checked');
    }

    function refreshMainClasses() {
      var rows = listEl.querySelectorAll(".image-manager__row");
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var input = row.querySelector('input[name="product_images_main"]');
        row.classList.toggle("image-manager__row--main", !!input && input.checked);
      }
    }

    function ensureMainChecked() {
      if (checkedRow()) return;
      var first = listEl.querySelector(".image-manager__row");
      if (first) {
        first.querySelector('input[name="product_images_main"]').checked = true;
      }
    }

    function saveState() {
      var order = [];
      var rows = listEl.querySelectorAll(".image-manager__row");
      for (var i = 0; i < rows.length; i++) {
        order.push(rows[i].dataset.key);
      }
      var checked = checkedRow();
      metaInput.value = JSON.stringify({
        order: order,
        main: checked ? checked.value : null,
        deleted: deletedIds,
      });
      if (emptyHint) emptyHint.style.display = order.length ? "none" : "";
    }

    function moveToFront(row) {
      if (listEl.firstChild === row) return;
      listEl.insertBefore(row, listEl.firstChild);
    }

    // ---------------------------------------------------------------
    // Initial render from server state
    // ---------------------------------------------------------------
    var state = {};
    var stateScript = document.getElementById("image-manager-state");
    if (stateScript) {
      try {
        state = JSON.parse(stateScript.textContent);
      } catch (e) {
        state = {};
      }
    }
    deletedIds = (state.deleted || []).slice();
    (state.rows || []).forEach(function (row) {
      var li = addRow(row.key, row.name, row.url, row.key === state.main);
      if (row.key === state.main) moveToFront(li);
    });
    ensureMainChecked();
    refreshMainClasses();
    saveState();

    // ---------------------------------------------------------------
    // Add files
    // ---------------------------------------------------------------
    fileInput.addEventListener("change", function () {
      var files = Array.prototype.slice.call(fileInput.files);
      files.forEach(function (file) {
        if (!isValidFile(file)) return;
        nextKey += 1;
        var key = "n" + nextKey;
        fileByKey[key] = file;
        var url = "";
        try {
          url = URL.createObjectURL(file);
        } catch (e) {
          url = "";
        }
        addRow(key, file.name, url, false);
      });
      fileInput.value = "";
      refreshMainClasses();
      saveState();
    });

    // ---------------------------------------------------------------
    // Main radio (exactly one; choosing a new main moves it to the top)
    // ---------------------------------------------------------------
    listEl.addEventListener("change", function (e) {
      if (e.target.name !== "product_images_main") return;
      var row = e.target.closest(".image-manager__row");
      if (row) moveToFront(row);
      refreshMainClasses();
      saveState();
    });

    // ---------------------------------------------------------------
    // Remove
    // ---------------------------------------------------------------
    listEl.addEventListener("click", function (e) {
      var btn = e.target.closest(".image-manager__remove");
      if (!btn) return;
      var row = btn.closest(".image-manager__row");
      if (!row) return;

      var key = row.dataset.key;
      var wasMain = row.querySelector('input[name="product_images_main"]').checked;

      if (key.indexOf("e") === 0) {
        var pk = parseInt(key.slice(1), 10);
        if (!isNaN(pk) && deletedIds.indexOf(pk) === -1) deletedIds.push(pk);
      } else if (fileByKey[key]) {
        delete fileByKey[key];
      }

      row.remove();
      if (wasMain) {
        ensureMainChecked();
        var newMain = checkedRow();
        if (newMain) moveToFront(newMain.closest(".image-manager__row"));
      }
      refreshMainClasses();
      saveState();
    });

    // ---------------------------------------------------------------
    // Drag & drop reorder (main row is pinned first)
    // ---------------------------------------------------------------
    function getDragAfterElement(y) {
      var rows = listEl.querySelectorAll(
        ".image-manager__row:not(.image-manager__row--main)"
      );
      var closest = { offset: -Infinity, element: null };
      for (var i = 0; i < rows.length; i++) {
        var box = rows[i].getBoundingClientRect();
        var offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
          closest = { offset: offset, element: rows[i] };
        }
      }
      return closest.element;
    }

    function currentDragging() {
      return listEl.querySelector(".image-manager__row.dragging");
    }

    listEl.addEventListener("dragstart", function (e) {
      var row = e.target.closest(".image-manager__row");
      if (!row || row.classList.contains("image-manager__row--main")) {
        e.preventDefault();
        return;
      }
      row.classList.add("dragging");
      try {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", row.dataset.key);
      } catch (err) {}
    });

    listEl.addEventListener("dragover", function (e) {
      e.preventDefault();
      var dragging = currentDragging();
      if (!dragging) return;
      var afterEl = getDragAfterElement(e.clientY);
      if (afterEl === dragging || afterEl === dragging.nextSibling) return;
      if (afterEl === null) {
        listEl.appendChild(dragging);
      } else {
        listEl.insertBefore(dragging, afterEl);
      }
    });

    listEl.addEventListener("drop", function (e) {
      e.preventDefault();
      var dragging = currentDragging();
      if (dragging) dragging.classList.remove("dragging");
      saveState();
    });

    listEl.addEventListener("dragend", function () {
      var dragging = currentDragging();
      if (dragging) dragging.classList.remove("dragging");
      saveState();
    });

    // ---------------------------------------------------------------
    // Submit — serialize order/main/deletes and inject real file inputs.
    // Runs in the capture phase so it happens BEFORE product_form_progress.js
    // snapshots the form into FormData.
    // ---------------------------------------------------------------
    function onSubmit() {
      if (!form) return;
      form
        .querySelectorAll('input[name="product_image_new_files"]')
        .forEach(function (input) {
          input.remove();
        });

      saveState();
      var parsed = {};
      try {
        parsed = JSON.parse(metaInput.value);
      } catch (e) {
        return;
      }

      (parsed.order || []).forEach(function (key) {
        if (key.indexOf("n") !== 0) return;
        var file = fileByKey[key];
        if (!file) return;

        var input = document.createElement("input");
        input.type = "file";
        input.name = "product_image_new_files";
        try {
          var dt = new DataTransfer();
          dt.items.add(file);
          input.files = dt.files;
        } catch (err) {
          return;
        }
        form.appendChild(input);
      });
    }

    if (form) form.addEventListener("submit", onSubmit, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
