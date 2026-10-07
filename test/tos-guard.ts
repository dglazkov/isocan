import type { Socket } from "node:net";

/**
 * **Setting the type of service to the default is not worth a failed request.**
 *
 * undici 7.30 calls `socket.setTypeOfService(request.typeOfService)` on every
 * HTTP/1.1 request, once connected and before the first byte is written, with
 * 0 — the operating system's own default — unless a caller asked otherwise.
 * On Darwin 27 that call throws `EINVAL` for a socket the kernel has already
 * given up on (seen 6 Oct 2026: `test/connect-deadline.test.ts`, whose
 * listener is stopped with a full accept queue). The raw `EINVAL` then
 * replaces the error that says what really happened to the connection.
 *
 * So: when setting 0 fails with `EINVAL`, nothing was lost — the socket keeps
 * the default it already had — and the request goes on to fail, or succeed,
 * on the connection's real state. Any other value, or any other error, is
 * thrown as before.
 */
export function guardTypeOfService(socket: Socket): Socket {
  const set = (socket as unknown as { setTypeOfService?: (tos: number) => Socket }).setTypeOfService;
  if (typeof set !== "function") return socket;
  (socket as unknown as { setTypeOfService: (tos: number) => Socket }).setTypeOfService = function (this: Socket, tos: number) {
    try {
      return set.call(this, tos);
    } catch (err) {
      if (tos === 0 && (err as { code?: string }).code === "EINVAL") return this;
      throw err;
    }
  };
  return socket;
}
