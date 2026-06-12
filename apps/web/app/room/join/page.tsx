import { FullScreenView } from "@/components/full-screen-view";
import { JoinRoomForm } from "@/features/room/join-room-form";

export default function JoinRoomPage() {
  return (
    <FullScreenView>
      <JoinRoomForm
        title="Join with Code"
        subtitle="Enter the code your host shared to jump into their room."
      />
    </FullScreenView>
  );
}
