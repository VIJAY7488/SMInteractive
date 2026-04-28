/**
 * Spin Wheel API — Integration Tests
 * Tests the REST endpoints via Supertest with mocked auth middleware.
 */

import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app';

// ─── Silence Socket.IO server init during tests ───────────────────────────────
jest.mock('../config/socket.config', () => ({
  getSocketServer: jest.fn().mockReturnValue({
    emitToAll:        jest.fn(),
    emitToSpinWheel:  jest.fn(),
    emitToUser:       jest.fn(),
  }),
}));

jest.mock('../services/scheduler.service', () => ({
  getScheduler: jest.fn().mockReturnValue({
    scheduleAutoStart:      jest.fn(),
    startEliminationProcess: jest.fn(),
    clearAutoStartTimer:    jest.fn(),
  }),
}));

// ─── Mock SpinWheelService ────────────────────────────────────────────────────
jest.mock('../services/spinWheel.service', () => ({
  SpinWheelService: {
    createSpinWheel:    jest.fn(),
    joinSpinWheel:      jest.fn(),
    startSpinWheel:     jest.fn(),
    abortSpinWheel:     jest.fn(),
    getActiveSpinWheel: jest.fn(),
    getSpinWheelById:   jest.fn(),
    getSpinWheelHistory: jest.fn(),
    getUserSpinWheels:  jest.fn(),
    getSpinWheelStats:  jest.fn(),
    canUserJoin:        jest.fn(),
  },
}));

import { SpinWheelService } from '../services/spinWheel.service';

// ─── Mock auth middleware ─────────────────────────────────────────────────────
// Simulates a logged-in admin user
const mockAdminUser = {
  _id:      new mongoose.Types.ObjectId('507f1f77bcf86cd799439099'),
  name:     'Admin User',
  email:    'admin@example.com',
  role:     'admin',
  coins:    5000,
  isActive: true,
};

const mockRegularUser = {
  _id:      new mongoose.Types.ObjectId('507f1f77bcf86cd799439022'),
  name:     'Regular User',
  email:    'user@example.com',
  role:     'user',
  coins:    1000,
  isActive: true,
};

jest.mock('../middlewares/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    // Read from test header to switch between admin/user
    req.user = req.headers['x-test-role'] === 'admin' ? mockAdminUser : mockRegularUser;
    next();
  },
  authorize: (...roles: string[]) => (req: any, res: any, next: any) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ success: false, error: { message: 'Forbidden', code: 'FORBIDDEN', statusCode: 403 } });
    }
    next();
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────
const adminHeaders  = { 'Authorization': 'Bearer faketoken', 'x-test-role': 'admin' };
const userHeaders   = { 'Authorization': 'Bearer faketoken', 'x-test-role': 'user' };

const mockSpinWheel = {
  _id:               new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
  adminId:           mockAdminUser._id,
  adminName:         'Admin User',
  entryFee:          100,
  status:            'waiting',
  participants:      [],
  winnerPool:        0,
  adminPool:         0,
  appPool:           0,
  maxParticipants:   10,
  minParticipants:   3,
  autoStartAt:       new Date(Date.now() + 180000),
  createdAt:         new Date(),
};

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/spin-wheels', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 403 if a regular user tries to create a spin wheel', async () => {
    const res = await request(app)
      .post('/api/spin-wheels')
      .set(userHeaders)
      .send({ entryFee: 100, maxParticipants: 10 });

    expect(res.status).toBe(403);
  });

  it('should return 400 if entryFee is missing', async () => {
    const res = await request(app)
      .post('/api/spin-wheels')
      .set(adminHeaders)
      .send({ maxParticipants: 10 });

    expect(res.status).toBe(400);
  });

  it('should create a spin wheel successfully for an admin', async () => {
    (SpinWheelService.createSpinWheel as jest.Mock).mockResolvedValue(mockSpinWheel);

    const res = await request(app)
      .post('/api/spin-wheels')
      .set(adminHeaders)
      .send({ entryFee: 100, maxParticipants: 10 });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.spinWheel.entryFee).toBe(100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/spin-wheels/join', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 400 if spinWheelId is missing', async () => {
    const res = await request(app)
      .post('/api/spin-wheels/join')
      .set(userHeaders)
      .send({});

    expect(res.status).toBe(400);
  });

  it('should join successfully and return newUserBalance', async () => {
    (SpinWheelService.joinSpinWheel as jest.Mock).mockResolvedValue({
      spinWheel:      mockSpinWheel,
      newUserBalance: 900,
    });

    const res = await request(app)
      .post('/api/spin-wheels/join')
      .set(userHeaders)
      .send({ spinWheelId: mockSpinWheel._id.toString() });

    expect(res.status).toBe(200);
    expect(res.body.data.userBalance).toBe(900);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/spin-wheels/active', () => {
  it('should return null data when no active spin wheel', async () => {
    (SpinWheelService.getActiveSpinWheel as jest.Mock).mockResolvedValue(null);

    const res = await request(app)
      .get('/api/spin-wheels/active')
      .set(userHeaders);

    expect(res.status).toBe(200);
    expect(res.body.data.spinWheel).toBeNull();
  });

  it('should return the active spin wheel', async () => {
    (SpinWheelService.getActiveSpinWheel as jest.Mock).mockResolvedValue(mockSpinWheel);

    const res = await request(app)
      .get('/api/spin-wheels/active')
      .set(userHeaders);

    expect(res.status).toBe(200);
    expect(res.body.data.spinWheel).not.toBeNull();
    expect(res.body.data.spinWheel.status).toBe('waiting');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/spin-wheels/:id/start', () => {
  const id = mockSpinWheel._id.toString();

  it('should return 403 if a regular user tries to start', async () => {
    const res = await request(app)
      .post(`/api/spin-wheels/${id}/start`)
      .set(userHeaders);

    expect(res.status).toBe(403);
  });

  it('should start a spin wheel for an admin', async () => {
    (SpinWheelService.startSpinWheel as jest.Mock).mockResolvedValue({
      ...mockSpinWheel,
      status:              'in_progress',
      eliminationSequence: [new mongoose.Types.ObjectId()],
      startedAt:           new Date(),
    });

    const res = await request(app)
      .post(`/api/spin-wheels/${id}/start`)
      .set(adminHeaders);

    expect(res.status).toBe(200);
    expect(res.body.data.spinWheel.status).toBe('in_progress');
  });
});
