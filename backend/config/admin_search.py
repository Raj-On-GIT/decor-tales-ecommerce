"""
Global search for the Django admin site.

Searches across every registered admin model that is staff-visible and has
``search_fields`` configured, reusing each ModelAdmin's own
``get_search_results()`` so the semantics (icontains, ``^`` prefix, ``=``
exact, distinct handling) match the regular changelist search exactly.

The search surface is deliberately bounded: one capped query per model, a
curated exclude set, and per-request total caps keep this fast even as the
database grows. Models without ``search_fields`` are skipped entirely, so
adding ``search_fields`` to a ModelAdmin is all that is needed to make a new
entity discoverable here.
"""

from django.contrib import admin
from django.core.exceptions import FieldError
from django.http import JsonResponse
from django.shortcuts import render
from django.urls import reverse

GLOBAL_SEARCH_EXCLUDE = {
    # Low-signal child rows — searching them adds noise without much value.
    "orders.orderitem",
    "orders.orderitemimage",
    "orders.cartitemimage",
    "orders.couponusage",
    "products.productvariant",
    # System / plumbing models that are not useful to surface.
    "auth.group",
    "admin.logentry",
    "token_blacklist.outstandingtoken",
    "token_blacklist.blacklistedtoken",
}

PAGE_PER_MODEL_LIMIT = 8
PAGE_TOTAL_LIMIT = 40
API_PER_MODEL_LIMIT = 5
API_TOTAL_LIMIT = 20
MIN_QUERY_LENGTH = 2


def _searchable_model_admins(request):
    """Yield ``(model, model_admin)`` pairs eligible for global search."""
    registry = admin.site._registry
    for model, model_admin in registry.items():
        key = f"{model._meta.app_label}.{model._meta.model_name}"
        if key in GLOBAL_SEARCH_EXCLUDE:
            continue
        if not model_admin.has_module_permission(request):
            continue
        if not model_admin.has_view_permission(request):
            continue
        if not model_admin.get_search_fields(request):
            continue
        yield model, model_admin


def _search_model(request, model, model_admin, term, limit):
    """Run the model's own admin search, returning at most ``limit`` objects."""
    queryset = model_admin.get_queryset(request)
    try:
        results, use_distinct = model_admin.get_search_results(
            request, queryset, term
        )
        if use_distinct:
            results = results.distinct()
        if not results.query.order_by:
            results = results.order_by("-pk")
        return list(results[:limit])
    except FieldError:
        # A bad/unsupported lookup in some admin's search_fields must never
        # take down the whole global search.
        return []


def run_global_search(request, term, per_model_limit, total_limit):
    """
    Return grouped results across all searchable models.

    Each group is a dict with: model_key, verbose_name, verbose_name_plural,
    changelist_url, results (list of {label, url}), count and has_more.
    """
    term = (term or "").strip()
    if len(term) < MIN_QUERY_LENGTH:
        return []

    groups = []
    total = 0
    for model, model_admin in _searchable_model_admins(request):
        hits = _search_model(request, model, model_admin, term, per_model_limit)
        if not hits:
            continue

        app_label = model._meta.app_label
        model_name = model._meta.model_name
        change_pattern = f"admin:{app_label}_{model_name}_change"
        changelist_url = reverse(f"admin:{app_label}_{model_name}_changelist")

        results = [
            {
                "label": str(obj),
                "url": reverse(change_pattern, args=[obj.pk]),
            }
            for obj in hits
        ]
        groups.append(
            {
                "model_key": f"{app_label}.{model_name}",
                "verbose_name": model._meta.verbose_name,
                "verbose_name_plural": model._meta.verbose_name_plural,
                "changelist_url": changelist_url,
                "results": results,
                "count": len(results),
                "has_more": len(results) >= per_model_limit,
            }
        )
        total += len(results)
        if total >= total_limit:
            break

    return groups


def admin_global_search_view(request):
    """Server-rendered results page at ``/admin/search/``."""
    query = request.GET.get("q", "").strip()
    groups = run_global_search(
        request,
        query,
        per_model_limit=PAGE_PER_MODEL_LIMIT,
        total_limit=PAGE_TOTAL_LIMIT,
    )
    total_count = sum(group["count"] for group in groups)
    has_more = total_count >= PAGE_TOTAL_LIMIT or any(
        group["has_more"] for group in groups
    )

    context = {
        **admin.site.each_context(request),
        "title": "Global Search",
        "query": query,
        "groups": groups,
        "total_count": total_count,
        "has_more": has_more,
    }
    return render(request, "admin/global_search_results.html", context)


def admin_global_search_api(request):
    """JSON endpoint used by the header autocomplete at ``/admin/search/api/``."""
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    query = request.GET.get("q", "").strip()
    groups = run_global_search(
        request,
        query,
        per_model_limit=API_PER_MODEL_LIMIT,
        total_limit=API_TOTAL_LIMIT,
    )
    payload = [
        {
            "key": group["model_key"],
            "label": group["verbose_name_plural"],
            "changelist_url": group["changelist_url"],
            "results": group["results"],
        }
        for group in groups
    ]
    return JsonResponse({"query": query, "groups": payload})
