import Link from "next/link";

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
    </main>
  );
}
