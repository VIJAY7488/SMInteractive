# Spin Wheel Game - Complete Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Installation](#installation)
4. [Socket.io](#events)
4. [Database Schema](#database-schema)
5. [Error Handling](#error-handling)

---

## Overview

A real-time multiplayer spin wheel game system where users can create spin wheels, join by paying entry fees, and compete for prize pools. The system handles concurrent users, ensures fair coin distribution, and provides real-time updates.

### Key Features
- ✅ JWT-based authentication
- ✅ Role-based access control (Admin/User)
- ✅ Real-time updates via Socket.IO
- ✅ Atomic coin transactions
- ✅ Automatic game management
- ✅ Comprehensive error handling
- ✅ Request rate limiting
- ✅ Detailed logging system
- ✅ Transaction audit trail

---

## Architecture

### Technology Stack
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: MongoDB with Mongoose
- **Real-time**: Socket.IO
- **Authentication**: JWT
- **Validation**: Joi
- **Logging**: Winston

### Project Structure
```
src/
├── config/           # Database and Redis configuration
├── controllers/      # Request handlers
├── middleware/       # Authentication, error handling, rate limiting
├── models/          # Mongoose schemas
├── routes/          # API route definitions
├── services/        # Business logic
├── socket/          # Socket.IO implementation
├── utils/           # Utilities (logger, errors)
├── app.ts           # Express app setup
└── server.ts        # Entry point
```

---

## Installation

### Prerequisites
- Node.js 18+
- MongoDB 6+

### Setup Steps

1. **Clone the repository**
```bash
git clone <repository-url>
cd spin-wheel-game
```

2. **Install dependencies**
```bash
npm install
```

3. **Environment Configuration**
Create a `.env` file:
```env
NODE_ENV=development
PORT=4000

# MongoDB
MONGODB_URI=mongodb+srv://vijaypatel3207_db_user:Z6jLpDx0hSflnQUU@cluster0.l7xsubl.mongodb.net/



# JWT
JWT_SECRET=8ce5ac4904fd8778ddc1508f77dd317c12851ec6cc1b5cd331e9bcea73cb18efc0c33ce0a4ae5cf40fc02a40bc3608a1c7db7f2ade3e598e67ddfc37fbea27b4
JWT_REFRESH_SECRET=61031659fefe91a9755265eb4e471eda39877ff6daa253bfb40b14818020a56b5a1b10d250cf725e5e4141c28c38a307c9d79eec360ce61ef348965fc449585c
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# Game Config
INITIAL_COINS=1000
MIN_PARTICIPANTS=3
AUTO_START_TIME=180000
ELIMINATION_INTERVAL=7000

# Distribution (must sum to 100)
WINNER_POOL_PERCENTAGE=70
ADMIN_POOL_PERCENTAGE=20
APP_POOL_PERCENTAGE=10

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

4. **Run in Development**
```bash
npm run dev
```

5. **Build for Production**
```bash
npm run build
npm start
```

## Socket.IO Events

### Connection
```javascript
const socket = io('http://localhost:3000', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

### Client → Server Events

#### Join Spin Wheel Room
```javascript
socket.emit('join_spin_wheel', spinWheelId);
```

#### Create Spin Wheel (Admin)
```javascript
socket.emit('create_spin_wheel', {
  entryFee: 100
});
```

#### Join Spin Wheel Game
```javascript
socket.emit('join_spin_wheel_game', {
  spinWheelId: '...'
});
```

#### Start Spin Wheel (Admin)
```javascript
socket.emit('start_spin_wheel', {
  spinWheelId: '...'
});
```

#### Get Active Spin Wheel
```javascript
socket.emit('get_active_spin_wheel');
```

### Server → Client Events

#### Spin Wheel Created
```javascript
socket.on('spin_wheel_created', (data) => {
  console.log('New spin wheel:', data.spinWheel);
});
```

#### Participant Joined
```javascript
socket.on('participant_joined', (data) => {
  console.log('New participant:', data.participant);
  console.log('Updated wheel:', data.spinWheel);
});
```

#### Spin Wheel Started
```javascript
socket.on('spin_wheel_started', (data) => {
  console.log('Game started!', data.spinWheel);
});
```

#### Participant Eliminated
```javascript
socket.on('participant_eliminated', (data) => {
  console.log('Eliminated:', data.eliminatedParticipant);
  console.log('Remaining:', data.spinWheel.participants.filter(p => !p.isEliminated));
});
```

#### Spin Wheel Completed
```javascript
socket.on('spin_wheel_completed', (data) => {
  console.log('Winner:', data.spinWheel.winnerUsername);
  console.log('Prize:', data.spinWheel.winnerPool);
});
```

#### Spin Wheel Aborted
```javascript
socket.on('spin_wheel_aborted', (data) => {
  console.log('Game aborted:', data.reason);
});
```

#### Errors
```javascript
socket.on('error', (data) => {
  console.error('Error:', data.message);
});
```

---

## Database Schema

### User Model
```typescript
{
  username: String (unique, 3-30 chars),
  email: String (unique, valid email),
  password: String (hashed, min 6 chars),
  role: 'user' | 'admin',
  coins: Number (default: 1000, min: 0),
  isActive: Boolean (default: true),
  lastLogin: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### SpinWheel Model
```typescript
{
  adminId: ObjectId (ref: User),
  adminUsername: String,
  entryFee: Number (min: 1),
  status: 'waiting' | 'in_progress' | 'completed' | 'aborted',
  participants: [{
    userId: ObjectId,
    username: String,
    joinedAt: Date,
    entryFeePaid: Number,
    isEliminated: Boolean,
    eliminatedAt: Date,
    eliminationOrder: Number
  }],
  maxParticipants: Number (default: 50),
  minParticipants: Number (default: 3),
  
  // Prize pools
  winnerPool: Number,
  adminPool: Number,
  appPool: Number,
  
  // Distribution config
  winnerPoolPercentage: Number (0-100),
  adminPoolPercentage: Number (0-100),
  appPoolPercentage: Number (0-100),
  
  // Timing
  autoStartTime: Number (ms),
  eliminationInterval: Number (ms),
  startedAt: Date,
  completedAt: Date,
  
  // Winner
  winnerId: ObjectId,
  winnerUsername: String,
  
  // Elimination
  eliminationSequence: [ObjectId],
  currentEliminationIndex: Number,
  
  createdAt: Date,
  updatedAt: Date
}
```

### Transaction Model
```typescript
{
  userId: ObjectId (ref: User),
  username: String,
  spinWheelId: ObjectId (ref: SpinWheel),
  type: 'entry_fee' | 'refund' | 'prize_win' | 'admin_commission' | 'app_fee' | 'initial_bonus',
  amount: Number,
  balanceBefore: Number,
  balanceAfter: Number,
  metadata: Object,
  createdAt: Date
}
```

---

## Error Handling

### Error Response Format
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": [] // optional
}
```

### Common Error Codes
- `VALIDATION_ERROR`: Invalid input data
- `AUTH_ERROR`: Authentication failed
- `FORBIDDEN`: Access denied
- `NOT_FOUND`: Resource not found
- `CONFLICT`: Resource conflict (duplicate, concurrent modification)
- `INSUFFICIENT_FUNDS`: Not enough coins
- `SPIN_WHEEL_ERROR`: Game-specific errors
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `INTERNAL_ERROR`: Server error

### HTTP Status Codes
- `200`: Success
- `201`: Created
- `400`: Bad Request / Validation Error
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `409`: Conflict
- `429`: Too Many Requests
- `500`: Internal Server Error

---






  





