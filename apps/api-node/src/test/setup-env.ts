const unitTestEnvironment: Record<string, string> = {
  NODE_ENV: "test",
  API_PORT: "0",
  FRONTEND_URL: "http://localhost:5173",
  DB_HOST: "127.0.0.1",
  DB_PORT: "1",
  DB_NAME: "lnfs_unit_test",
  DB_USER: "lnfs_unit_test",
  DB_PASSWORD: "lnfs_unit_test",
  DB_SSL: "false",
  JWT_ACCESS_SECRET: "unit_test_access_secret_123456789",
  SMTP_HOST: "127.0.0.1",
  SMTP_PORT: "1",
  SMTP_SECURE: "false",
  SMTP_USER: "unit-test@example.invalid",
  SMTP_PASS: "unit-test-password",
  SMTP_FROM: "unit-test@example.invalid",
  COOKIE_SECURE: "false",
  GEMINI_API_KEY: "",
  CLOUDINARY_CLOUD_NAME: "unit-test-cloud",
  CLOUDINARY_API_KEY: "unit-test-key",
  CLOUDINARY_API_SECRET: "unit-test-secret"
};

if (process.env.LNFS_TEST_USE_EXTERNAL_ENV !== "1") {
  Object.assign(process.env, unitTestEnvironment);
}
