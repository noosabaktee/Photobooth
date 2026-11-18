import { Dashboard } from "@/components/admin";
import { storageMode } from "@/lib/storage";
export default function AdminPage() {
  return <Dashboard mode={storageMode()} />;
}
