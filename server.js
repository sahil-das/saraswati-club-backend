require('dotenv').config();
const { app, PORT } = require('./src/app');

// Start Server (USING APP FROM app.js)
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
