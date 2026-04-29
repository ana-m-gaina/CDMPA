/**
 * Custom CAP server bootstrap — adds /api/chat proxy to the agent.
 * AGENT_URL env var defaults to http://localhost:8000/api/chat
 */
const cds = require('@sap/cds');

// Standard CDS bootstrap
const server = cds.server;

module.exports = async (options) => {
  const app = await server(options);

  // Guard: only register the chat proxy when app is a full Express app
  // (in test/in-memory mode cds.server may return a raw http.Server)
  if (app && typeof app.post === 'function') {
    const AGENT_URL = process.env.AGENT_URL || 'http://localhost:8000/api/chat';

    app.post('/api/chat', async (req, res) => {
      try {
        const response = await fetch(AGENT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(req.body),
        });
        if (!response.ok) {
          res.status(response.status).send(await response.text());
          return;
        }
        const text = await response.text();
        res.send(text);
      } catch (err) {
        res.status(502).send(`Agent unavailable: ${err.message}`);
      }
    });
  }

  return app;
};
