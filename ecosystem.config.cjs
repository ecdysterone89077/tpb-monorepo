// PM2 process definition for the NestJS API
module.exports = {
  apps: [
    {
      name: "tpb-api",
      cwd: __dirname,
      script: "apps/api/dist/main.js",
      instances: 1,
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
