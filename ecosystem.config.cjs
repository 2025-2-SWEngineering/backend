module.exports = {
  apps: [
    {
      name: "woori-backend",
      script: "dist/server.js",
      cwd: "/home/woori-account/woori-account/backend",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      time: true,
      env: {
        NODE_ENV: "production", // 나머지 값은 .env에서 로드됨
      },
    },
  ],
};
