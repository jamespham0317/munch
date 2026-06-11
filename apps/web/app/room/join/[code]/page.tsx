import { FullScreenView } from "@/components/full-screen-view";
import { JoinRoomForm } from "@/features/room/join-room-form";

/**
 * The link/QR join target. `params` is async in the App Router (Next 16); the code from the
 * link pre-fills the join form and is LOCKED (lockCode) — a host shared this exact code, so the
 * invitee confirms a name and joins but can't edit the code (docs/10 §3.4). Manual code entry
 * lives on the Match home now, not here.
 */
export default async function JoinRoomByCodePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return (
    <FullScreenView
      title="Join with Code"
      subtitle="You're invited! Confirm the details below to join the room."
    >
      <JoinRoomForm initialCode={code} lockCode />
    </FullScreenView>
  );
}
