import Link from "next/link";

import { AuthPanel } from "@/features/auth/auth-panel";

export default function HomePage() {
  return (
    <main>
      <h1>Munch</h1>
      <p>
        Swipe through nearby restaurants with friends until everyone likes the
        same place.
      </p>
      <nav>
        <Link href="/room/create">Create a room</Link>
        <Link href="/room/join">Join a room</Link>
        {/* History gates on sign-in itself (guests see "sign in to save"), so the link is
            always shown rather than splitting the home page into a client auth check. */}
        <Link href="/history">Your matches</Link>
      </nav>
      {/* Guest is the default path above; an account is optional and unlocks saved
          matches (docs/01 §10). Auth lives only here (outside a room) — sign in or register
          an email+password account, or continue with Google. */}
      <AuthPanel mode="signin" />
    </main>
  );
}
