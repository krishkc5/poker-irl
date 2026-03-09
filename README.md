# Poker IRL

Poker IRL is a real-life poker companion app for friends playing in person with a physical deck of cards.

The app does **not** handle cards. It tracks room state, players, chips, betting actions, turn order, pot, blinds, hand progression, and showdown settlement.

## Live URL

GitHub Pages target:

- https://krishkc5.github.io/poker-irl/

## MVP Features

- Anonymous Firebase auth on app load
- Landing page with create room and join by 6-letter room code
- Room creation with collision-resistant uppercase code generation
- Realtime lobby (Firestore `onSnapshot`) with host/player list
- Host controls in lobby:
  - starting stack
  - small blind
  - big blind
  - auto-assign seats
  - remove players
  - start game (2+ players)
- Table view with seat-ordered players and live state:
  - stack
  - folded/all-in status
  - dealer and current turn indicators
  - pot and current bet
  - street (`preflop`, `flop`, `turn`, `river`, `showdown`)
- Betting actions:
  - check
  - call
  - bet
  - raise
  - fold
  - all-in
- Hand flow:
  - dealer rotation
  - automatic blind posting
  - street progression
  - automatic showdown transition when no further betting is possible
  - host manual street advance and hand reset
  - host start next hand
- Showdown settlement:
  - single winner
  - even split among selected winners
  - side-pot-aware payouts with per-pot winner selection
- Realtime action log and hand history archive
- GitHub Pages deployment via GitHub Actions

## Non-Goals (v1)

- No deck or card management
- No hidden cards or board cards
- No hand ranking
- No odds calculator
- No backend server

## Tech Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- Firebase Web SDK
- Firebase Anonymous Auth
- Cloud Firestore
- GitHub Pages + GitHub Actions

## Project Structure

```text
src/
  components/
  firebase/
  hooks/
  lib/
  pages/
  types/
  utils/
```

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill all values:

```bash
cp .env.example .env
```

Required variables:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

### 3. Run locally

```bash
npm run dev
```

### 4. Production build

```bash
npm run build
npm run preview
```

## Firebase Setup Checklist

1. Firebase project exists.
2. Anonymous auth is enabled.
3. Cloud Firestore is enabled.
4. Deploy `firestore.rules` from this repo.
5. Add all `VITE_FIREBASE_*` variables locally and in GitHub repository secrets.

## Firestore Schema

### Room document

`rooms/{roomCode}`

Fields include:

- `code`
- `hostUid`
- `status`
- `createdAt`
- `updatedAt`
- `startingStack`
- `smallBlind`
- `bigBlind`
- `dealerSeat`
- `currentTurnSeat`
- `currentBet`
- `minRaise`
- `pot`
- `handNumber`
- `street`
- `gameStarted`
- `lastAction`
- `winnersUids`
- `lastAggressorSeat`

### Players subcollection

`rooms/{roomCode}/players/{uid}`

- `uid`
- `displayName`
- `seat`
- `stack`
- `folded`
- `allIn`
- `inHand`
- `currentStreetContribution`
- `totalHandContribution`
- `hasActedThisStreet`
- `joinedAt`
- `isHost`

### Actions subcollection

`rooms/{roomCode}/actions/{actionId}`

- `uid`
- `displayName`
- `type`
- `amount`
- `createdAt`
- `handNumber`
- `street`
- `message`

### Hands subcollection

`rooms/{roomCode}/hands/{handId}`

- `handNumber`
- `settledAt`
- `winners` (uid + displayName)
- `pot`
- `summary`
- `actions` (string summary lines)

## Security Rules Summary

`firestore.rules` includes MVP-focused rules:

- Auth required for all access
- Host controls lobby/admin room updates and room deletion
- Current-turn player can write active-hand gameplay state (turn/pot/player hand fields)
- Players can update/delete their own player doc; host can manage any player doc
- Actions are append-only (lobby members, host, or current-turn player depending on phase)
- Hands can be created by host or current-turn player (for auto-settle paths)

Practical join-flow tradeoff:

- Authenticated users can read lobby room docs to validate/join by code
- Player/action lists are readable in lobby for authenticated users to support join UX

## GitHub Pages Deployment

- Vite base path is configured as `/poker-irl/` in `vite.config.ts`
- Workflow file: `.github/workflows/deploy.yml`
- Workflow expects Firebase values in GitHub repository secrets:
  - `VITE_FIREBASE_API_KEY`
  - `VITE_FIREBASE_AUTH_DOMAIN`
  - `VITE_FIREBASE_PROJECT_ID`
  - `VITE_FIREBASE_STORAGE_BUCKET`
  - `VITE_FIREBASE_MESSAGING_SENDER_ID`
  - `VITE_FIREBASE_APP_ID`

## Known Limitations

- Anonymous auth only (no account linking)
- Room cleanup for nested subcollections is not automatic when a room is deleted
- Security rules are practical MVP rules, not anti-cheat hardened

## Future Improvements

- Advanced side-pot edge-case tooling and audit logs
- Better reconnect/resume UX for dropped clients
- Host transfer controls and moderation tools
- Optional read-only spectator mode
- Offline-first support and optimistic UI enhancements
