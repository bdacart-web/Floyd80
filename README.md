# Around the World with Floyd

A mobile-friendly GeoGuessr-style travel photo game prepared for Vercel.

## Included
- 18 photo rounds
- Tap-to-pin world map
- Distance-based scoring, up to 5,000 points per round
- End-of-game awards
- Responsive phone, tablet, and desktop design

## Deploy to Vercel
1. Create a GitHub repository and upload this entire project folder.
2. In Vercel, select **Add New → Project** and import the repository.
3. Vercel should detect Vite automatically.
4. Build command: `npm run build`
5. Output directory: `dist`
6. Click **Deploy**.

## Current play mode
Each person can open the same Vercel link and play independently on their own phone. Scores and awards are calculated on each device.

A synchronized host-controlled room with a shared live leaderboard requires a real-time database account such as Firebase. That can be added after a Firebase project is created in the owner's Google account.

## Edit locations
Edit `public/rounds.json`. Coordinates use decimal latitude and longitude.

## Local preview
```bash
npm install
npm run dev
```
