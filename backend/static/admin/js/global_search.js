(function () {
  'use strict';

  var root = document.getElementById('global-search');
  if (!root) {
    return;
  }

  var apiUrl = root.getAttribute('data-api-url');
  var form = root.querySelector('#global-search-form');
  var input = root.querySelector('#global-search-input');
  var resultsList = root.querySelector('#global-search-results');

  var MIN_QUERY_LENGTH = 2;
  var DEBOUNCE_MS = 250;

  var timer = null;
  var controller = null;
  var items = [];
  var activeIndex = -1;
  var currentQuery = '';
  var itemCounter = 0;

  function hide() {
    activeIndex = -1;
    items = [];
    resultsList.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }

  function show() {
    resultsList.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function render(groups) {
    resultsList.textContent = '';
    items = [];
    itemCounter = 0;

    if (!groups || groups.length === 0) {
      var empty = document.createElement('li');
      empty.className = 'global-search-empty';
      empty.textContent = 'No matches';
      resultsList.appendChild(empty);
      show();
      return;
    }

    groups.forEach(function (group) {
      var header = document.createElement('li');
      header.className = 'global-search-group-label';

      var label = document.createElement('span');
      label.textContent = group.label;
      header.appendChild(label);

      if (group.changelist_url) {
        var link = document.createElement('a');
        link.href = group.changelist_url + '?q=' + encodeURIComponent(currentQuery);
        link.textContent = 'View all';
        header.appendChild(link);
      }
      resultsList.appendChild(header);

      group.results.forEach(function (result) {
        var li = document.createElement('li');
        li.className = 'global-search-item';
        li.id = 'global-search-item-' + itemCounter;
        li.setAttribute('role', 'option');

        var anchor = document.createElement('a');
        anchor.href = result.url;
        anchor.textContent = result.label;
        li.appendChild(anchor);

        resultsList.appendChild(li);
        items.push({ element: li, href: result.url });
        itemCounter += 1;
      });
    });

    show();
  }

  function search() {
    var query = input.value.trim();
    if (query.length < MIN_QUERY_LENGTH) {
      if (controller) {
        controller.abort();
      }
      hide();
      return;
    }

    if (controller) {
      controller.abort();
    }
    controller = new AbortController();

    fetch(apiUrl + '?q=' + encodeURIComponent(query), {
      headers: { 'Accept': 'application/json' },
      credentials: 'same-origin',
      signal: controller.signal
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Unexpected status ' + response.status);
        }
        return response.json();
      })
      .then(function (data) {
        currentQuery = query;
        render(data.groups || []);
      })
      .catch(function (err) {
        if (err && err.name === 'AbortError') {
          return;
        }
        hide();
      });
  }

  function move(step) {
    if (items.length === 0) {
      return;
    }
    activeIndex += step;
    if (activeIndex < 0) {
      activeIndex = items.length - 1;
    }
    if (activeIndex >= items.length) {
      activeIndex = 0;
    }
    items.forEach(function (item, index) {
      var active = index === activeIndex;
      item.element.classList.toggle('global-search-active', active);
      if (active) {
        input.setAttribute('aria-activedescendant', item.element.id);
        item.element.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  input.addEventListener('input', function () {
    window.clearTimeout(timer);
    timer = window.setTimeout(search, DEBOUNCE_MS);
  });

  input.addEventListener('keydown', function (event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      move(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(-1);
    } else if (event.key === 'Enter') {
      if (activeIndex >= 0 && items[activeIndex]) {
        event.preventDefault();
        window.location.href = items[activeIndex].href;
      }
      // Without an active suggestion, let the form submit normally.
    } else if (event.key === 'Escape') {
      hide();
      input.removeAttribute('aria-activedescendant');
    }
  });

  resultsList.addEventListener('click', function () {
    hide();
  });

  document.addEventListener('click', function (event) {
    if (!root.contains(event.target)) {
      hide();
    }
  });

  form.addEventListener('submit', function () {
    hide();
  });
})();
