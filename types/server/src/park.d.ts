interface ParkClaim {
    parkId: string;
    cursor: number;
    redeliverUpTo: number | null;
}
export declare const parkCursorsFile: (home: string) => string;
export declare class ParkCursors {
    private readonly home;
    private rows;
    constructor(home: string);
    private key;
    private load;
    private save;
    /**
     * Open (and adopt) the row. `seed` supplies "now" for a first-ever park;
     * `actorSpoke` answers whether the actor authored anything after the given
     * seq — the completion evidence for an outstanding delivery.
     */
    claim(canvasId: string, actorId: string, opts: {
        since?: number | undefined;
        /** Floor for a row being CREATED — an enrolled agent's standing began
         * at its enrolment op, not at its first claim (journey 3). Ignored
         * when the row exists: it is a birth fact, never a rewind. */
        seedAt?: number | undefined;
        seed: () => Promise<number>;
        actorSpoke: (afterSeq: number) => Promise<boolean>;
    }): Promise<ParkClaim>;
    /** A wake handed entries out, up to `tip`. Records the high-water; the
     * cursor stays put until a claim finds completion. False = lease lost. */
    delivered(canvasId: string, actorId: string, parkId: string, tip: number): Promise<boolean>;
    /** A lap matched nothing: settle up to `to` without a turn. False = lease
     * lost — the one other moment a displaced park finds out. */
    advance(canvasId: string, actorId: string, parkId: string, to: number): Promise<boolean>;
}
export {};
