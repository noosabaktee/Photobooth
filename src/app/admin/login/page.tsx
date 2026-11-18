import { Header, Footer } from "@/components/shared";
import { Login } from "@/components/admin";
export default function LoginPage() {
  return (
    <>
      <Header />
      <main className="login-shell">
        <Login />
      </main>
      <Footer />
    </>
  );
}
