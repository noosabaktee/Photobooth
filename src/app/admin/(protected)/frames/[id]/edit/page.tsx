import { FrameBuilder } from "@/components/frame-builder";
export default async function EditFrame({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <FrameBuilder id={(await params).id} />;
}
