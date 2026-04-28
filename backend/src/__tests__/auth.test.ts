/**
 * Auth API — Integration Tests
 * Uses Supertest to hit the real Express app.
 * MongoDB models are mocked so no real DB is needed.
 *
 * NOTE: The auth controller currently has NO input validation middleware on
 * its routes (the Zod schemas in auth.validation.ts are defined but not wired).
 * Tests reflect the ACTUAL behaviour of the code.
 * TODO: Wire Zod validation middleware to auth routes for proper 400 responses.
 */

import request from 'supertest';
import app from '../app';

// ─── Shared mock data ─────────────────────────────────────────────────────────
const mockUserData = {
  _id:             '507f1f77bcf86cd799439011',
  name:            'Test User',
  email:           'test@example.com',
  role:            'user',
  coins:           1000,
  isActive:        true,
};

// ─── Mock User model ──────────────────────────────────────────────────────────
// Factory form avoids hoisting issues — jest.mock is hoisted before imports.
jest.mock('../models/user.models', () => {
  const instance = {
    _id:             '507f1f77bcf86cd799439011',
    name:            'Test User',
    email:           'test@example.com',
    role:            'user',
    coins:           1000,
    isActive:        true,
    comparePassword: jest.fn(),
    save:            jest.fn().mockResolvedValue(true),
  };
  const Ctor: any = jest.fn().mockImplementation(() => instance);
  Ctor.findOne  = jest.fn();
  Ctor.findById = jest.fn();
  return { __esModule: true, default: Ctor };
});

import User from '../models/user.models';
const MockUser = User as any;

// ─── Register Tests ───────────────────────────────────────────────────────────
describe('POST /api/auth/register', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no existing user (prevents spurious 409s)
    MockUser.findOne.mockResolvedValue(null);
  });

  it('should return 409 if email already exists', async () => {
    MockUser.findOne.mockResolvedValue(mockUserData);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test User', email: 'test@example.com', password: 'Pass@1234!' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('should return 201 and tokens on successful registration', async () => {
    MockUser.findOne.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'New User', email: 'new@example.com', password: 'Pass@1234!' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data).toHaveProperty('refreshToken');
    expect(res.body.data.user.email).toBe('test@example.com'); // from mock instance
  });
});

// ─── Login Tests ──────────────────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 401 if user does not exist', async () => {
    MockUser.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'Pass@1234!' });

    expect(res.status).toBe(401);
  });

  it('should return 401 if password is wrong', async () => {
    MockUser.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue({
        ...mockUserData,
        comparePassword: jest.fn().mockResolvedValue(false),
        save:            jest.fn(),
      }),
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'WrongPass@1' });

    expect(res.status).toBe(401);
  });

  it('should return 401 if account is deactivated', async () => {
    MockUser.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue({
        ...mockUserData,
        isActive:        false,
        comparePassword: jest.fn().mockResolvedValue(true),
        save:            jest.fn(),
      }),
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'Pass@1234!' });

    expect(res.status).toBe(401);
  });

  it('should return 200 and tokens on successful login', async () => {
    MockUser.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue({
        ...mockUserData,
        isActive:        true,
        comparePassword: jest.fn().mockResolvedValue(true),
        save:            jest.fn().mockResolvedValue(true),
      }),
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'Pass@1234!' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data).toHaveProperty('refreshToken');
  });
});

// ─── Profile Tests ────────────────────────────────────────────────────────────
describe('GET /api/auth/profile', () => {
  it('should return 401 if no token provided', async () => {
    const res = await request(app).get('/api/auth/profile');
    expect(res.status).toBe(401);
  });

  it('should return 401 if token is invalid', async () => {
    const res = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', 'Bearer this.is.not.valid');

    expect(res.status).toBe(401);
  });
});
