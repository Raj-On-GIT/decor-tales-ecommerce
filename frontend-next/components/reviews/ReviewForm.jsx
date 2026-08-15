"use client";

import { useGlobalToast } from "@/context/ToastContext";
import { submitProductReview, updateProductReview } from "@/lib/api";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import StarRating from "./StarRating";

export default function ReviewForm({
  productId,
  review = null,
  onSubmitted,
  onCancel,
}) {
  const isEditing = Boolean(review);
  const { success, error: toastError } = useGlobalToast();

  const [rating, setRating] = useState(review?.rating || 0);
  const [title, setTitle] = useState(review?.title || "");
  const [comment, setComment] = useState(review?.comment || "");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!rating) {
      setError("Please select a star rating.");
      return;
    }

    setSubmitting(true);
    try {
      const result = isEditing
        ? await updateProductReview(review.id, { rating, title, comment })
        : await submitProductReview(productId, { rating, title, comment });

      success(result.message || (isEditing ? "Review updated." : "Review submitted."));
      if (onSubmitted) onSubmitted(result.review);
    } catch (err) {
      const message = err.message || "Something went wrong. Please try again.";
      setError(message);
      toastError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-[1.75rem] border border-gray-200 bg-[#fffdf8] p-6 shadow-[0_25px_70px_rgba(15,23,42,0.06)]"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-gray-500">
          {isEditing ? "Edit your review" : "Write a review"}
        </p>
        <h3 className="mt-1 font-serif text-xl font-bold text-gray-900">
          How was your experience?
        </h3>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StarRating value={rating} onChange={setRating} size="h-7 w-7" />
        <span className="text-xs text-gray-500">Tap a star to rate</span>
      </div>

      <div>
        <label
          htmlFor={`review-title-${productId}`}
          className="mb-1.5 block text-sm font-medium text-gray-700"
        >
          Title <span className="text-gray-400">(optional)</span>
        </label>
        <input
          id={`review-title-${productId}`}
          type="text"
          value={title}
          maxLength={150}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Short headline, e.g. 'Stunning craftsmanship'"
          className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-black"
        />
      </div>

      <div>
        <label
          htmlFor={`review-comment-${productId}`}
          className="mb-1.5 block text-sm font-medium text-gray-700"
        >
          Review <span className="text-gray-400">(optional)</span>
        </label>
        <textarea
          id={`review-comment-${productId}`}
          value={comment}
          rows={4}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Share a few words about the quality, finish, or delivery."
          className="w-full resize-none rounded-2xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-black"
        />
      </div>

      {error && (
        <p className="rounded-2xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-full bg-[#1C1917] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#002424] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting && <Loader2 size={16} className="animate-spin" />}
          {isEditing ? "Save changes" : "Submit review"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:text-gray-900"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
