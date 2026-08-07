document.addEventListener("DOMContentLoaded", function () {
  var form = document.getElementById("product_form");
  if (!form || !window.FormData || !window.XMLHttpRequest) return;

  var lastSubmitButton = null;

  form
    .querySelectorAll('input[type="submit"], button[type="submit"]')
    .forEach(function (btn) {
      btn.addEventListener("click", function () {
        lastSubmitButton = btn;
      });
    });

  var overlay = null;
  var fill = null;
  var statusEl = null;

  function buildOverlay() {
    overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.55);" +
      "display:flex;align-items:center;justify-content:center;";

    var panel = document.createElement("div");
    panel.style.cssText =
      "background:#fff;border-radius:8px;padding:24px 32px;min-width:320px;max-width:90%;" +
      "box-shadow:0 8px 30px rgba(0,0,0,0.3);text-align:center;" +
      "font-family:system-ui,-apple-system,sans-serif;";

    var title = document.createElement("div");
    title.textContent = "Saving product…";
    title.style.cssText = "font-size:16px;font-weight:600;color:#333;margin-bottom:16px;";

    var track = document.createElement("div");
    track.style.cssText = "height:10px;background:#e2e3e5;border-radius:5px;overflow:hidden;";

    fill = document.createElement("div");
    fill.style.cssText = "height:100%;width:0%;background:#79aec8;transition:width 0.15s ease;";
    track.appendChild(fill);

    statusEl = document.createElement("div");
    statusEl.textContent = "Preparing…";
    statusEl.style.cssText = "margin-top:12px;font-size:13px;color:#666;";

    panel.appendChild(title);
    panel.appendChild(track);
    panel.appendChild(statusEl);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  }

  function setUploadProgress(percent) {
    fill.style.width = percent + "%";
    statusEl.textContent = "Uploading images… " + percent + "%";
  }

  function setProcessing() {
    fill.style.width = "100%";
    fill.style.background =
      "repeating-linear-gradient(90deg,#79aec8 0 12px,#5e90ad 12px 24px)";
    fill.style.backgroundSize = "48px 100%";
    fill.style.animation = "product-progress-stripes 1s linear infinite";

    var style = document.createElement("style");
    style.textContent =
      "@keyframes product-progress-stripes{from{background-position:0 0}" +
      "to{background-position:48px 0}}";
    document.head.appendChild(style);

    statusEl.textContent = "Processing images & saving…";
  }

  function hasFiles() {
    var inputs = form.querySelectorAll('input[type="file"]');
    for (var i = 0; i < inputs.length; i++) {
      if (inputs[i].files && inputs[i].files.length > 0) return true;
    }
    return false;
  }

  function setButtonsDisabled(disabled) {
    form
      .querySelectorAll('input[type="submit"], button[type="submit"]')
      .forEach(function (btn) {
        btn.disabled = disabled;
      });
  }

  function teardown() {
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    setButtonsDisabled(false);
  }

  form.addEventListener("submit", function (e) {
    var submitter =
      lastSubmitButton ||
      (e.submitter && e.submitter.type === "submit" ? e.submitter : null);

    e.preventDefault();
    buildOverlay();
    setButtonsDisabled(true);

    if (hasFiles()) {
      setUploadProgress(0);
    } else {
      setProcessing();
    }

    var data = new FormData(form);
    if (submitter && submitter.name) {
      data.append(submitter.name, submitter.value || "1");
    } else {
      data.append("_save", "1");
    }

    var xhr = new XMLHttpRequest();
    xhr.open("POST", form.action, true);
    xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");

    var csrf = form.querySelector('input[name="csrfmiddlewaretoken"]');
    if (csrf) {
      xhr.setRequestHeader("X-CSRFToken", csrf.value);
    }

    xhr.upload.onprogress = function (ev) {
      if (ev.lengthComputable && ev.total > 0) {
        setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
      } else {
        statusEl.textContent = "Uploading images…";
      }
    };

    xhr.upload.onload = function () {
      setProcessing();
    };

    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 400) {
        var html = xhr.responseText || "";
        if (html.indexOf("errorlist") !== -1 || html.indexOf("errornote") !== -1) {
          document.open();
          document.write(html);
          document.close();
          return;
        }
        window.location.href = xhr.responseURL || form.action;
        return;
      }
      teardown();
      window.alert(
        "Unable to save the product. Your data has been kept in the form — please try again."
      );
    };

    xhr.onerror = function () {
      teardown();
      window.alert(
        "Unable to save the product. Your data has been kept in the form — please try again."
      );
    };

    xhr.send(data);
  });
});
