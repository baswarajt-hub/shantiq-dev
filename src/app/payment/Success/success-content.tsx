"use client";

import { useEffect, useState } from "react";
import { firestore } from "@/lib/firebase.client";
import { doc, getDoc } from "firebase/firestore";
import { useSearchParams } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function PaymentSuccessContent() {
  const params = useSearchParams();
  const patientId = params.get("patientId");

  const [loading, setLoading] = useState(true);
  const [appointment, setAppointment] = useState<any>(null);

  useEffect(() => {
    if (!patientId) return;

    const load = async () => {
      const snap = await getDoc(doc(firestore, "patients", patientId));
      if (snap.exists()) setAppointment(snap.data());
      setLoading(false);
    };

    load();
  }, [patientId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="w-10 h-10 animate-spin text-purple-600" />
      </div>
    );
  }

  if (!appointment) {
    return <p className="text-center mt-10">Appointment details not found.</p>;
  }

  return (
    <div className="p-6 flex justify-center">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <CardTitle className="text-green-600 text-2xl">
            Payment Successful 🎉
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <p>Your booking is confirmed.</p>

          <div className="border rounded-lg p-4 space-y-2 bg-green-50">
            <p><strong>Patient:</strong> {appointment.patientName}</p>
            <p><strong>Purpose:</strong> {appointment.purpose}</p>
            <p><strong>Appointment Time:</strong> {appointment.appointmentTime}</p>
            <p><strong>Token No:</strong> {appointment.tokenNo}</p>
            <p><strong>Payment Status:</strong> {appointment.paymentStatus}</p>
            <p><strong>Transaction ID:</strong> {appointment.paymentTransactionId}</p>
          </div>

          <a
            href={`/queue-status?id=${patientId}`}
            className="w-full bg-purple-600 text-white rounded-md p-3 text-center block"
          >
            View Live Queue Status
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
