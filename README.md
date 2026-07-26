# Around the World with Floyd — Multiplayer

A synchronized host-controlled GeoGuessr-style family game using Vercel + Firebase Realtime Database.

## Features
- Host creates a six-character room
- QR code and join code
- Anonymous Firebase sign-in
- Everyone is synchronized to the same round
- Players' guesses remain hidden until the host reveals
- Distance-based scoring up to 5,000 points
- Shared leaderboard
- Final awards
- 18 supplied travel photos

## IMPORTANT: Publish the Firebase database rules
1. Open Firebase Console.
2. Open **Realtime Database → Rules**.
3. Replace the existing rules with the contents of `database.rules.json`.
4. Click **Publish**.

## Deploy to Vercel
### GitHub method
1. Upload the contents of this folder to your GitHub repository.
2. In Vercel, import the repository.
3. Framework preset: **Vite**.
4. Build command: `npm run build`
5. Output directory: `dist`
6. Deploy.

### Vercel CLI method
Run:
```bash
npm install
npm run build
npx vercel
```

## Test locally
```bash
npm install
npm run dev
```

Open the local link in two browser windows:
- Window 1: Create room as host
- Window 2/incognito: Join with room code

## Notes
- The host should use the same browser/device for the whole game because anonymous Firebase identity identifies the host.
- The provided Firebase web configuration is a normal browser configuration, not a private service-account key.
- To adjust locations, edit `public/rounds.json`.
