// End-to-end smoke test against a running server (default http://localhost:3100).
// Exercises the in-memory fallback path: match start → answer → finish →
// leaderboard → stats → admin. Also asserts the anti-cheat rule that public
// rounds never leak the answer (oddIndex).
//
// Run:  node scripts/smoke-test.mjs [baseUrl]

const BASE = process.argv[2] ?? "http://localhost:3100";

let passed = 0;
let failed = 0;
function check(cond, msg) {
  if (cond) {
    passed++;
    console.log("  ok  " + msg);
  } else {
    failed++;
    console.log("  FAIL " + msg);
  }
}

async function main() {
  // 1. Landing page
  const home = await fetch(`${BASE}/`);
  check(home.status === 200, `GET / -> 200`);
  const homeText = await home.text();
  check(homeText.includes("HUMAN vs MACHINE") || homeText.includes("HUMAN"), "landing renders title");

  // 2. Start match
  const startRes = await fetch(`${BASE}/api/match/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId: "smoke-test-player", playerName: "Smoke", avatar: "\u{1F9E0}", maxMode: "normal" }),
  });
  const start = await startRes.json();
  check(startRes.status === 200, `POST /api/match/start -> 200`);
  check(!!start.sessionId, "start returns sessionId");
  check(Array.isArray(start.rounds) && start.rounds.length === 12, "start returns 12 rounds");
  const r0 = start.rounds?.[0];
  check(!!r0 && Array.isArray(r0.cells) && r0.cells.length === 4, "round 0 is a 2x2 grid (4 cells)");
  check(r0 && r0.oddIndex === undefined && r0.answer === undefined, "ANTI-CHEAT: public round has no oddIndex/answer");
  check(r0 && typeof r0.timeLimitSec === "number" && typeof r0.basePoints === "number", "round carries time + points");

  // 3. Answer round 0 (tap cell 0)
  const ansRes = await fetch(`${BASE}/api/match/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: start.sessionId, index: 0, cellIndex: 0 }),
  });
  const ans = await ansRes.json();
  check(ansRes.status === 200, `POST /api/match/answer -> 200`);
  check(["correct", "wrong"].includes(ans.outcome), `answer returns outcome (${ans.outcome})`);
  check(typeof ans.oddIndex === "number", "answer reveals oddIndex only after answering");
  check(typeof ans.playerScore === "number" && typeof ans.maxScore === "number", "answer returns both scores");
  check(ans.nextIndex === 1 && ans.finished === false, "answer advances to next round");

  // 4. Recover (should still be active, currentIndex 1)
  const recRes = await fetch(`${BASE}/api/match/recover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: start.sessionId }),
  });
  const rec = await recRes.json();
  check(recRes.status === 200 && rec.status === "active", "recover returns active match");
  check(rec.currentIndex === 1, "recover reflects answered round (index 1)");

  // 5. Finish (server fills remaining as blank)
  const finRes = await fetch(`${BASE}/api/match/finish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: start.sessionId }),
  });
  const fin = await finRes.json();
  check(finRes.status === 200, `POST /api/match/finish -> 200`);
  check(!!fin.summary && ["human", "machine", "draw"].includes(fin.summary.winner), `finish returns winner (${fin.summary?.winner})`);
  check(Array.isArray(fin.summary?.breakdown) && fin.summary.breakdown.length === 12, "finish returns 12-round breakdown");
  check(fin.summary.correctCount + fin.summary.wrongCount + fin.summary.blankCount === 12, "finish counts sum to 12");

  // 6. Idempotent finish
  const fin2 = await fetch(`${BASE}/api/match/finish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: start.sessionId }),
  });
  const fin2json = await fin2.json();
  check(fin2.status === 200 && fin2json.summary?.matchId === fin.summary.matchId, "finish is idempotent");

  // 7. Leaderboard + stats
  const lb = await fetch(`${BASE}/api/leaderboard?window=all`);
  const lbjson = await lb.json();
  check(lb.status === 200 && Array.isArray(lbjson.rows), "leaderboard returns rows");

  const st = await fetch(`${BASE}/api/stats`);
  const stjson = await st.json();
  check(st.status === 200 && typeof stjson.totalMatches === "number", "stats returns totals");
  check(stjson.totalMatches >= 1, "stats reflects the finished match");

  // 8. Admin (fallback key)
  const admin = await fetch(`${BASE}/api/admin/stats`, { headers: { "x-admin-key": "admin123" } });
  check(admin.status === 200, "admin stats accessible with fallback key");
  const adminDenied = await fetch(`${BASE}/api/admin/stats`, { headers: { "x-admin-key": "wrong" } });
  check(adminDenied.status === 401, "admin stats denied with wrong key");

  console.log(`\n${failed === 0 ? "PASS" : "FAIL"}: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("smoke test crashed:", e);
  process.exit(1);
});
