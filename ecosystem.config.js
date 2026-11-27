export default {
  apps: [
    {
      name: "hestiia-api",
      script: "./dist/server.js",
      cwd: "/home/ubuntu/hestiia-api",
      instances: "max",
      exec_mode: "cluster",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      node_args: "--enable-source-maps",
      time: true,
      env: {
        NODE_ENV: "production",
      },
      env_production: {
        NODE_ENV: "production",
      },
    },
  ],
};
