import { Landing } from "@/components/landing";
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  return <Landing view={view === "how" || view === "frames" ? view : "home"} />;
}
