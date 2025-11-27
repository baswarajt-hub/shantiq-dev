"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function PaymentFailureContent() {
  return (
    <div className="p-6 flex justify-center">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <CardTitle className="text-red-600 text-2xl">
            Payment Failed ❌
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Your payment could not be completed.
            <br />
            You may try booking again or choose the Pay at Clinic option.
          </p>

          <a
            href="/booking"
            className="w-full bg-red-500 text-white rounded-md p-3 text-center block"
          >
            Try Again
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
