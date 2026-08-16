import { runDaemon } from "./daemon.ts";

// `npm run dev` means "the daemon I just started is the one serving". Bowing
// out to whoever already holds the port is how you end up talking to a stale
// daemon for an hour without a single error to show for it — so take the
// port instead, and say whose it was.
runDaemon({
  takeover: true,
  ...(process.env.ISOCAN_PORT ? { port: Number(process.env.ISOCAN_PORT) } : {}),
}).catch((err: unknown) => {
  console.error(`isocan daemon: ${(err as Error).message}`);
  process.exit(1);
});
