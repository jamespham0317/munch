import { LobbyView } from "@/features/room/lobby-view";

export default async function LobbyPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  return (
    <main className="min-h-screen">
      <div className="munch-column py-md md:py-lg">
        <LobbyView roomId={roomId} />
      </div>
    </main>
  );
}
