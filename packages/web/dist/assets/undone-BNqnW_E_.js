function s(t){const n=new Map;for(const e of t)e.cause?.kind==="undo"?n.set(e.cause.targetSeq,e.seq):e.cause?.kind==="redo"&&n.delete(e.cause.targetSeq);return n}export{s as u};
