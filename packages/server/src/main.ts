import { startDaemon } from "./daemon.ts";

const port = Number(process.env.ISOCAN_PORT ?? 4441);
startDaemon({ port }).catch((err) => {
  console.error(err);
  process.exit(1);
});
