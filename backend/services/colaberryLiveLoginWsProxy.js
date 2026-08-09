// Proxies the noVNC WebSocket stream from a live-login container out to the
// browser, without ever exposing the container's port to the public
// internet directly. Auth is the signed stream token (see
// colaberryLiveLoginSessionManager.issueStreamToken/verifyStreamToken) since
// browser WebSocket connections can't carry Authorization headers.
const { WebSocketServer, WebSocket } = require('ws');
const { URL } = require('url');
const sessionManager = require('./colaberryLiveLoginSessionManager');

const STREAM_PATH_RE = /^\/api\/colaberry-login\/([^/]+)\/stream$/;

function attachWsProxy(httpServer) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url, 'http://internal');
    const match = url.pathname.match(STREAM_PATH_RE);
    if (!match) return; // not our path — let other upgrade handlers (if any) deal with it

    const sessionIdFromUrl = match[1];
    const token = url.searchParams.get('token');
    const claims = token && sessionManager.verifyStreamToken(token);

    if (!claims || claims.sessionId !== sessionIdFromUrl) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    const session = sessionManager.getSession(sessionIdFromUrl);
    if (!session || session.userId !== claims.userId) {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (clientWs) => {
      const target = new WebSocket(`ws://127.0.0.1:${session.vncHostPort}/`);

      const closeBoth = () => {
        if (clientWs.readyState === WebSocket.OPEN) clientWs.close(1000);
        if (target.readyState === WebSocket.OPEN) target.close(1000);
      };

      target.on('open', () => {
        clientWs.on('message', (data) => {
          if (target.readyState === WebSocket.OPEN) target.send(data);
        });
        target.on('message', (data) => {
          if (clientWs.readyState === WebSocket.OPEN) clientWs.send(data);
        });
      });

      target.on('error', (err) => {
        console.error(`[colaberry-live-login] proxy target error for ${sessionIdFromUrl}:`, err.message);
        closeBoth();
      });
      clientWs.on('error', (err) => {
        console.error(`[colaberry-live-login] proxy client error for ${sessionIdFromUrl}:`, err.message);
        closeBoth();
      });
      target.on('close', closeBoth);
      clientWs.on('close', closeBoth);
    });
  });
}

module.exports = { attachWsProxy };
