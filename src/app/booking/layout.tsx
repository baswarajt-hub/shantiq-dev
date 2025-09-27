
import { PatientPortalHeader } from "@/components/patient-portal-header";
import { getDoctorScheduleAction } from "../actions";

export default async function PatientPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const schedule = await getDoctorScheduleAction();
  const logoSrc = schedule?.clinicDetails?.clinicLogo;
  const clinicName = schedule?.clinicDetails?.clinicName;
  const googleMapsLink = schedule?.clinicDetails?.googleMapsLink;

  return (
    <div className="flex flex-col min-h-screen bg-muted/40">
      <PatientPortalHeader logoSrc={logoSrc} clinicName={clinicName} googleMapsLink={googleMapsLink} />
      {children}
    </div>
  );
}
