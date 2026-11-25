import Link from "next/link";
import MaxCharacter from "@/components/MaxCharacter";
import MuteControls from "@/components/MuteControls";
import LeaderboardTable from "@/components/LeaderboardTable";
import GlobalStats from "@/components/GlobalStats";

export default function LandingPage() {
  return (
    <main className="grid-line min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <span className="neon-text mono text-lg font-black">HUMAN vs MACHINE</span>
          <span className="rounded bg-panel-2 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-inkdim">
            Logic War
          </span>
        </div>
        <div className="flex items-center gap-3">
          <MuteControls />
          <Link href="/leaderboard" className="text-sm text-inkdim hover:text-ink">
            Leaderboard
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-8 md:grid-cols-2 md:pt-16">
        <div>
          <p className="mono mb-4 text-xs uppercase tracking-[0.3em] text-violet">A competitive browser game</p>
          <h1 className="text-4xl font-black leading-tight text-ink md:text-6xl">
            Your brain vs <span className="neon-text">my algorithm.</span>
          </h1>
          <p className="mt-4 max-w-md text-lg text-inkdim">
            Find the one emoji that doesn&rsquo;t belong before M.A.X. does. Twelve grids. Five minutes. One winner.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/lobby"
              className="neon-border rounded-xl bg-neon/15 px-8 py-3.5 text-base font-bold text-neon transition-transform hover:scale-[1.03] active:scale-95"
            >
              START BATTLE
            </Link>
            <span className="text-sm text-inkdim">No login. Free. Instant.</span>
          </div>
          <div className="mt-6 flex gap-2 text-[11px] uppercase tracking-wide text-inkdim">
            <span className="rounded bg-panel-2 px-2 py-1">2×2</span>
            <span className="rounded bg-panel-2 px-2 py-1">3×3</span>
            <span className="rounded bg-panel-2 px-2 py-1">4×4</span>
            <span className="rounded bg-panel-2 px-2 py-1">5×5</span>
          </div>
        </div>
        <div className="flex justify-center">
          <MaxCharacter expression="confident" size={150} />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-16">
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { n: "1", t: "Spot the odd emoji", d: "Every grid has one emoji that is different. Tap it fast." },
            { n: "2", t: "Race M.A.X.", d: "The machine scans the same grid. Both of you score on speed and accuracy." },
            { n: "3", t: "Climb the board", d: "Twelve rounds, five minutes. Win and claim the leaderboard." },
          ].map((s) => (
            <div key={s.n} className="glass rounded-xl p-5">
              <div className="neon-text mono text-2xl font-black">{s.n}</div>
              <div className="mt-2 font-semibold text-ink">{s.t}</div>
              <div className="mt-1 text-sm text-inkdim">{s.d}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-16">
        <h2 className="mb-4 text-xl font-bold text-ink">Global Human vs Machine</h2>
        <GlobalStats />
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-ink">Leaderboard</h2>
          <Link href="/leaderboard" className="text-sm text-neon hover:underline">
            Full board
          </Link>
        </div>
        <LeaderboardTable />
      </section>

      <footer className="border-t border-line py-8 text-center text-xs text-inkfaint">
        HUMAN VS MACHINE: LOGIC WAR · M.A.X. solve times are simulated, not CPU benchmarks.
      </footer>
    </main>
  );
}
