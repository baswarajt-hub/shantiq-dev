"use client";

import { Suspense } from "react";
import PaymentSuccessContent from "./success-content";

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Loading...</div>}>
      <PaymentSuccessContent />
    </Suspense>
  );
}
