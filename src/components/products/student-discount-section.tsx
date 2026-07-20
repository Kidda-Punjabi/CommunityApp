"use client";

import { submitStudentDiscountRequest } from "@/app/courses/student-discount-actions";
import {
  STUDENT_DISCOUNT_FORMAT_LABELS,
  VERIFIED_DISCOUNT_SECTION_TITLE,
  VERIFIED_DISCOUNT_TYPE_LABELS,
  checkoutKeyForFormat,
  verifiedDiscountRequestLabel,
  type StudentDiscountCourseFormat,
  type VerifiedDiscountType,
} from "@/lib/student-discounts/constants";
import type { StudentDiscountRequestView } from "@/lib/student-discounts/types";
import { isCheckoutConfigured } from "@/lib/products/checkout";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { BuyButton } from "@/components/products/buy-button";
import { GroupCohortCheckout } from "@/components/products/group-cohort-checkout";
import { checkoutKeyRequiresCohortSelection } from "@/lib/group-purchase/client-keys";

type StudentDiscountSectionProps = {
  isLoggedIn: boolean;
  requests: StudentDiscountRequestView[];
};

function requestFor(
  requests: StudentDiscountRequestView[],
  format: StudentDiscountCourseFormat,
  discountType: VerifiedDiscountType
): StudentDiscountRequestView | undefined {
  return requests.find(
    (request) => request.courseFormat === format && request.discountType === discountType
  );
}

function StatusCard({ request }: { request: StudentDiscountRequestView }) {
  const label = verifiedDiscountRequestLabel(request.courseFormat, request.discountType);
  const checkoutKey = checkoutKeyForFormat(request.courseFormat);

  if (request.status === "pending") {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-semibold">{label} — under review</p>
        <p className="mt-1 text-amber-800">
          We&apos;re checking your evidence. We&apos;ll notify you when your discount is ready.
        </p>
      </div>
    );
  }

  if (request.status === "approved" && request.discountCode) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-4 text-sm text-green-900">
        <p className="font-semibold">{label} — approved</p>
        <p className="mt-1 text-green-800">Use this code at checkout:</p>
        <p className="mt-2 inline-flex rounded-full bg-white px-4 py-2 font-mono text-base font-bold tracking-wide text-violet-700 ring-1 ring-green-200">
          {request.discountCode}
        </p>
        <p className="mt-3 text-xs text-green-800">
          Enter the code on the Stripe checkout page when you buy the{" "}
          {STUDENT_DISCOUNT_FORMAT_LABELS[request.courseFormat].toLowerCase()}.
        </p>
        {isCheckoutConfigured(checkoutKey) && (
          <div className="mt-4">
            {checkoutKeyRequiresCohortSelection(checkoutKey) ? (
              <GroupCohortCheckout
                checkoutKey={checkoutKey}
                label={`Buy ${STUDENT_DISCOUNT_FORMAT_LABELS[request.courseFormat].toLowerCase()}`}
                configured
              />
            ) : (
              <BuyButton
                checkoutKey={checkoutKey}
                label={`Buy ${STUDENT_DISCOUNT_FORMAT_LABELS[request.courseFormat].toLowerCase()}`}
                configured
              />
            )}
          </div>
        )}
      </div>
    );
  }

  if (request.status === "rejected") {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
        <p className="font-semibold">{label} — not approved</p>
        {request.adminNotes ? (
          <p className="mt-1">{request.adminNotes}</p>
        ) : (
          <p className="mt-1">You can submit a new application below if you have updated evidence.</p>
        )}
      </div>
    );
  }

  return null;
}

