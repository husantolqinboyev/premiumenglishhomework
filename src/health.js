// Health check endpoint for Render
const express = require('express');
const app = express();

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: '1.0.0'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'EduFlow Bot is running',
    status: 'healthy'
  });
});

// Keep-alive ping endpoint
app.get('/ping', (req, res) => {
  res.status(200).json({
    pong: true,
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Health check server running on port ${PORT}`);
  console.log(`📊 Health endpoint: http://localhost:${PORT}/health`);
  console.log(`🏓 Ping endpoint: http://localhost:${PORT}/ping`);
});

// Self-ping function to keep bot active
function startSelfPing() {
  const bot = require('./bot');
  const pingInterval = process.env.PING_INTERVAL || 300000; // 5 minutes
  
  setInterval(async () => {
    try {
      // Ping bot itself
      if (bot.telegram) {
        await bot.telegram.getMe();
        console.log(`🏓 Self-ping sent at ${new Date().toISOString()}`);
      }
    } catch (error) {
      console.error('❌ Self-ping failed:', error.message);
    }
  }, pingInterval);
  
  console.log(`🔄 Self-ping started with ${pingInterval/1000} seconds interval`);
}

// Start self-ping if enabled
if (process.env.ENABLE_SELF_PING === 'true') {
  startSelfPing();
}
