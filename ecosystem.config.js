module.exports = {
  apps: [
    {
      name: "saraswati-backend",
      script: "./server.js",
      instances: "max", // Uses all CPU cores
      exec_mode: "cluster", // Enables load balancing
      env: {
        NODE_ENV: "development",
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 5000,
        // Add other env vars here if not using .env file
      }
    }
  ]
};