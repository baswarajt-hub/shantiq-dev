
import { AdminAuthProvider } from "@/lib/admin-auth";
import { AuthGuard } from "@/components/admin/auth-guard";
import Header from "@/components/header";
import { getDoctorScheduleAction } from "../actions";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const schedule = await getDoctorScheduleAction();
  
  return (
    <AdminAuthProvider>
      <AuthGuard>
        <Header logoSrc={schedule.clinicDetails?.clinicLogo} clinicName={schedule.clinicDetails?.clinicName} />
        {children}
      </AuthGuard>
    </AdminAuthProvider>
  );
}
