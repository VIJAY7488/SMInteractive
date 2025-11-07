import { getEnv } from "../utils/get-env"

const envConfig = () => ({
    NODE_ENV: getEnv("NODE_ENV", "development"),
    PORT: getEnv('PORT', '4000'),
    MONGO_URI: getEnv("MONGO_URI"),
    JWT_SECRET: getEnv("JWT_SECRET"),
    JWT_EXPIRES_IN: getEnv("JWT_EXPIRES_IN", "1d"),
    LOG_LEVEL: getEnv("LOG_LEVEL", "info"),
})

export const ENV = envConfig();