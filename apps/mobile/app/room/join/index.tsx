import { Screen } from "../../../src/components/ui";
import { JoinRoomForm } from "../../../src/features/room/join-room-form";

/** Manual join screen (blank code). Thin wrapper around the JoinRoomForm feature, which owns
 *  the icon + title + subtitle hero (docs/10 §3.4). */
export default function JoinRoomScreen() {
  return (
    <Screen>
      <JoinRoomForm
        title="Join with Code"
        subtitle="Enter the code your host shared to jump into their room."
      />
    </Screen>
  );
}
