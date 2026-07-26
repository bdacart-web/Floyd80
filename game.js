export function roomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export function haversineMiles(a, b) {
  const R = 3958.8;
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const q =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(q));
}

export function scoreForDistance(miles) {
  if (miles <= 1) return 5000;
  return Math.max(0, Math.round(5000 * Math.exp(-miles / 1200)));
}

export function computeAwards(players, roundCount) {
  const list = Object.entries(players || {}).map(([uid, p]) => ({ uid, ...p }));
  const completed = list.filter((p) => p.rounds);
  const sorted = [...list].sort((a, b) => (b.score || 0) - (a.score || 0));
  const allRounds = completed.flatMap((p) =>
    Object.values(p.rounds || {}).map((r) => ({ ...r, playerName: p.name }))
  );
  const best = [...allRounds].sort((a, b) => a.distanceMiles - b.distanceMiles)[0];
  const worst = [...allRounds].sort((a, b) => b.distanceMiles - a.distanceMiles)[0];

  const comeback = completed
    .map((p) => {
      const rounds = Object.values(p.rounds || {});
      const half = Math.max(1, Math.floor(roundCount / 2));
      const first = rounds.filter((r) => r.roundIndex < half);
      const second = rounds.filter((r) => r.roundIndex >= half);
      const avg = (arr) => (arr.length ? arr.reduce((s, r) => s + r.points, 0) / arr.length : 0);
      return { name: p.name, improvement: avg(second) - avg(first) };
    })
    .sort((a, b) => b.improvement - a.improvement)[0];

  const speed = completed
    .map((p) => {
      const rounds = Object.values(p.rounds || {});
      return {
        name: p.name,
        averageSeconds: rounds.length
          ? rounds.reduce((s, r) => s + (r.seconds || 0), 0) / rounds.length
          : Infinity
      };
    })
    .sort((a, b) => a.averageSeconds - b.averageSeconds)[0];

  return {
    podium: sorted.slice(0, 3),
    bullseye: best,
    lostAtSea: worst,
    comeback,
    speed
  };
}
