// Client-side config endpoint
// Returns public configuration values for the frontend

module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.status(200).json({
    SUPABASE_URL: (process.env.SUPABASE_URL || '').trim(),
    SUPABASE_ANON_KEY: (process.env.SUPABASE_ANON_KEY || '').trim(),
  });
};
