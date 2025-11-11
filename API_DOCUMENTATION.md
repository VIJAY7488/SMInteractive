# Spin Wheel Game API Documentation

## Base URL
```
http://localhost:4000/api
```

---

## Authentication Endpoints

### 1. Register User
**POST** `/auth/register`

**Request Body:**
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "password123",
  "role": "user" // or "admin"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "username": "johndoe",
      "email": "john@example.com",
      "role": "user",
      "coins": 1000
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 2. Login
**POST** `/auth/login`

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { /* user object */ },
    "accessToken": "...",
    "refreshToken": "..."
  }
}
```

### 3. Get Profile
**GET** `/auth/profile`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "username": "johndoe",
      "email": "john@example.com",
      "role": "user",
      "coins": 1000,
      "lastLogin": "2025-01-15T10:30:00.000Z",
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

---

## Spin Wheel Endpoints

### 1. Create Spin Wheel (Admin Only)
**POST** `/spin-wheels`

**Headers:**
```
Authorization: Bearer <adminAccessToken>
```

**Request Body:**
```json
{
  "entryFee": 100,
  "maxParticipants": 10
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "message": "Spin wheel created successfully",
  "data": {
    "spinWheel": {
      "id": "...",
      "adminId": "...",
      "adminUsername": "admin",
      "entryFee": 100,
      "status": "waiting",
      "maxParticipants": 10,
      "minParticipants": 3,
      "winnerPoolPercentage": 70,
      "adminPoolPercentage": 20,
      "appPoolPercentage": 10,
      "autoStartAt": "2025-01-15T10:33:00.000Z",
      "createdAt": "2025-01-15T10:30:00.000Z"
    }
  }
}
```

### 2. Get Active Spin Wheel
**GET** `/spin-wheels/active`

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Active spin wheel retrieved successfully",
  "data": {
    "spinWheel": {
      "id": "...",
      "adminUsername": "admin",
      "entryFee": 100,
      "status": "waiting",
      "participants": [
        {
          "userId": "...",
          "username": "user1",
          "joinedAt": "2025-01-15T10:31:00.000Z",
          "isEliminated": false
        }
      ],
      "totalParticipants": 1,
      "winnerPool": 70,
      "adminPool": 20,
      "appPool": 10,
      "totalPool": 100,
      "autoStartAt": "2025-01-15T10:33:00.000Z"
    }
  }
}
```

### 3. Join Spin Wheel
**POST** `/spin-wheels/join`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Request Body:**
```json
{
  "spinWheelId": "507f1f77bcf86cd799439011"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Successfully joined spin wheel",
  "data": {
    "spinWheel": {
      "id": "...",
      "status": "waiting",
      "totalParticipants": 2,
      "maxParticipants": 10,
      "totalPool": 200
    },
    "userBalance": 900
  }
}
```

### 4. Start Spin Wheel (Admin Only)
**POST** `/spin-wheels/:spinWheelId/start`

**Headers:**
```
Authorization: Bearer <adminAccessToken>
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Spin wheel started successfully",
  "data": {
    "spinWheel": {
      "id": "...",
      "status": "in_progress",
      "totalParticipants": 5,
      "eliminationSequence": ["userId1", "userId2", "userId3", "userId4", "userId5"],
      "startedAt": "2025-01-15T10:35:00.000Z"
    }
  }
}
```

### 5. Abort Spin Wheel (Admin Only)
**POST** `/spin-wheels/:spinWheelId/abort`

**Headers:**
```
Authorization: Bearer <adminAccessToken>
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Spin wheel aborted and participants refunded",
  "data": {
    "spinWheel": {
      "id": "...",
      "status": "aborted",
      "participantsRefunded": 2,
      "completedAt": "2025-01-15T10:36:00.000Z"
    }
  }
}
```

### 6. Get Spin Wheel by ID
**GET** `/spin-wheels/:spinWheelId`

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Spin wheel retrieved successfully",
  "data": {
    "spinWheel": {
      "id": "...",
      "adminUsername": "admin",
      "entryFee": 100,
      "status": "completed",
      "participants": [ /* full participant list */ ],
      "winnerId": "...",
      "winnerUsername": "winner1",
      "totalPool": 1000,
      "winnerPool": 700,
      "adminPool": 200,
      "appPool": 100,
      "createdAt": "...",
      "completedAt": "..."
    }
  }
}
```

### 7. Get Spin Wheel Statistics
**GET** `/spin-wheels/:spinWheelId/stats`

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Spin wheel statistics retrieved successfully",
  "data": {
    "stats": {
      "status": "completed",
      "totalParticipants": 5,
      "eliminatedCount": 4,
      "remainingCount": 1,
      "totalPool": 500,
      "winnerPool": 350,
      "adminPool": 100,
      "appPool": 50,
      "entryFee": 100,
      "winner": {
        "userId": "...",
        "username": "winner1"
      }
    }
  }
}
```

### 8. Get Spin Wheel History
**GET** `/spin-wheels/history?page=1&limit=10&status=completed`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `status` (optional): Filter by status (waiting, in_progress, completed, aborted)

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Spin wheel history retrieved successfully",
  "data": {
    "spinWheels": [
      {
        "id": "...",
        "adminUsername": "admin",
        "entryFee": 100,
        "status": "completed",
        "totalParticipants": 5,
        "totalPool": 500,
        "winnerUsername": "winner1",
        "createdAt": "...",
        "completedAt": "..."
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "pages": 3
    }
  }
}
```

### 9. Get My Games
**GET** `/spin-wheels/my-games?page=1&limit=10`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "User spin wheel history retrieved successfully",
  "data": {
    "spinWheels": [
      {
        "id": "...",
        "adminUsername": "admin",
        "entryFee": 100,
        "status": "completed",
        "totalParticipants": 5,
        "isWinner": true,
        "prizeWon": 350,
        "userEliminated": false,
        "createdAt": "..."
      }
    ],
    "pagination": { /* pagination info */ }
  }
}
```

