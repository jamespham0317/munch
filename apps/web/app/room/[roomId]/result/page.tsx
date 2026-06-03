import { redirect } from "next/navigation";

import { ResultView } from "@/features/session/result-view";

/**
 * Match announcement route. `sessionId` arrives as a query string from the swipe screen
 * (either entry path; see ResultView). Server component is a thin pass-through.
 */
export default async function ResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{ sessionId?: string }>;
}) {
  const { roomId } = await params;
  const { sessionId } = await searchParams;
  if (!sessionId) {
    redirect(`/room/${roomId}/lobby`);
  }
  return (
    <main className="min-h-screen">
      <div className="munch-column py-md md:py-lg">
        <ResultView sessionId={sessionId} />
      </div>
    </main>
  );
}
