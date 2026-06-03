import { redirect } from "next/navigation";

import { SessionView } from "@/features/session/session-view";

/**
 * Swipe screen route. `sessionId` arrives as a query string from the lobby's start-session
 * navigation (host) or the lobby's session-subscription auto-route (members). The server
 * component is a thin pass-through; SessionView owns the data layer and realtime channel.
 */
export default async function SessionPage({
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
        <SessionView roomId={roomId} sessionId={sessionId} />
      </div>
    </main>
  );
}
