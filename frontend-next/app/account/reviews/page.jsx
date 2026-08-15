"use client";

import { useAuth } from "@/context/AuthContext";
import { useGlobalToast } from "@/context/ToastContext";
import {
  deleteProductReview,
  getMyReviews,
  updateProductReview,
} from "@/lib/api";
import { BadgeCheck, Loader2, MessageSquare, PencilLine, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import StarRating from "@/components/reviews/StarRating";

const PAGE_SIZE = 10;

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function MyReviewsPage() {
  const { isAuthenticated, loading: authLoading, isLoggingOut } = useAuth();
  const router = useRouter();
  const { success, error: toastError } = useGlobalToast();

  const [reviews, setReviews] = useState([]);
  const [count, setCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ rating: 0, title: "", comment: "" });
  const [savingId, setSavingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const loadReviews = useCallback(
    async (nextOffset, append = false) => {
      try {
        const data = await getMyReviews({ limit: PAGE_SIZE, offset: nextOffset });
        setReviews((prev) => (append ? [...prev, ...data.reviews] : data.reviews));
        setCount(data.count);
        setHasMore(data.has_more);
        setOffset(nextOffset + data.reviews.length);
      } catch {
        toastError("Could not load your reviews.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [toastError],
  );

  useEffect(() => {
    if (!authLoading && !isAuthenticated && !isLoggingOut) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, isLoggingOut, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadReviews(0, false);
    }
  }, [isAuthenticated, loadReviews]);

  const startEditing = (review) => {
    setEditingId(review.id);
    setEditForm({ rating: review.rating, title: review.title || "", comment: review.comment || "" });
  };

  const saveEdit = async (review) => {
    if (!editForm.rating) {
      toastError("Please select a star rating.");
      return;
    }
    setSavingId(review.id);
    try {
      const data = await updateProductReview(review.id, editForm);
      success(data.message || "Review updated.");
      setReviews((prev) =>
        prev.map((r) => (r.id === review.id ? { ...r, ...data.review } : r)),
      );
      setEditingId(null);
    } catch (err) {
      toastError(err.message || "Could not update review.");
    } finally {
      setSavingId(null);
    }
  };

  const confirmDelete = async (review) => {
    if (!window.confirm("Delete this review? This cannot be undone.")) return;
    setDeletingId(review.id);
    try {
      const data = await deleteProductReview(review.id);
      success(data.message || "Review deleted.");
      setReviews((prev) => prev.filter((r) => r.id !== review.id));
      setCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      toastError(err.message || "Could not delete review.");
    } finally {
      setDeletingId(null);
    }
  };

  const loadMore = () => {
    setLoadingMore(true);
    loadReviews(offset, true);
  };

  return (
    <div className="rounded-[1.75rem] border border-gray-200 bg-[#fffdf8] p-6 shadow-[0_25px_70px_rgba(15,23,42,0.06)] sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.26em] text-gray-500">
        My Account
      </p>
      <h1 className="mt-1 font-serif text-2xl font-bold text-gray-900 sm:text-4xl">
        My Reviews
      </h1>
      <p className="mt-2 text-sm text-gray-600">
        {loading
          ? "Loading your reviews…"
          : `${count} ${count === 1 ? "review" : "reviews"} on the products you bought.`}
      </p>

      <div className="mt-6 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-500">
            <Loader2 size={20} className="animate-spin opacity-50" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : reviews.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <MessageSquare size={36} className="mx-auto mb-3 opacity-25" />
            <p>You have not written any reviews yet.</p>
            <Link
              href="/"
              className="mt-4 inline-block rounded-full bg-[#1C1917] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#002424]"
            >
              Shop products
            </Link>
          </div>
        ) : (
          reviews.map((review) => {
            const isEditing = editingId === review.id;
            return (
              <div
                key={review.id}
                className="flex gap-4 rounded-[1.5rem] border border-gray-200 bg-white p-5"
              >
                <Link
                  href={`/products/${review.product_id}`}
                  className="shrink-0"
                >
                  <div className="relative h-20 w-20 overflow-hidden rounded-xl border border-gray-200 bg-[#FAFAF9]">
                    {review.product_image ? (
                      <Image
                        src={review.product_image}
                        alt={review.product_title}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xl text-gray-300">
                        ✦
                      </div>
                    )}
                  </div>
                </Link>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link
                      href={`/products/${review.product_id}`}
                      className="font-serif text-base font-bold text-gray-900 transition hover:text-[#002424]"
                    >
                      {review.product_title}
                    </Link>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">
                        {formatDate(review.created_at)}
                      </span>
                      {review.is_verified_purchase && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                          <BadgeCheck size={12} />
                          Verified
                        </span>
                      )}
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="mt-3 space-y-3">
                      <div className="flex items-center gap-2">
                        <StarRating
                          value={editForm.rating}
                          onChange={(rating) =>
                            setEditForm((f) => ({ ...f, rating }))
                          }
                          size="h-6 w-6"
                        />
                      </div>
                      <input
                        type="text"
                        value={editForm.title}
                        maxLength={150}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, title: e.target.value }))
                        }
                        placeholder="Review title (optional)"
                        className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-black"
                      />
                      <textarea
                        value={editForm.comment}
                        rows={3}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, comment: e.target.value }))
                        }
                        placeholder="Share your experience (optional)"
                        className="w-full resize-none rounded-2xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-black"
                      />
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          disabled={savingId === review.id}
                          onClick={() => saveEdit(review)}
                          className="inline-flex items-center gap-2 rounded-full bg-[#1C1917] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#002424] disabled:opacity-60"
                        >
                          {savingId === review.id && (
                            <Loader2 size={14} className="animate-spin" />
                          )}
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="text-sm font-semibold text-gray-600 transition hover:text-gray-900"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="mt-1 flex items-center gap-2">
                        <StarRating value={review.rating} size="h-4 w-4" />
                      </div>
                      {review.title && (
                        <p className="mt-2 font-serif text-base font-bold text-gray-900">
                          {review.title}
                        </p>
                      )}
                      {review.comment && (
                        <p className="mt-1 text-sm leading-relaxed text-gray-700">
                          {review.comment}
                        </p>
                      )}
                      <div className="mt-3 flex items-center gap-4 text-sm">
                        <button
                          type="button"
                          onClick={() => startEditing(review)}
                          className="inline-flex items-center gap-1.5 font-bold text-[#002424] underline underline-offset-2"
                        >
                          <PencilLine size={14} />
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === review.id}
                          onClick={() => confirmDelete(review)}
                          className="inline-flex items-center gap-1.5 font-bold text-red-600 underline underline-offset-2 disabled:opacity-50"
                        >
                          {deletingId === review.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {hasMore && !loading && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="rounded-full border border-gray-200 bg-white px-6 py-2.5 text-sm font-semibold text-gray-900 transition hover:bg-[#FAFAF9] disabled:opacity-60"
          >
            {loadingMore ? "Loading…" : "Load more reviews"}
          </button>
        </div>
      )}
    </div>
  );
}
