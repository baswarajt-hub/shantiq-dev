import { NextRequest, NextResponse } from "next/server";
import {
  verifyEasebuzzPaymentAction,
  sendPaymentSuccessSMSAction,
} from "@/app/actions";
import { firestore } from "@/lib/firebase.server";
import { getDoctorSchedule } from "@/lib/data";   // ✔ FIXED import

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const payload = Object.fromEntries(form.entries());

    const verifyResult = await verifyEasebuzzPaymentAction(payload);

    if ("error" in verifyResult) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/payment/failure`
      );
    }

    const txnid = String(payload.txnid || "");
    const phone = String(payload.phone || "");

    if (!txnid) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/payment/failure`
      );
    }

    const patientId = txnid.split("_")[0];
    const patientRef = firestore.collection("patients").doc(patientId);

    await patientRef.update({
      paymentStatus: "Paid",
      paymentTransactionId: txnid,
      paymentMethod: "Easebuzz",
      paymentTime: new Date().toISOString(),
    });

    // ✔ FIXED name
    const schedule = await getDoctorSchedule();

    const snap = await patientRef.get();
    const patient = snap.data();

    if (patient) {
      await sendPaymentSuccessSMSAction({
        phone,
        patientName: patient.patientName,
        appointmentTime: patient.appointmentTime,
        tokenNo: patient.tokenNo,
        clinicName:
          schedule?.clinicDetails?.clinicName ?? "Shanti Children’s Clinic",
      });
    }

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/payment/success?patientId=${patientId}`
    );
  } catch (error) {
    console.error("Payment verify error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/payment/failure`
    );
  }
}
