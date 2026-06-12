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
    <>
      {/* Ambient atmosphere (Stitch "Join Room") — soft, blurred brand/heat blobs behind the
          content. Decorative and web-only; mobile leans on the cream Screen canvas (docs/10 §3.4). */}
      <div
        aria-hidden
        className="pointer-events-none fixed -right-[10%] -top-[10%] -z-10 h-[40%] w-[40%] rounded-full bg-brand/5 blur-[100px]"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed -bottom-[10%] -left-[10%] -z-10 h-[50%] w-[50%] rounded-full bg-heat/5 blur-[100px]"
      />
      <FullScreenView
        title="Join the Squad"
        subtitle="You've been invited! Ready to settle the food debate?"
      >
        <JoinRoomForm initialCode={code} lockCode />
      </FullScreenView>
    </>
  );
}
