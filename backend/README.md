# 🎡 SMInteractive — Real-Time Multiplayer Spin Wheel Game

A production-ready real-time multiplayer spin wheel game system built with **Node.js**, **TypeScript**, **MongoDB**, and **Socket.IO**. Users join spin wheels by paying entry fees, compete in timed eliminations, and the last player standing wins the prize pool.

---

## 📋 Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Running the Application](#running-the-application)
- [API Reference](#api-reference)
- [WebSocket Events](#websocket-events)
- [Database Schema](#database-schema)
- [Game Lifecycle](#game-lifecycle)
- [Coin Distribution System](#coin-distribution-system)
- [Edge Cases Handled](#edge-cases-handled)
- [Design Decisions & Assumptions](#design-decisions--assumptions)
- [Testing](#testing)
- [Performance Considerations](#performance-considerations)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    HTTP Clients                          │
│              (REST API + Socket.IO)                      │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                  Express + Socket.IO                     │
│   app.ts → Routes → Middleware → Controllers             │
│   (Helmet, CORS, Body-Limit, Morgan, JWT Auth)           │
└────────┬───────────────────────────┬────────────────────┘
         │                           │
┌────────▼────────┐       ┌──────────▼──────────┐
│  SpinWheelService│       │  SocketServer         │
│  (Business Logic)│       │  (Real-time Events)   │
│  MongoDB Sessions│       │  Room-based pub/sub   │
└────────┬────────┘       └──────────┬────────────┘
         │                           │
┌────────▼───────────────────────────▼────────────────────┐
│                     MongoDB                              │
│    Users  |  SpinWheels  |  Transactions  |  Config      │
└─────────────────────────────────────────────────────────┘
         │
┌────────▼────────────────────────────────────────────────┐
│              SpinWheelScheduler (Background)             │
│  - Auto-start timer (3 min)                             │
│  - Elimination interval (7 sec)                         │
│  - Boot recovery (re-attaches active game timers)        │
└─────────────────────────────────────────────────────────┘
```

**Key design principles:**
- **Singleton pattern** for `SocketServer` and `SpinWheelScheduler` — ensures no duplicate timers or connections
- **MongoDB sessions** for all financial operations — prevents partial credits/debits
- **Atomic `findOneAndUpdate`** for eliminations — prevents race conditions under concurrent load
- **DB-driven configuration** — all game parameters adjustable at runtime without restart

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 18+ |
| Language | TypeScript 5 |
| Framework | Express 4 |
| Real-time | Socket.IO 4 |
| Database | MongoDB 6 (Mongoose 8) |
| Auth | JWT (access + refresh tokens) |
| Security | Helmet, CORS, bcrypt |
| Logging | Winston (structured, domain-scoped) |
| Validation | Joi + Zod |
| Testing | Jest + ts-jest + Supertest |
| Scheduling | Native `setInterval` with Singleton scheduler |

---

## Getting Started

### Prerequisites

- Node.js ≥ 18
- MongoDB 6+ (local or Atlas)
- npm ≥ 9

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd SMInteractive/backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env
# → Edit .env with your values
```

---

## Environment Variables

Create a `.env` file in `/backend`:

```env
# ── Server ────────────────────────────────────────────
PORT=4000
NODE_ENV=development

# ── Database ──────────────────────────────────────────
MONGO_URI=mongodb://localhost:27017/sminteractive

# ── JWT ───────────────────────────────────────────────
JWT_SECRET=your_super_secret_jwt_key_min_32_chars
JWT_REFRESH_SECRET=your_refresh_secret_key_min_32_chars
JWT_EXPIRES_IN=1d
JWT_REFRESH_EXPIRES_IN=7d

# ── CORS ──────────────────────────────────────────────
CORS_ORIGIN=http://localhost:3000

# ── Game Configuration (overridden by DB Config if set) ──
WINNER_POOL_PERCENTAGE=70     # % of each entry fee → winner pool
ADMIN_POOL_PERCENTAGE=20      # % of each entry fee → admin pool
APP_POOL_PERCENTAGE=10        # % of each entry fee → app revenue
AUTO_START_TIMEOUT=180000     # ms until auto-start (default: 3 min)
ELIMINATION_INTERVAL=7000     # ms between eliminations (default: 7 sec)
MIN_PARTICIPANTS=3            # minimum players to start
```

> **Note:** Game configuration values are read from the `Config` MongoDB collection at runtime (set via `PUT /api/admin/config`). Environment variables serve as fallbacks if no DB entry exists.

---

## Running the Application

```bash
# Development (hot-reload)
npm run dev

# Production build
npm run build
npm start

# Run tests
npm test

# Run tests with coverage report
npm run test:coverage

# Watch mode (re-runs on file changes)
npm run test:watch
```

The server starts on `http://localhost:4000` by default.

**Health check:** `GET http://localhost:4000/health`

---

## API Reference

All endpoints return JSON in the format:
```json
{
  "success": true | false,
  "message": "Human readable message",
  "data": { ... },
  "error": { "message": "...", "code": "ERROR_CODE", "statusCode": 400 }
}
```

### Authentication

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Register new user |
| `POST` | `/api/auth/login` | Public | Login, receive tokens |
| `POST` | `/api/auth/refresh` | Public | Refresh access token |
| `POST` | `/api/auth/logout` | Private | Invalidate refresh token |
| `GET` | `/api/auth/profile` | Private | Get own profile |
| `PUT` | `/api/auth/profile` | Private | Update name/email |

**Register request:**
```json
{ "name": "Alice", "email": "alice@example.com", "password": "Pass@1234!" }
```

**Login response:**
```json
{
  "data": {
    "user": { "id": "...", "name": "Alice", "role": "user", "coins": 1000 },
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

---

### Spin Wheel

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/spin-wheels` | Admin | Create new spin wheel |
| `GET` | `/api/spin-wheels/active` | Public | Get currently active wheel |
| `GET` | `/api/spin-wheels/history` | Public | Paginated game history |
| `GET` | `/api/spin-wheels/my-games` | Private | Current user's game history |
| `GET` | `/api/spin-wheels/:id` | Public | Get wheel by ID |
| `GET` | `/api/spin-wheels/:id/stats` | Public | Live game statistics |
| `GET` | `/api/spin-wheels/:id/can-join` | Private | Check join eligibility |
| `POST` | `/api/spin-wheels/join` | Private | Join a spin wheel |
| `POST` | `/api/spin-wheels/:id/start` | Admin | Manually start wheel |
| `POST` | `/api/spin-wheels/:id/abort` | Admin | Abort + refund all players |

**Create spin wheel (Admin):**
```json
{ "entryFee": 100, "maxParticipants": 50 }
```

**Join spin wheel:**
```json
{ "spinWheelId": "6630a1b2c3d4e5f6a7b8c9d0" }
```

**Join response:**
```json
{
  "data": {
    "spinWheel": {
      "totalParticipants": 5,
      "totalPool": 500,
      "winnerPool": 350,
      "adminPool": 100,
      "appPool": 50
    },
    "userBalance": 900
  }
}
```

---

### Users (Admin)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/users/balance` | Private | Own coin balance |
| `GET` | `/api/users/stats` | Private | Own win/loss stats |
| `GET` | `/api/users` | Admin | List all users |
| `GET` | `/api/users/:id` | Admin | Get user by ID |
| `PUT` | `/api/users/:id/status` | Admin | Activate/deactivate account |
| `POST` | `/api/users/:id/add-coins` | Admin | Credit coins to user |

---

### Transactions

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/transactions` | Private | Own transaction history |
| `GET` | `/api/transactions/stats` | Private | Own transaction statistics |
| `GET` | `/api/transactions/spin-wheel/:id` | Private | Transactions for a game |

---

### Admin Dashboard

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/admin/dashboard` | Admin | System-wide KPIs |
| `GET` | `/api/admin/transactions` | Admin | All transactions |
| `GET` | `/api/admin/analytics` | Admin | Revenue & game analytics |
| `GET` | `/api/admin/config` | Admin | View all config values |
| `PUT` | `/api/admin/config` | Admin | Update a config value |

**Update config (live, no restart needed):**
```json
{ "key": "WINNER_POOL_PERCENTAGE", "value": 65 }
```

---

## WebSocket Events

Connect using Socket.IO with JWT authentication:

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:4000', {
  auth: { token: 'your_access_token' }
});
```

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `join:spinwheel` | `{ spinWheelId }` | Subscribe to a game room |
| `leave:spinwheel` | `{ spinWheelId }` | Unsubscribe from game room |

### Server → Client (game room)

| Event | Description |
|---|---|
| `spinwheel:created` | New wheel available to join |
| `spinwheel:participant_joined` | A player joined (includes new pool totals) |
| `spinwheel:started` | Game has started (includes eliminationInterval) |
| `spinwheel:countdown` | Countdown tick before auto-start |
| `spinwheel:elimination` | A player was eliminated |
| `spinwheel:completed` | Game over, winner declared |
| `spinwheel:aborted` | Game aborted, refunds issued |

### Server → Client (personal)

| Event | Description |
|---|---|
| `user:won` | You won — includes prize amount |
| `user:online` | Another user came online |
| `user:offline` | Another user disconnected |
| `connected` | Handshake confirmation |

**Elimination event payload:**
```json
{
  "spinWheelId": "...",
  "eliminatedUserId": "...",
  "eliminatedUsername": "Bob",
  "eliminationOrder": 3,
  "remainingParticipants": 2
}
```

---

## Database Schema

### Users
```
_id, name, email, password (bcrypt), role (user|admin),
coins (Number), isActive, refreshToken, lastLogin,
createdAt, updatedAt
```

### SpinWheels
```
_id, adminId, adminName, status (waiting|in_progress|completed|aborted),
entryFee, participants[], maxParticipants, minParticipants,
winnerPool, adminPool, appPool,
winnerPoolPercentage, adminPoolPercentage, appPoolPercentage,
eliminationSequence[], currentEliminationIndex,
autoStartTime, eliminationInterval, autoStartAt,
startedAt, completedAt, winnerId, winnerName,
createdAt, updatedAt
```

**Indexes:** `{ status, createdAt }`, `{ adminId, status }`, `{ participants.userId }`, `{ winnerId }`

### Transactions
```
_id, userId, name, spinWheelId, type (entry_fee|prize_win|admin_commission|app_fee|refund),
amount, balanceBefore, balanceAfter, status, metadata{},
createdAt, updatedAt
```

### Config
```
_id, key (UPPER_CASE, unique), value (any), type, description, isActive,
createdAt, updatedAt
```

**Seeding default config:**
```bash
# Insert default config values using mongosh or Compass:
db.configs.insertMany([
  { key: "WINNER_POOL_PERCENTAGE", value: 70, type: "number", isActive: true },
  { key: "ADMIN_POOL_PERCENTAGE",  value: 20, type: "number", isActive: true },
  { key: "APP_POOL_PERCENTAGE",    value: 10, type: "number", isActive: true },
  { key: "AUTO_START_TIMEOUT",     value: 180000, type: "number", isActive: true },
  { key: "ELIMINATION_INTERVAL",   value: 7000,   type: "number", isActive: true },
  { key: "MIN_PARTICIPANTS",       value: 3,      type: "number", isActive: true }
])
```

---

## Game Lifecycle

```
Admin creates wheel  →  WAITING state
        │
        ├── Players join (pay entry fee)
        │       Entry fee split: winner pool / admin pool / app pool
        │
        ├── Auto-start after 3 minutes  ──OR──  Manual admin start
        │
        ├── < 3 players?  →  AUTO-ABORT  →  Full refund to all players
        │
        └── ≥ 3 players?  →  IN_PROGRESS
                │
                └── Eliminate 1 player every 7 seconds (Fisher-Yates random order)
                        │
                        └── 1 player remaining?  →  COMPLETED
                                │
                                ├── Credit winner with winnerPool
                                ├── Credit admin with adminPool
                                └── Record APP_FEE transaction
```

---

## Coin Distribution System

When a user joins with `entryFee = 100` and default config (70/20/10):

| Pool | Calculation | Amount |
|---|---|---|
| Winner Pool | 100 × 70% | 70 coins |
| Admin Pool | 100 × 20% | 20 coins |
| App Pool | 100 − 70 − 20 (remainder) | 10 coins |

> **Rounding note:** Winner and admin amounts are rounded (`Math.round`). The app pool receives the remainder to prevent floating-point drift accumulating across many players.

With 10 players at 100 coins each:
- Total collected: 1,000 coins
- Winner receives: 700 coins
- Admin receives: 200 coins
- App revenue: 100 coins

**All coin operations use MongoDB transactions (sessions)** — if any step fails, the entire operation rolls back. No partial credits or debits are possible.

---

## Edge Cases Handled

| # | Edge Case | Handling |
|---|---|---|
| 1 | Admin tries to join own wheel | Rejected with `403` |
| 2 | User joins twice | Rejected with `409 Conflict` |
| 3 | Wheel is full (`maxParticipants`) | Rejected with `400` |
| 4 | Insufficient coins to join | Rejected with `402` + current balance in error |
| 5 | Two wheels created simultaneously | Atomic check — second creation fails |
| 6 | Two concurrent join requests hit same slot | MongoDB session isolation prevents both succeeding |
| 7 | < 3 players at auto-start time | Auto-aborts and refunds every player atomically |
| 8 | Two timers try to eliminate the same player | `findOneAndUpdate + $inc` atomically claims the index |
| 9 | Manual start without triggering timer | Fixed — manual start now calls `scheduler.startEliminationProcess()` |
| 10 | Server restart mid-game | Scheduler calls `checkActiveSpinWheels()` on boot and re-attaches timers |
| 11 | Deactivated account | Blocked at both REST (JWT middleware) and WebSocket (handshake middleware) |
| 12 | Invalid/expired JWT | Proper `401` with distinct error codes (`TOKEN_EXPIRED` vs `INVALID_TOKEN`) |
| 13 | DB config read failure | Silent fallback to `process.env` → hardcoded default — server never crashes |
| 14 | Abort of in-progress wheel | Blocked — only `WAITING` wheels can be aborted |
| 15 | Floating-point rounding in pool split | App pool = remainder math, not percentage calculation |
| 16 | Prize payout failure mid-transaction | Full rollback via MongoDB session — no partial payouts |

---

## Design Decisions & Assumptions

### Assumptions Made
1. **Single server deployment** — no Redis adapter for Socket.IO horizontal scaling (documented as known limitation)
2. **Coins are integers** — no fractional coins; entry fees must be whole numbers ≥ 1
3. **One active spin wheel at a time** — enforced globally, not per-admin
4. **Admin cannot participate** — admins create and manage wheels but cannot join as players
5. **Elimination order is fixed at start** — the sequence is generated via Fisher-Yates shuffle when the game starts and does not change during play

### Key Architectural Choices

**Why MongoDB sessions instead of application-level locks?**  
Sessions provide true ACID atomicity at the database level. An application lock (e.g., in-memory mutex) would fail if the server restarts mid-operation.

**Why `findOneAndUpdate` for eliminations?**  
`findById` → modify → `save()` has a TOCTOU race: two concurrent requests can both read the same `currentEliminationIndex` and eliminate the same player. `findOneAndUpdate` with `$inc` is a single atomic round-trip — only one caller gets the old value.

**Why Fisher-Yates for elimination order?**  
It produces a uniformly random permutation with O(n) complexity and no bias — every ordering is equally likely.

**Why singleton scheduler?**  
Prevents duplicate `setInterval` timers from being created if the scheduler is imported from multiple modules.

**Why DB-driven config with env fallback?**  
Allows live adjustment of game parameters (pool percentages, timing) without a server restart, while being resilient to DB failures.

---

## Testing

```bash
npm test                  # Run all tests
npm run test:coverage     # With coverage report
npm run test:watch        # Watch mode
```

### Test Coverage

| Test Suite | Tests | What's Covered |
|---|---|---|
| `auth.test.ts` | 8 | Registration, login, password validation, JWT auth |
| `spinWheel.api.test.ts` | 9 | REST endpoints, auth guards, validation, response shape |
| `spinWheel.service.test.ts` | 14 | Business logic, edge cases, error paths |
| **Total** | **31** | **Critical path + all error branches** |

**All tests run without a real database** — Mongoose models are mocked via `jest.mock()`.

---

## Performance Considerations

| Optimization | Details |
|---|---|
| **Compound DB indexes** | `{ status, createdAt }`, `{ adminId, status }`, `{ participants.userId }`, `{ winnerId }` — covers all common query patterns |
| **Connection pooling** | `maxPoolSize: 10`, `minPoolSize: 5` — prevents connection exhaustion |
| **Pagination everywhere** | All list endpoints accept `page` + `limit` — no unbounded queries |
| **Lean queries** | `select()` projections on hot paths (scheduler status check) |
| **Parallel DB calls** | `Promise.all([find, countDocuments])` on paginated endpoints |
| **Body size limit** | `10kb` request body limit via `express.json({ limit: '10kb' })` |
| **Singleton resources** | Socket server and scheduler instantiated once — no repeated init cost |
| **Structured logging** | Winston with domain namespaces — log aggregation ready (JSON format) |

### Known Scalability Limits

- **Socket.IO is in-memory** — horizontal scaling requires adding `@socket.io/redis-adapter`
- **Scheduler is in-process** — for multi-instance deployment, move to a job queue (BullMQ + Redis)
- **No caching layer** — active spin wheel lookups hit MongoDB on every request; Redis cache would reduce latency significantly

---

## Project Structure

```
backend/
├── src/
│   ├── __tests__/            # Jest test suites
│   │   ├── setup.ts          # Test env vars
│   │   ├── auth.test.ts
│   │   ├── spinWheel.api.test.ts
│   │   └── spinWheel.service.test.ts
│   ├── config/
│   │   ├── database.config.ts
│   │   └── socket.config.ts  # Socket.IO server (singleton)
│   ├── controllers/          # Request handlers
│   ├── middlewares/          # Auth, validation, error handling
│   ├── models/               # Mongoose schemas
│   ├── routes/               # Express routers
│   ├── services/
│   │   ├── spinWheel.service.ts    # Core business logic
│   │   └── scheduler.service.ts   # Background timers
│   ├── utils/
│   │   ├── apiResponse.ts    # Custom error classes
│   │   ├── jwt.ts
│   │   └── logger.ts         # Winston (domain-scoped)
│   ├── validations/          # Joi/Zod schemas
│   ├── app.ts                # Express app setup
│   └── server.ts             # Entry point
├── logs/                     # Winston log files (gitignored)
├── jest.config.js
├── tsconfig.json
└── package.json
```

---

## License

MIT
