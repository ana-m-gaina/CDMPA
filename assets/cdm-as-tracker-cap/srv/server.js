/**
 * Custom CAP server bootstrap — adds /api/chat proxy to the agent.
 * AGENT_URL env var defaults to http://localhost:8000/api/chat
 */
const cds = require('@sap/cds');

// Standard CDS bootstrap
const server = cds.server;

module.exports = async (options) => {
  const app = await server(options);

  const AGENT_URL = process.env.AGENT_URL || 'http://localhost:8000/api/chat';

  app.post('/api/chat', async (req, res) => {
    try {
      // Use dynamic import for node-fetch compatibility or use built-in fetch (Node 18+)
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

  return app;
};
