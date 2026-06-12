import { useLocalSearchParams } from "expo-router";

import { Screen } from "../../../src/components/ui";
import { JoinRoomForm } from "../../../src/features/room/join-room-form";

/**
 * Link/QR deep-link target: /room/join/{code} (path-parity with apps/web). The code from the
 * route pre-fills the join form and is LOCKED (lockCode) — a host shared this exact code, so the
 * invitee confirms a name and joins but can't edit the code (docs/10 §3.4). Manual code entry
 * lives on the Match home now. The icon + title + subtitle hero lives in the JoinRoomForm.
 * expo-router resolves both the `munch://` scheme and (once a domain is configured) the https
 * universal link to this route.
 */
export default function JoinRoomByCodeScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();

  return (
    <Screen>
      <JoinRoomForm
        title="Join the Squad"
        subtitle="You've been invited! Ready to settle the food debate?"
        initialCode={code ?? ""}
        lockCode
      />
    </Screen>
  );
}
