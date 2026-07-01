module.exports = {
  apps: [
    {
      name: 'appgontijo-api',
      script: 'server.js',
      cwd: __dirname,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
}
