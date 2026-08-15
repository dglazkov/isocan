import { runDaemon } from "./daemon.ts";

runDaemon({
  ...(process.env.ISOCAN_PORT ? { port: Number(process.env.ISOCAN_PORT) } : {}),
}).catch((err: unknown) => {
  const code = (err as NodeJS.ErrnoException).code;
  if (code === "EADDRINUSE") {
    // Port bind is the spawn-race mutex: another daemon won; that's success.
    console.log("isocan daemon already running");
    process.exit(0);
  }
  console.error(err);
  process.exit(1);
});
