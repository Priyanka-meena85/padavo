// ==============================================================================
// VERCEL SERVERLESS FUNCTION ADAPTER FOR PADAVO SAAS ENGINE
// ==============================================================================
const handler = require('../server.js');

module.exports = (req, res) => {
  return handler(req, res);
};
