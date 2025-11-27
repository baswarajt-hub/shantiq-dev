
import { AdminAuthProvider } from "@/lib/admin-auth";
import { AuthGuard } from "@/components/admin/auth-guard";

export default async function AdminLayout({
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
