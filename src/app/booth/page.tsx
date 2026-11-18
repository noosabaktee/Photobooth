import { Header } from "@/components/shared";
import { KioskFooter } from "@/components/kiosk";
import { Booth } from "@/components/booth";
import { storageMode } from "@/lib/storage";
export const dynamic = "force-dynamic";
export default function BoothPage() {
  return (
    <div className="kiosk-shell booth-shell">
      <Header />
      <main className="booth-main">
        <Booth mode={storageMode()} />
      </main>
      <KioskFooter />
    </div>
  );
}
