
import { PatientPortalHeader } from "@/components/patient-portal-header";

export default function PatientPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PatientPortalHeader />
      {children}
    </>
  );
}
