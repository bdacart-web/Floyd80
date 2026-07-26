import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import {
  ref, set, get, update, onValue, remove, serverTimestamp
} from "firebase/database";
import { auth, db, ensureSignedIn } from "./firebase";
import { roomCode, haversineMiles, scoreForDistance, computeAwards } from "./game";
import MapPicker from "./MapPicker";

const emptyJoin = { name: "", code: new URLSearchParams(location.search).get("room") || "" };

export default function App() {
  const [user, setUser] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [screen, setScreen] = useState("home");
  const [join, setJoin] = useState(emptyJoin);
  const [code, setCode] = useState("");
  const [room, setRoom] = useState(null);
  const [guess, setGuess] = useState(null);
  const [message, setMessage] = useState("");
  const [qr, setQr] = useState("");

  useEffect(() => {
    ensureSignedIn().then(setUser).catch((e) => setMessage(e.message));
    fetch("/rounds.json").then((r) => r.json()).then(setRounds);
  }, []);

  useEffect(() => {
    if (!code) return;
    return onValue(ref(db, `games/${code}`), (snap) => {
      const value = snap.val();
      if (!value) {
        setMessage("This room no longer exists.");
        setRoom(null);
        return;
      }
      setRoom(value);
      if (value.status === "finished") setScreen("finished");
      else if (value.status === "lobby") setScreen(value.hostId === auth.currentUser?.uid ? "hostLobby" : "playerLobby");
      else setScreen(value.hostId === auth.currentUser?.uid ? "hostGame" : "playerGame");
    });
  }, [code]);

  useEffect(() => {
    if (!code) return;
    QRCode.toDataURL(`${location.origin}${location.pathname}?room=${code}`, { width: 320, margin: 1 })
      .then(setQr)
      .catch(() => setQr(""));
  }, [code]);

  const isHost = room?.hostId === user?.uid;
  const me = room?.players?.[user?.uid];
  const currentRound = room ? rounds[room.currentRound || 0] : null;
  const currentGuesses = useMemo(() => {
    if (!room?.guesses || room.currentRound == null) return [];
    const raw = room.guesses[room.currentRound] || {};
    return Object.entries(raw).map(([uid, g]) => ({
      ...g,
      uid,
      playerName: room.players?.[uid]?.name || "Player"
    }));
  }, [room]);

  useEffect(() => {
    setGuess(null);
  }, [room?.currentRound, room?.phase]);

  async function createGame() {
    if (!user) return;
    setMessage("");
    let next = roomCode();
    while ((await get(ref(db, `games/${next}`))).exists()) next = roomCode();
    const hostName = join.name.trim() || "Host";
    await set(ref(db, `games/${next}`), {
      hostId: user.uid,
      createdAt: serverTimestamp(),
      status: "lobby",
      phase: "guessing",
      currentRound: 0,
      players: {
        [user.uid]: { name: hostName, score: 0, joinedAt: serverTimestamp(), isHost: true }
      }
    });
    setCode(next);
    history.replaceState({}, "", `?room=${next}`);
  }

  async function joinGame() {
    if (!user) return;
    const nextCode = join.code.trim().toUpperCase();
    const name = join.name.trim();
    if (!name || nextCode.length !== 6) {
      setMessage("Enter your name and the six-character room code.");
      return;
    }
    const snap = await get(ref(db, `games/${nextCode}`));
    if (!snap.exists()) {
      setMessage("Room not found. Check the code and try again.");
      return;
    }
    const value = snap.val();
    if (value.status !== "lobby" && !value.players?.[user.uid]) {
      setMessage("That game has already started.");
      return;
    }
    await update(ref(db, `games/${nextCode}/players/${user.uid}`), {
      name, score: value.players?.[user.uid]?.score || 0, joinedAt: serverTimestamp(), isHost: false
    });
    setCode(nextCode);
    history.replaceState({}, "", `?room=${nextCode}`);
  }

  async function startGame() {
    await update(ref(db, `games/${code}`), { status: "playing", phase: "guessing", currentRound: 0 });
  }

  async function submitGuess() {
    if (!guess || !currentRound || !room) return;
    const started = room.roundStartedAt || Date.now();
    await set(ref(db, `games/${code}/guesses/${room.currentRound}/${user.uid}`), {
      lat: guess.lat, lng: guess.lng, submittedAt: serverTimestamp(),
      seconds: Math.max(0, Math.round((Date.now() - started) / 1000))
    });
  }

  async function revealRound() {
    if (!isHost || !currentRound) return;
    const guessesSnap = await get(ref(db, `games/${code}/guesses/${room.currentRound}`));
    const guesses = guessesSnap.val() || {};
    const updates = {};
    for (const [uid, g] of Object.entries(guesses)) {
      const distanceMiles = haversineMiles(g, currentRound);
      const points = scoreForDistance(distanceMiles);
      const oldScore = room.players?.[uid]?.score || 0;
      updates[`players/${uid}/score`] = oldScore + points;
      updates[`players/${uid}/rounds/${room.currentRound}`] = {
        roundIndex: room.currentRound,
        points,
        distanceMiles,
        seconds: g.seconds || 0,
        category: currentRound.category
      };
      updates[`guesses/${room.currentRound}/${uid}/distanceMiles`] = distanceMiles;
      updates[`guesses/${room.currentRound}/${uid}/points`] = points;
    }
    updates.phase = "revealed";
    await update(ref(db, `games/${code}`), updates);
  }

  async function nextRound() {
    const next = room.currentRound + 1;
    if (next >= rounds.length) {
      await update(ref(db, `games/${code}`), { status: "finished", phase: "finished" });
      return;
    }
    await update(ref(db, `games/${code}`), {
      currentRound: next, phase: "guessing", roundStartedAt: Date.now()
    });
  }

  async function leaveRoom() {
    if (code && user && !isHost) await remove(ref(db, `games/${code}/players/${user.uid}`));
    setCode(""); setRoom(null); setScreen("home");
    history.replaceState({}, "", location.pathname);
  }

  if (!user || !rounds.length) return <Shell><p>Loading the game…</p></Shell>;

  if (screen === "home") return (
    <Shell>
      <section className="hero">
        <div className="eyebrow">Live family map challenge</div>
        <h1>🌎 Around the World with Floyd</h1>
        <p>Everyone joins from a phone. The host controls each photo, reveal, and leaderboard.</p>
      </section>
      {message && <div className="notice">{message}</div>}
      <div className="two">
        <div className="card">
          <h2>Host a game</h2>
          <label>Your display name<input value={join.name} onChange={(e)=>setJoin({...join,name:e.target.value})} placeholder="Bridgette" /></label>
          <button className="primary" onClick={createGame}>Create room</button>
        </div>
        <div className="card">
          <h2>Join a game</h2>
          <label>Your name<input value={join.name} onChange={(e)=>setJoin({...join,name:e.target.value})} placeholder="Your name" /></label>
          <label>Room code<input value={join.code} onChange={(e)=>setJoin({...join,code:e.target.value.toUpperCase()})} maxLength={6} placeholder="ABC123" /></label>
          <button className="primary" onClick={joinGame}>Join room</button>
        </div>
      </div>
    </Shell>
  );

  if (screen === "hostLobby") return (
    <Shell>
      <Top code={code} />
      <div className="two">
        <div className="card center">
          <h2>Scan to join</h2>
          {qr && <img className="qr" src={qr} alt={`QR code to join room ${code}`} />}
          <p className="roomCode">{code}</p>
          <p className="muted">Players can also open the Vercel link and type this code.</p>
        </div>
        <PlayerList players={room.players} />
      </div>
      <div className="actions"><button className="primary large" onClick={startGame} disabled={Object.keys(room.players||{}).length < 2}>Start game</button></div>
    </Shell>
  );

  if (screen === "playerLobby") return (
    <Shell>
      <Top code={code} />
      <div className="card center">
        <div className="pulse">✓</div>
        <h2>You’re in, {me?.name}!</h2>
        <p>Waiting for the host to start.</p>
        <p className="muted">{Object.keys(room.players||{}).length} players joined</p>
      </div>
    </Shell>
  );

  if (screen === "hostGame") return (
    <Shell>
      <Top code={code} round={room.currentRound + 1} total={rounds.length} />
      <RoundPhoto index={room.currentRound} />
      <div className="two">
        <div className="card">
          <h2>{room.phase === "guessing" ? "Players are guessing" : currentRound?.name}</h2>
          <p className="bigNumber">{currentGuesses.length} / {Object.keys(room.players||{}).length - 1}</p>
          <p className="muted">player guesses submitted</p>
          {room.phase === "guessing"
            ? <button className="primary" onClick={revealRound} disabled={!currentGuesses.length}>Reveal answer</button>
            : <button className="primary" onClick={nextRound}>{room.currentRound + 1 >= rounds.length ? "Finish game" : "Next round"}</button>}
        </div>
        <Leaderboard players={room.players} />
      </div>
      {room.phase === "revealed" &&
        <div className="card"><MapPicker reveal guesses={currentGuesses} answer={currentRound} /></div>}
    </Shell>
  );

  if (screen === "playerGame") {
    const submitted = Boolean(room.guesses?.[room.currentRound]?.[user.uid]);
    const myResult = room.players?.[user.uid]?.rounds?.[room.currentRound];
    return (
      <Shell>
        <Top code={code} round={room.currentRound + 1} total={rounds.length} />
        <RoundPhoto index={room.currentRound} />
        {room.phase === "guessing" ? (
          <div className="card">
            {!submitted ? <>
              <p className="muted">Tap the map to drop your pin. You may move it before submitting.</p>
              <MapPicker value={guess} onChange={setGuess} />
              <button className="primary" onClick={submitGuess} disabled={!guess}>Submit guess</button>
            </> : <div className="center waiting"><div className="pulse">✓</div><h2>Guess submitted</h2><p>Waiting for the host to reveal the location.</p></div>}
          </div>
        ) : (
          <>
            <div className="resultStrip">
              <div><strong>{myResult?.points?.toLocaleString() || 0}</strong><span>points</span></div>
              <div><strong>{Math.round(myResult?.distanceMiles || 0).toLocaleString()}</strong><span>miles away</span></div>
            </div>
            <div className="card"><h2>{currentRound?.name}</h2><MapPicker reveal guesses={currentGuesses} answer={currentRound} /></div>
            <Leaderboard players={room.players} />
          </>
        )}
      </Shell>
    );
  }

  if (screen === "finished") {
    const awards = computeAwards(room.players, rounds.length);
    return (
      <Shell>
        <section className="hero"><div className="eyebrow">Final results</div><h1>🏆 Awards Ceremony</h1></section>
        <Leaderboard players={room.players} title="Final standings" />
        <div className="card">
          <h2>Extra awards</h2>
          <Award icon="🎯" title="Bullseye Award" text={awards.bullseye ? `${awards.bullseye.playerName} — ${awards.bullseye.distanceMiles.toFixed(1)} miles away` : "No result"} />
          <Award icon="🧭" title="Explorer Award" text={awards.comeback ? `${awards.comeback.name} — biggest second-half improvement` : "No result"} />
          <Award icon="😂" title="Lost at Sea Award" text={awards.lostAtSea ? `${awards.lostAtSea.playerName} — ${Math.round(awards.lostAtSea.distanceMiles).toLocaleString()} miles away` : "No result"} />
          <Award icon="🚀" title="Speed Demon" text={awards.speed ? `${awards.speed.name} — ${awards.speed.averageSeconds.toFixed(1)} seconds per guess` : "No result"} />
        </div>
        <div className="actions"><button className="secondary" onClick={leaveRoom}>Leave game</button></div>
      </Shell>
    );
  }

  return <Shell><p>Loading room…</p></Shell>;
}