### 10. Check If User Can Join
**GET** `/spin-wheels/:spinWheelId/can-join`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "User join eligibility checked",
  "data": {
    "canJoin": true,
    "userBalance": 900
  }
}
```

---

## Transaction Endpoints

### 1. Get User Transactions
**GET** `/transactions?page=1&limit=20&type=entry_fee`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Items per page
- `type` (optional): Filter by type (entry_fee, prize_win, admin_commission, refund, app_fee)

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Transaction history retrieved successfully",
  "data": {
    "transactions": [
      {
        "id": "...",
        "type": "entry_fee",
        "amount": -100,
        "balanceBefore": 1000,
        "balanceAfter": 900,
        "spinWheelId": "...",
        "createdAt": "..."
      }
    ],
    "pagination": { /* pagination info */ }
  }
}
```

### 2. Get Transaction Statistics
**GET** `/transactions/stats`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Transaction statistics retrieved successfully",
  "data": {
    "stats": {
      "byType": [
        {
          "_id": "entry_fee",
          "count": 10,
          "totalAmount": -1000
        },
        {
          "_id": "prize_win",
          "count": 2,
          "totalAmount": 700
        }
      ],
      "totalTransactions": 12,
      "totalSpent": 1000,
      "totalEarned": 700,
      "netProfit": -300
    }
  }
}
```

### 3. Get Spin Wheel Transactions
**GET** `/transactions/spin-wheel/:spinWheelId`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Spin wheel transactions retrieved successfully",
  "data": {
    "transactions": [ /* transaction list */ ]
  }
}
```

---

## User Endpoints

### 1. Get User Balance
**GET** `/users/balance`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "User balance retrieved successfully",
  "data": {
    "userId": "...",
    "username": "johndoe",
    "coins": 900,
    "coinBalance": 900
  }
}
```

### 2. Get User Statistics
**GET** `/users/stats`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "User statistics retrieved successfully",
  "data": {
    "stats": {
      "currentBalance": 900,
      "totalGamesParticipated": 10,
      "totalWins": 2,
      "winRate": "20.00%",
      "totalTransactions": 15,
      "accountCreated": "...",
      "lastLogin": "..."
    }
  }
}
```

### 3. Get All Users (Admin)
**GET** `/users?page=1&limit=20&search=john`

**Headers:**
```
Authorization: Bearer <adminAccessToken>
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Users retrieved successfully",
  "data": {
    "users": [ /* user list */ ],
    "pagination": { /* pagination info */ }
  }
}
```

### 4. Add Coins to User (Admin)
**POST** `/users/:userId/add-coins`

**Headers:**
```
Authorization: Bearer <adminAccessToken>
```

**Request Body:**
```json
{
  "amount": 500,
  "reason": "Compensation"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Coins added successfully",
  "data": {
    "userId": "...",
    "username": "johndoe",
    "oldBalance": 900,
    "newBalance": 1400,
    "amountAdded": 500
  }
}
```

---

## Admin Endpoints

### 1. Get Dashboard Statistics
**GET** `/admin/dashboard`

**Headers:**
```
Authorization: Bearer <adminAccessToken>
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Dashboard statistics retrieved successfully",
  "data": {
    "users": {
      "total": 100,
      "active": 95,
      "admins": 5
    },
    "spinWheels": {
      "total": 50,
      "active": 2,
      "completed": 45
    },
    "transactions": {
      "total": 500
    },
    "revenue": {
      "appRevenue": 5000,
      "coinsInCirculation": 100000
    },
    "recentSpinWheels": [ /* recent games */ ]
  }
}
```

### 2. Get System Analytics
**GET** `/admin/analytics?startDate=2025-01-01&endDate=2025-01-31`

**Headers:**
```
Authorization: Bearer <adminAccessToken>
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "System analytics retrieved successfully",
  "data": {
    "spinWheelsOverTime": [ /* time series data */ ],
    "usersOverTime": [ /* time series data */ ],
    "revenueByType": [ /* revenue breakdown */ ],
    "topWinners": [ /* top 10 winners */ ],
    "mostActiveAdmins": [ /* admin leaderboard */ ]
  }
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": {
    "message": "Validation error message",
    "code": "VALIDATION_ERROR",
    "statusCode": 400
  }
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": {
    "message": "Authentication failed",
    "code": "AUTHENTICATION_ERROR",
    "statusCode": 401
  }
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": {
    "message": "You do not have permission to perform this action",
    "code": "AUTHORIZATION_ERROR",
    "statusCode": 403
  }
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": {
    "message": "Resource not found",
    "code": "NOT_FOUND",
    "statusCode": 404
  }
}
```

### 409 Conflict
```json
{
  "success": false,
  "error": {
    "message": "There is already an active spin wheel",
    "code": "CONFLICT_ERROR",
    "statusCode": 409
  }
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": {
    "message": "Internal server error",
    "statusCode": 500
  }
}
```

---
