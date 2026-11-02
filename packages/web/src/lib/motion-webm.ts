/**
 * **A WebM of one VP9 track, written in memory** (motion phase 3;
 * `docs/projects/motion/design.md` §4) — the muxer behind the render page's
 * WebM, our own rather than a dependency. `webm-muxer` (MIT, the same
 * author's as `mp4-muxer`) is marked deprecated upstream in favour of
 * Mediabunny, which is MPL-2.0; a WebM of one video track is a few dozen
 * lines of EBML, so it is owned here instead.
 *
 * What it writes, and nothing more: the EBML header (DocType `webm`); one
 * Segment of known size holding a SeekHead (pointing at Info, Tracks and
 * Cues), Info (millisecond timestamps, the duration), Tracks (one `V_VP9`
 * video track), a Cluster opened at every keyframe with each frame a
 * SimpleBlock, and Cues naming each cluster, so a player seeks without
 * reading the file through. Frames arrive in order from `VideoEncoder`
 * (VP9 has no reordered frames here), each with its keyframe flag.
 */

type Bytes = Uint8Array;

const concat = (parts: readonly Bytes[]): Bytes => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};

/** An element's size as an EBML variable-length integer, in as few bytes as hold it. */
function vsize(n: number): Bytes {
  let length = 1;
  while (length < 8 && n >= 2 ** (7 * length) - 1) length++;
  const out = new Uint8Array(length);
  let v = n;
  for (let i = length - 1; i >= 0; i--) {
    out[i] = v % 256;
    v = Math.floor(v / 256);
  }
  out[0] = out[0]! | (1 << (8 - length));
  return out;
}

/** An unsigned integer, big-endian, in `width` bytes (or the fewest that hold it). */
function uintBytes(v: number, width?: number): Bytes {
  let length = width ?? 1;
  if (width === undefined) while (length < 8 && v >= 2 ** (8 * length)) length++;
  const out = new Uint8Array(length);
  let x = v;
  for (let i = length - 1; i >= 0; i--) {
    out[i] = x % 256;
    x = Math.floor(x / 256);
  }
  return out;
}

const idBytes = (id: number): Bytes => uintBytes(id);
const el = (id: number, ...payload: Bytes[]): Bytes => {
  const body = concat(payload);
  return concat([idBytes(id), vsize(body.length), body]);
};
const uint = (id: number, v: number, width?: number) => el(id, uintBytes(v, width));
const str = (id: number, s: string) => el(id, new TextEncoder().encode(s));
const float = (id: number, v: number) => {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setFloat64(0, v);
  return el(id, b);
};

const ID = {
  EBML: 0x1a45dfa3, EBMLVersion: 0x4286, EBMLReadVersion: 0x42f7, EBMLMaxIDLength: 0x42f2, EBMLMaxSizeLength: 0x42f3,
  DocType: 0x4282, DocTypeVersion: 0x4287, DocTypeReadVersion: 0x4285,
  Segment: 0x18538067, SeekHead: 0x114d9b74, Seek: 0x4dbb, SeekID: 0x53ab, SeekPosition: 0x53ac,
  Info: 0x1549a966, TimestampScale: 0x2ad7b1, Duration: 0x4489, MuxingApp: 0x4d80, WritingApp: 0x5741,
  Tracks: 0x1654ae6b, TrackEntry: 0xae, TrackNumber: 0xd7, TrackUID: 0x73c5, TrackType: 0x83, FlagLacing: 0x9c,
  CodecID: 0x86, DefaultDuration: 0x23e383, Video: 0xe0, PixelWidth: 0xb0, PixelHeight: 0xba,
  Cluster: 0x1f43b675, Timestamp: 0xe7, SimpleBlock: 0xa3,
  Cues: 0x1c53bb6b, CuePoint: 0xbb, CueTime: 0xb3, CueTrackPositions: 0xb7, CueTrack: 0xf7, CueClusterPosition: 0xf1,
} as const;

/** One encoded frame: its bytes, its time in microseconds, and whether it is a keyframe. */
export interface WebmFrame {
  data: Bytes;
  timestamp: number;
  key: boolean;
}

/**
 * **A WebM, frame by frame.** `add` each encoded chunk as it arrives;
 * `finish(durationSeconds)` returns the file.
 */
export class WebmWriter {
  private readonly clusters: { time: number; blocks: Bytes[] }[] = [];

  constructor(private readonly video: { width: number; height: number; fps: number }) {}

  add(frame: WebmFrame): void {
    const ms = Math.round(frame.timestamp / 1000);
    let cluster = this.clusters.at(-1);
    // A cluster opens at every keyframe, and before a block's 16-bit
    // relative time could overflow.
    if (!cluster || frame.key || ms - cluster.time > 30_000) {
      if (!cluster && !frame.key) throw new Error("a WebM's first frame must be a keyframe");
      cluster = { time: ms, blocks: [] };
      this.clusters.push(cluster);
    }
    const head = new Uint8Array(4);
    head[0] = 0x81; // track 1, as a one-byte vint
    new DataView(head.buffer).setInt16(1, ms - cluster.time);
    head[3] = frame.key ? 0x80 : 0x00;
    cluster.blocks.push(el(ID.SimpleBlock, head, frame.data));
  }

  finish(seconds: number): Bytes {
    const header = el(ID.EBML,
      uint(ID.EBMLVersion, 1), uint(ID.EBMLReadVersion, 1), uint(ID.EBMLMaxIDLength, 4), uint(ID.EBMLMaxSizeLength, 8),
      str(ID.DocType, "webm"), uint(ID.DocTypeVersion, 4), uint(ID.DocTypeReadVersion, 2));
    const info = el(ID.Info, uint(ID.TimestampScale, 1_000_000), float(ID.Duration, seconds * 1000), str(ID.MuxingApp, "isocan"), str(ID.WritingApp, "isocan"));
    const tracks = el(ID.Tracks, el(ID.TrackEntry,
      uint(ID.TrackNumber, 1), uint(ID.TrackUID, 1), uint(ID.TrackType, 1), uint(ID.FlagLacing, 0), str(ID.CodecID, "V_VP9"),
      uint(ID.DefaultDuration, Math.round(1e9 / this.video.fps)),
      el(ID.Video, uint(ID.PixelWidth, this.video.width), uint(ID.PixelHeight, this.video.height))));
    const clusters = this.clusters.map((c) => el(ID.Cluster, uint(ID.Timestamp, c.time), ...c.blocks));
    // Positions are from the start of the Segment's body. The SeekHead's
    // positions are fixed at 8 bytes, so its own length is known before them.
    const seek = (positions: [number, number, number]) => el(ID.SeekHead,
      ...([ID.Info, ID.Tracks, ID.Cues] as const).map((id, i) => el(ID.Seek, el(ID.SeekID, idBytes(id)), uint(ID.SeekPosition, positions[i]!, 8))));
    const seekLength = seek([0, 0, 0]).length;
    const infoAt = seekLength, tracksAt = infoAt + info.length;
    let at = tracksAt + tracks.length;
    const clusterAt = clusters.map((c) => {
      const here = at;
      at += c.length;
      return here;
    });
    const cues = el(ID.Cues, ...this.clusters.map((c, i) => el(ID.CuePoint,
      uint(ID.CueTime, c.time),
      el(ID.CueTrackPositions, uint(ID.CueTrack, 1), uint(ID.CueClusterPosition, clusterAt[i]!)))));
    const body = concat([seek([infoAt, tracksAt, at]), info, tracks, ...clusters, cues]);
    return concat([header, idBytes(ID.Segment), vsize(body.length), body]);
  }
}
