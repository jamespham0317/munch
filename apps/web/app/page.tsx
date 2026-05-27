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
      </nav>
      {/* Guest is the default path above; an account is optional and unlocks saved
          matches (docs/01 §10). Signing in here creates a fresh account. */}
      <AuthPanel mode="signin" />
    </main>
  );
}
