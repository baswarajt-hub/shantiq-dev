"use client";

import { Suspense } from "react";
import PaymentFailureContent from "./failure-content";

export default function PaymentFailurePage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Loading...</div>}>
      <PaymentFailureContent />
    </Suspense>
  );
}
