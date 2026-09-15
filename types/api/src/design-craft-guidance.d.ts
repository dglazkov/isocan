import type { DesignCraftPacket, DesignCraftStage } from "./design-craft-packet.js";
/** Reviewed adaptation identity, independent of the upstream skill, npm package and native engine versions. */
export declare const designCraftRevision = "isocan-craft-v1";
/** Stage selection loads only the source identities relevant to this bounded adaptation. */
export declare function designCraftSources(stage: DesignCraftStage): ({
    readonly path: "reference/adapt.md";
    readonly bytes: 11301;
    readonly gitBlob: "85f7c022f5c65baebdd8df16b996898a4f520e3a";
    readonly sha256: "871a8e4d749b807c693ebabd83defbd6c76e1bd2a0f53a28a460cb1308ba8634";
} | {
    readonly path: "reference/craft-floor.md";
    readonly bytes: 5500;
    readonly gitBlob: "ae213ce801ebb2085033b309b4144e8d7e9996ba";
    readonly sha256: "e802e4f7bdc89050a9c0f2ca506e1d493a2316e6e810c0336c57aa073717ef3e";
} | {
    readonly path: "reference/critique.md";
    readonly bytes: 45944;
    readonly gitBlob: "c1285ca137d9aa1280e538601a0e84140246fe56";
    readonly sha256: "cb8caddbb3919e5bf7f252143b519fb16db28a244642d937b186cb89962d9201";
} | {
    readonly path: "reference/harden.md";
    readonly bytes: 9450;
    readonly gitBlob: "124742e1cca3caff2c495009a8f408382e73e7d1";
    readonly sha256: "16ba7fca1973c5faf53dd2ca523559129c0fe9e5f8d50b645f527afa78186cd2";
} | {
    readonly path: "reference/new-work.md";
    readonly bytes: 52769;
    readonly gitBlob: "cd2a22b98eac53ddfe5c2d61b4a31be693e58fe4";
    readonly sha256: "85b9c2d051de94ee9129c58be111946f73035ca62bbd2a3936f4fa48768fe5cf";
} | {
    readonly path: "reference/operate.md";
    readonly bytes: 4145;
    readonly gitBlob: "524f2c3ae9fa497284e9699f3ca5320cce5d05cf";
    readonly sha256: "a9d2203acd45ca33a13d5c68b02b23ed512425ac15f0e8438318ed124b43729d";
} | {
    readonly path: "reference/polish.md";
    readonly bytes: 6646;
    readonly gitBlob: "f93170f773cac058f51e289603aed7575d62a6a2";
    readonly sha256: "81666fc7f783b4e3514db6554e713dc0479bd9cdedb06e93d15f8b579aae869a";
})[];
/** Generates guidance from saved context; it neither asks questions nor claims inspection happened. */
export declare function designCraftGuidance(packet: Pick<DesignCraftPacket, "stage" | "request" | "governing" | "decisions">): string;
