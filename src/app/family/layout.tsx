
import { AdminAuthProvider } from "@/lib/admin-auth";
import { AuthGuard } from "@/components/admin/auth-guard";

export default async function FamilyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminAuthProvider>
      <AuthGuard>
        {children}
      </AuthGuard>
    </AdminAuthProvider>
  );
}