function Shell({children}) { return <main className="shell">{children}</main>; }
function Top({code,round,total}) { return <div className="top"><span className="badge">Room {code}</span>{round && <span className="badge">Round {round} of {total}</span>}</div>; }
function RoundPhoto({index}) { return <div className="photoCard"><img src={`/photos/round-${String(index+1).padStart(2,"0")}.jpg`} alt={`Floyd travel photo, round ${index+1}`} /></div>; }
function PlayerList({players}) { return <div className="card"><h2>Players ({Object.keys(players||{}).length})</h2>{Object.entries(players||{}).map(([id,p])=><div className="player" key={id}><span>{p.isHost?"⭐":"🌍"}</span><strong>{p.name}</strong></div>)}</div>; }
function Leaderboard({players,title="Leaderboard"}) {
 const sorted=Object.entries(players||{}).map(([id,p])=>({id,...p})).sort((a,b)=>(b.score||0)-(a.score||0));
 return <div className="card"><h2>{title}</h2>{sorted.map((p,i)=><div className="leader" key={p.id}><span>{i+1}</span><strong>{p.name}</strong><span>{(p.score||0).toLocaleString()}</span></div>)}</div>;
}
function Award({icon,title,text}) { return <div className="award"><span>{icon}</span><div><strong>{title}</strong><p>{text}</p></div></div>; }
