import Link from "next/link";
import LeaderboardTable from "@/components/LeaderboardTable";

export default function LeaderboardPage() {
  return (
    <main className="grid-line min-h-screen">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-5 py-5">
        <Link href="/" className="neon-text mono text-lg font-black">
          HUMAN vs MACHINE
        </Link>
        <Link href="/lobby" className="neon-border rounded-lg bg-neon/15 px-4 py-2 text-sm font-bold text-neon">
          Play
        </Link>
      </header>
      <section className="mx-auto max-w-4xl px-5 pb-20">
        <h1 className="text-3xl font-black text-ink">Leaderboard</h1>
        <p className="mb-6 mt-1 text-inkdim">Top 10 across all battles. Updates live as matches finish.</p>
        <LeaderboardTable />
      </section>
    </main>
  );
}
