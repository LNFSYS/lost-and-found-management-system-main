# Socket.IO Chat Rollout

Updated: 2026-10-20. This replaces the native `ws` chat transport, not the notification SSE endpoint. It does not introduce video calling, a new business use case or a database migration.

## Contract And Security

- API and Web both use Socket.IO 4.x at `/api/realtime/chat-socket`. Handshake credentials are `auth: { accessToken, roomId }`, not query parameters. Do not log credentials or complete handshake objects.
- The server emits `ready: { roomId }`, `chat.message: { roomId, message }` and `auth_error: { code }`. Authentication failures also use Socket.IO `connect_error.data.code`.
- HTTP CORS and Socket.IO share the Origin predicate supplied by composition. Polling and direct WebSocket connections are both checked, including absent/disallowed origins according to that policy. Do not widen CORS to bypass deployment errors.
- The JWT, persisted session and room participant authorization are checked before registration. Session/room validation also runs before each private delivery and every 25 seconds. A five-second validation timeout fails closed; JWT expiry disconnects the client.
- Persisted text/image messages still use the existing authenticated HTTP endpoints with idempotency keys. Socket events are delivery notifications after commit, not an alternative write API or proof of DB persistence.
- The Web client ignores events before `ready`, mismatched room IDs and obsolete room/session generations. Reconnect requests an HTTP room resync. Forbidden/invalid requests stop retrying; an expired session attempts the existing refresh flow. Cleanup cancels pending handshakes and reconnect waits.

## Deployment

1. Build and deploy the API and Web from the same tested candidate. An old native-WebSocket client cannot communicate with the new protocol. Ask existing browser sessions to reload; avoid a rolling window with mixed API protocols.
2. Proxy `/api/realtime/chat-socket/` including its query string, WebSocket Upgrade headers and HTTP polling requests to the API. Keep the existing HTTP and notification SSE routes working.
3. Set the allowed frontend origins to the actual application origins. Configure HTTPS/WSS at the edge. Never put access tokens into URLs or proxy logs.
4. Start with one API instance. The hub is in memory: this change does not add a shared Socket.IO adapter or cross-instance message fan-out. Multiple instances need sticky routing for polling plus a shared publisher/adapter and separate acceptance tests; sticky routing alone is insufficient.
5. Verify two participants can exchange text and images, reconnect resyncs missed messages, switching rooms does not leak messages, expired/revoked sessions disconnect, and nonparticipants/disallowed origins fail. Verify notifications still use SSE.
6. Rollback both API and Web together. No SQL rollback is required for this transport change.

## Verification Scope

API adapter regression tests use real Socket.IO clients over polling and WebSocket. They cover private room scoping, text/image delivery, malformed auth, Origin restrictions, session/room revocation, validation timeout and shutdown during authentication. Browser transport tests bundle the real API client with Vite and use a local Socket.IO server; only HTTP auth responses are synthetic. The wider UI suite remains separate from these protocol tests.

Local tests do not certify a production proxy, multiple API instances, real mobile devices, load/failover or video calls. Guarded SQL integration suites require an isolated loopback test database. No Aiven writes are necessary for this rollout.
