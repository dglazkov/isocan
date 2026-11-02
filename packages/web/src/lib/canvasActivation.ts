import { createContext } from "react";

/** A workspace's navigation never escapes into another canvas or its viewer. */
export const CanvasActivation = createContext<
  ((itemId: string) => boolean) | undefined
>(undefined);
