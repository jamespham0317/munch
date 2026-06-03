import { FullScreenView } from "@/components/full-screen-view";
import { CreateRoomForm } from "@/features/room/create-room-form";

export default function CreateRoomPage() {
  return (
    <FullScreenView
      title="Start a Munch Group"
      subtitle="Set your vibes and let the group decide together."
    >
      <CreateRoomForm />
    </FullScreenView>
  );
}
