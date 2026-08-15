import { nanoid } from "nanoid";

export function newId(prefix: string): string {
  return `${prefix}_${nanoid(10)}`;
}

export const newProjectId = () => newId("prj");
export const newItemId = () => newId("itm");
export const newVersionId = () => newId("ver");
export const newThreadId = () => newId("thr");
export const newCommentId = () => newId("cmt");
export const newOpId = () => newId("op");
export const newActorId = () => newId("usr");
export const newClientId = () => newId("cli");
