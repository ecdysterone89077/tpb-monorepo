// PM2 process definition for the NestJS API.
// Provision production secrets in the host environment or secret manager before start.
module.exports = {
  apps: [
    {
      name: "tpb-api",
      cwd: __dirname,
      script: "apps/api/dist/main.js",
      instances: 1,
      autorestart: true,
      max_memory_restart: "512M",
      kill_timeout: 5000,
      listen_timeout: 10000,
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