export function StudentDiscountSection({ isLoggedIn, requests }: StudentDiscountSectionProps) {
  const router = useRouter();
  const [discountType, setDiscountType] = useState<VerifiedDiscountType>("student");
  const [courseFormat, setCourseFormat] = useState<StudentDiscountCourseFormat>("group");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const existingForSelection = useMemo(
    () => requestFor(requests, courseFormat, discountType),
    [requests, courseFormat, discountType]
  );

  const canApply = !existingForSelection || existingForSelection.status === "rejected";

  const evidenceLabel =
    discountType === "bluelight"
      ? "Upload your Blue Light Card"
      : "Upload student ID or proof of enrolment";

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const formData = new FormData(event.currentTarget);
    formData.set("course_format", courseFormat);
    formData.set("discount_type", discountType);

    startTransition(async () => {
      const result = await submitStudentDiscountRequest(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess(result.success ?? "Application submitted.");
      event.currentTarget.reset();
      router.refresh();
    });
  }

  return (
    <section className="mt-14" id="student-discount">
      <h2 className="text-center font-heading text-xl font-bold text-zinc-900">
        {VERIFIED_DISCOUNT_SECTION_TITLE}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-center text-sm text-zinc-600">
        Currently studying, or have a Blue Light Card? Apply with your student ID or Blue Light Card
        and we&apos;ll verify your eligibility for a discount on the group or 1-to-1 course.
      </p>

      <div className={`mx-auto mt-6 max-w-lg ${ui.stack}`}>
        {requests.length > 0 && (
          <div className="space-y-3">
            {requests.map((request) => (
              <StatusCard key={request.id} request={request} />
            ))}
          </div>
        )}

        {!isLoggedIn ? (
          <div className={`${ui.card} text-center`}>
            <p className="text-sm text-zinc-600">
              Sign in to apply for a student or Blue Light discount.
            </p>
            <Link
              href="/login?next=/courses/beginners%23student-discount"
              className={`mt-4 ${ui.btnSecondary}`}
            >
              Sign in to apply
            </Link>
          </div>
        ) : canApply ? (
          <form onSubmit={handleSubmit} className={ui.card}>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Apply for a discount
            </p>

            <fieldset className="mt-4">
              <legend className="text-sm font-medium text-zinc-700">Discount type</legend>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {(["student", "bluelight"] as const).map((type) => (
                  <label
                    key={type}
                    className={`cursor-pointer rounded-2xl border px-4 py-3 text-sm transition-colors ${
                      discountType === type
                        ? "border-violet-300 bg-violet-50 text-violet-900"
                        : "border-zinc-200 bg-white text-zinc-700 hover:border-violet-200"
                    }`}
                  >
                    <input
                      type="radio"
                      name="discount_type_choice"
                      value={type}
                      checked={discountType === type}
                      onChange={() => setDiscountType(type)}
                      className="sr-only"
                    />
                    <span className="font-semibold">{VERIFIED_DISCOUNT_TYPE_LABELS[type]}</span>
                    <p className="mt-1 text-xs text-zinc-500">
                      {type === "bluelight"
                        ? "NHS, emergency services & more"
                        : "Student ID or enrolment proof"}
                    </p>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="mt-5">
              <legend className="text-sm font-medium text-zinc-700">Course format</legend>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {(["group", "one_to_one"] as const).map((format) => (
                  <label
                    key={format}
                    className={`cursor-pointer rounded-2xl border px-4 py-3 text-sm transition-colors ${
                      courseFormat === format
                        ? "border-violet-300 bg-violet-50 text-violet-900"
                        : "border-zinc-200 bg-white text-zinc-700 hover:border-violet-200"
                    }`}
                  >
                    <input
                      type="radio"
                      name="course_format_choice"
                      value={format}
                      checked={courseFormat === format}
                      onChange={() => setCourseFormat(format)}
                      className="sr-only"
                    />
                    <span className="font-semibold">{STUDENT_DISCOUNT_FORMAT_LABELS[format]}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="mt-5">
              <label htmlFor="student-discount-evidence" className="text-sm font-medium text-zinc-700">
                {evidenceLabel}
              </label>
              <input
                id="student-discount-evidence"
                name="evidence"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                required
                className="mt-2 block w-full text-sm text-zinc-600 file:mr-3 file:rounded-full file:border-0 file:bg-violet-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-violet-700"
              />
              <p className="mt-2 text-xs text-zinc-500">JPG, PNG, WebP, or PDF · max 10 MB</p>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-green-700">{success}</p>}

            <button type="submit" disabled={pending} className={`mt-4 ${ui.btnPrimary}`}>
              {pending ? "Submitting…" : "Submit application"}
            </button>
          </form>
        ) : existingForSelection ? (
          <StatusCard request={existingForSelection} />
        ) : null}
      </div>
    </section>
  );
}
