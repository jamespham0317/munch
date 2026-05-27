import { LobbyView } from "@/features/room/lobby-view";

export default async function LobbyPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  return (
    <main>
      <h1>Room lobby</h1>
      <LobbyView roomId={roomId} />
    </main>
  );
}
