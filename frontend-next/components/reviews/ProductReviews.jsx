"use client";

import { useAuth } from "@/context/AuthContext";
import { useGlobalToast } from "@/context/ToastContext";
import { deleteProductReview, getProductReviews, getReviewEligibility } from "@/lib/api";
import { BadgeCheck, Loader2, Star } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import ReviewForm from "./ReviewForm";
import StarRating from "./StarRating";

const PAGE_SIZE = 5;

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getPageItems(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [...new Set([1, total, current - 1, current, current + 1])]
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);
  const items = [];
  let prev = 0;
  for (const p of pages) {
    if (p - prev > 1) items.push("…");
    items.push(p);
    prev = p;
  }
  return items;
}

export default function ProductReviews({ productId }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { success, error: toastError } = useGlobalToast();

  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState(null);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingList, setLoadingList] = useState(true);

  const [eligibility, setEligibility] = useState(null);
  const [editingReview, setEditingReview] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const loadReviews = useCallback(
    async (nextPage) => {
      try {
        const offset = (nextPage - 1) * PAGE_SIZE;
        const data = await getProductReviews(productId, {
          limit: PAGE_SIZE,
          offset,
        });
        setReviews(data.reviews);
        setSummary(data.summary);
        setCount(data.count);
        setTotalPages(Math.max(1, Math.ceil(data.count / PAGE_SIZE)));
        setPage(nextPage);
      } catch {
        toastError("Could not load reviews.");
      } finally {
        setLoadingList(false);
      }
    },
    [productId, toastError],
  );

  useEffect(() => {
    setLoadingList(true);
    loadReviews(1);
  }, [loadReviews]);

  useEffect(() => {
    if (!isAuthenticated) {
      setEligibility(null);
      return;
    }
    let cancelled = false;
    getReviewEligibility(productId)
      .then((data) => {
        if (!cancelled) setEligibility(data);
      })
      .catch(() => {
        if (!cancelled) setEligibility(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, productId]);

  const goToPage = (nextPage) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page || loadingList) return;
    setLoadingList(true);
    loadReviews(nextPage);
  };

  const openCreateForm = () => {
    setEditingReview(null);
    setShowForm(true);
  };

  const openEditForm = (review) => {
    setEditingReview(review);
    setShowForm(true);
  };

  const handleSubmitted = (newReview) => {
    setShowForm(false);
    setEditingReview(null);
    if (!newReview) return;
    setReviews((prev) => {
      if (eligibility?.review_id && eligibility.review_id !== newReview.id) {
        return [newReview, ...prev.filter((r) => r.id !== newReview.id)];
      }
      return prev.map((r) => (r.id === newReview.id ? newReview : r));
    });
    setEligibility((prev) => ({
      ...prev,
      has_reviewed: true,
      can_review: false,
      review_id: newReview.id ?? prev?.review_id,
    }));
    loadReviews(1);
  };

  const handleDelete = async (reviewId) => {
    setDeletingId(reviewId);
    try {
      const data = await deleteProductReview(reviewId);
      success(data.message || "Review deleted.");
      setReviews((prev) => prev.filter((r) => r.id !== reviewId));
      setEligibility((prev) => ({
        ...prev,
        has_reviewed: false,
        can_review: true,
        review_id: null,
      }));
      if (reviews.length - 1 === 0 && page > 1) {
        goToPage(page - 1);
      } else {
        loadReviews(page);
      }
    } catch (err) {
      toastError(err.message || "Could not delete review.");
    } finally {
      setDeletingId(null);
    }
  };

  const maxBar = summary?.distribution
    ? Math.max(1, ...Object.values(summary.distribution))
    : 1;

  const isEligible = eligibility?.can_review === true;

  const pageItems = getPageItems(page, totalPages);

  if (!loadingList && count === 0) {
    return (
      <section id="reviews" className="scroll-mt-28">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] border border-gray-200 bg-[#fffdf8] px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-gray-500">
              Customer Reviews
            </p>
            <h2 className="mt-0.5 font-serif text-lg font-bold text-gray-900 sm:text-xl">
              Reviews (0)
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">No reviews yet.</p>
          </div>

          {!authLoading && isEligible && (
            <button
              type="button"
              onClick={openCreateForm}
              className="rounded-full bg-[#1C1917] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#002424]"
            >
              Write a review
            </button>
          )}
        </div>

        {showForm && (
          <div className="mt-4">
            <ReviewForm
              productId={productId}
              review={editingReview}
              onCancel={() => {
                setShowForm(false);
                setEditingReview(null);
              }}
              onSubmitted={handleSubmitted}
            />
          </div>
        )}
      </section>
    );
  }

  return (
    <section id="reviews" className="scroll-mt-28">
      <div className="rounded-[1.75rem] border border-gray-200 bg-[#fffdf8] p-6 shadow-[0_25px_70px_rgba(15,23,42,0.06)] sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-gray-500">
              Customer Reviews
            </p>
            <h2 className="mt-1 font-serif text-2xl font-bold text-gray-900 sm:text-4xl">
              {loadingList ? "Loading reviews…" : `Reviews (${count})`}
            </h2>
          </div>

          {!authLoading && isEligible && (
            <button
              type="button"
              onClick={openCreateForm}
              className="rounded-full bg-[#1C1917] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#002424]"
            >
              Write a review
            </button>
          )}
        </div>

        {isAuthenticated &&
          eligibility?.has_reviewed &&
          !showForm &&
          !eligibility?.can_review && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-emerald-50 px-4 py-3">
              <p className="flex items-center gap-2 text-sm font-medium text-emerald-800">
                <BadgeCheck size={18} />
                You reviewed this product.
              </p>
              <button
                type="button"
                onClick={() =>
                  openEditForm(
                    reviews.find((r) => r.id === eligibility.review_id) || {
                      id: eligibility.review_id,
                      rating: 0,
                    },
                  )
                }
                className="text-sm font-bold text-[#002424] underline underline-offset-2"
              >
                Edit review
              </button>
            </div>
          )}

        {showForm && (
          <div className="mt-6">
            <ReviewForm
              productId={productId}
              review={editingReview}
              onCancel={() => {
                setShowForm(false);
                setEditingReview(null);
              }}
              onSubmitted={handleSubmitted}
            />
          </div>
        )}

        {summary && summary.total_count > 0 && (
          <div className="mt-8 grid gap-6 sm:grid-cols-[auto_1fr]">
            <div className="text-center sm:pr-8 sm:text-left">
              <p className="font-serif text-5xl font-bold text-gray-900">
                {summary.average_rating ?? "—"}
              </p>
              <div className="mt-2 flex justify-center sm:justify-start">
                <StarRating value={Math.round(summary.average_rating || 0)} size="h-5 w-5" />
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Based on {summary.total_count}{" "}
                {summary.total_count === 1 ? "review" : "reviews"}
              </p>
            </div>

            <div className="space-y-1.5">
              {[5, 4, 3, 2, 1].map((rating) => {
                const ratingCount = summary.distribution?.[rating] || 0;
                const pct = Math.round((ratingCount / summary.total_count) * 100);
                return (
                  <div key={rating} className="flex items-center gap-3">
                    <span className="w-8 shrink-0 text-sm font-medium text-gray-600">
                      {rating} <Star size={12} className="inline fill-[#D4A373] text-[#D4A373]" />
                    </span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#E7E5E4]">
                      <div
                        className="h-full rounded-full bg-[#D4A373] transition-all duration-500"
                        style={{ width: `${(ratingCount / maxBar) * 100}%` }}
                      />
                    </div>
                    <span className="w-10 shrink-0 text-right text-xs text-gray-500">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-8 divide-y divide-[#E7E5E4]">
          {loadingList ? (
            <div className="flex items-center justify-center gap-2 py-16 text-gray-500">
              <Loader2 size={20} className="animate-spin opacity-50" />
              <span className="text-sm">Loading reviews…</span>
            </div>
          ) : reviews.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500">
              <p>No reviews yet.</p>
            </div>
          ) : (
            reviews.map((review) => (
              <article key={review.id} className="py-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FAFAF9] shadow-[inset_0_0_0_1px_#E7E5E4]">
                      <span className="font-serif text-base font-bold text-gray-700">
                        {(review.user_name || "U").charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                        {review.user_name}
                        {review.is_verified_purchase && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                            <BadgeCheck size={12} />
                            Verified Purchase
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">{formatDate(review.created_at)}</p>
                    </div>
                  </div>
                  <StarRating value={review.rating} size="h-4 w-4" />
                </div>

                {review.title && (
                  <h3 className="mt-3 font-serif text-lg font-bold text-gray-900">{review.title}</h3>
                )}
                {review.comment && (
                  <p className="mt-1 text-sm leading-relaxed text-gray-700">{review.comment}</p>
                )}

                {isAuthenticated &&
                  eligibility?.has_reviewed &&
                  eligibility?.review_id === review.id && (
                    <div className="mt-3 flex items-center gap-4 text-sm">
                      <button
                        type="button"
                        onClick={() => openEditForm(review)}
                        className="font-bold text-[#002424] underline underline-offset-2"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === review.id}
                        onClick={() => handleDelete(review.id)}
                        className="font-bold text-red-600 underline underline-offset-2 disabled:opacity-50"
                      >
                        {deletingId === review.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  )}
              </article>
            ))
          )}
        </div>

        {totalPages > 1 && !loadingList && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-1.5">
            <button
              type="button"
              onClick={() => goToPage(page - 1)}
              disabled={page === 1}
              aria-label="Previous page"
              className="h-9 min-w-9 rounded-full border border-[#E7E5E4] bg-white px-3 text-sm font-semibold text-gray-900 transition hover:bg-[#FAFAF9] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Prev
            </button>

            {pageItems.map((item, index) =>
              item === "…" ? (
                <span key={`ellipsis-${index}`} className="px-1 text-sm text-gray-400">
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => goToPage(item)}
                  aria-current={item === page ? "page" : undefined}
                  className={`h-9 min-w-9 rounded-full px-3 text-sm font-semibold transition ${
                    item === page
                      ? "bg-[#1C1917] text-white"
                      : "border border-[#E7E5E4] bg-white text-gray-900 hover:bg-[#FAFAF9]"
                  }`}
                >
                  {item}
                </button>
              ),
            )}

            <button
              type="button"
              onClick={() => goToPage(page + 1)}
              disabled={page === totalPages}
              aria-label="Next page"
              className="h-9 min-w-9 rounded-full border border-[#E7E5E4] bg-white px-3 text-sm font-semibold text-gray-900 transition hover:bg-[#FAFAF9] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
