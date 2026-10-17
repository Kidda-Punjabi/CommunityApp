"use client";

import { useEffect, useState } from "react";

const APPEAR_AFTER_MS = 150;

let startedAt = 0;
let mounts = 0;

export function armPageSpinner() {
  if (startedAt === 0) startedAt = Date.now();
}

function noteMount() {
  mounts += 1;
  armPageSpinner();
}

function noteUnmount() {
  mounts -= 1;
  queueMicrotask(() => {
    if (mounts <= 0) {
      mounts = 0;
      startedAt = 0;
    }
  });
}

function waitToAppear(): number {
  if (startedAt === 0) return APPEAR_AFTER_MS;
  return Math.max(0, APPEAR_AFTER_MS - (Date.now() - startedAt));
}

export function Spinner({ size = 32 }: { size?: number }) {
  const stroke = size <= 16 ? 2 : 3;
  const radius = (size - stroke) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const arc = circumference * 0.28;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="page-spinner-ring"
      aria-hidden="true"
    >
      <circle cx={center} cy={center} r={radius} fill="none" stroke="#EDE7FE" strokeWidth={stroke} />
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="#7C3AED"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${arc} ${circumference - arc}`}
      />
    </svg>
  );
}

export function InlineSpinner() {
  return (
    <span className="inline-flex shrink-0" role="status">
      <Spinner size={16} />
      <span className="sr-only">Loading</span>
    </span>
  );
}

export function PageSpinner({
  fullscreen = false,
  overlay = false,
}: {
  fullscreen?: boolean;
  overlay?: boolean;
}) {
  const [visible, setVisible] = useState(fullscreen);

  useEffect(() => {
    noteMount();
    if (fullscreen) return () => noteUnmount();
    const wait = waitToAppear();
    if (wait === 0) {
      setVisible(true);
      return () => noteUnmount();
    }
    const timer = window.setTimeout(() => setVisible(true), wait);
    return () => {
      window.clearTimeout(timer);
      noteUnmount();
    };
  }, [fullscreen]);

  if (overlay && !visible) return null;

  const position = fullscreen
    ? "fixed inset-0 z-40 bg-[#F7F5FC]"
    : overlay
      ? "absolute inset-0 z-20 bg-[#F7F5FC]"
      : "min-h-[50vh] w-full flex-1";

  return (
    <div
      role="status"
      aria-hidden={visible ? undefined : true}
      className={`flex items-center justify-center ${position}`}
      style={{ visibility: visible ? "visible" : "hidden" }}
    >
      <Spinner />
      <span className="sr-only">Loading</span>
    </div>
  );
}
