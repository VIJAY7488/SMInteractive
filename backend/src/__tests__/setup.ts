// Set required env vars before any test runs
process.env.JWT_SECRET         = 'test-secret-key-for-jest';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-jest';
process.env.JWT_EXPIRES_IN     = '1d';
process.env.NODE_ENV           = 'test';
