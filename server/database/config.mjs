export function databaseConfigFromEnv(environment) {
  return environment.DATABASE_URL
    ? { connectionString: environment.DATABASE_URL }
    : {
        host: environment.DB_HOST || "127.0.0.1",
        port: Number(environment.DB_PORT || 5432),
        database: environment.DB_NAME || "ipi",
        user: environment.DB_USER || "ipi",
        password: environment.DB_PASSWORD || "ipi",
      };
}
