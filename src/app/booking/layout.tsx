import { PatientPortalHeader } from "@/components/patient-portal-header";

export default function PatientPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen bg-muted/40">
      <PatientPortalHeader />
      {children}
    </div>
  );
}
