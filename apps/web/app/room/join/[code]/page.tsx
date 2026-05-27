import { JoinRoomForm } from "@/features/room/join-room-form";

/**
 * The link/QR join target. `params` is async in the App Router (Next 16); the
 * code pre-fills the join form. A bare /room/join renders the same form blank.
 */
export default async function JoinRoomByCodePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return (
    <main>
      <h1>Join a room</h1>
      <JoinRoomForm initialCode={code} />
    </main>
  );
}
