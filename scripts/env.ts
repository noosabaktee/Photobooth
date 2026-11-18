import nextEnv from "@next/env";

// Use the same precedence and dollar escaping as the application server.
nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
