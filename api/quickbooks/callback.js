// GET /api/quickbooks/callback
// Dedicated OAuth callback endpoint (Intuit doesn't support query params in redirect URIs)
// This simply forwards to the consolidated auth handler with action=callback

const authHandler = require('./auth');

module.exports = async (req, res) => {
  req.query = req.query || {};
  req.query.action = 'callback';
  return authHandler(req, res);
};
