import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { Header, Footer } from "@/components/shared";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isAdmin())) redirect("/admin/login");
  return (
    <>
      <Header />
      <main className="admin-main">{children}</main>
      <Footer />
    </>
  );
}
