/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useEffect, useState } from "react";
import type { ActorKinds } from "@isocan/core";

import { fetchActorKinds } from "./api.ts";

/**
 * **Who here is an agent.** Actor id → "agent"; people are absent, so an
 * unknown actor reads as a person — the safe direction for a face.
 *
 * A recorded fact, not a guess: the daemon writes the harness of every
 * claim into the actor registry (`core/claims.ts`), so an agent that
 * spoke here last week and is gone now is still known to have been one.
 * Same trade as marks — one fetch per tab, answered from the cache — and
 * for the same reason: a canvas draws a face in eight places.
 */
let cached: ActorKinds | null = null;
let inFlight: Promise<void> | null = null;
const listeners = new Set<(kinds: ActorKinds) => void>();

function loadActorKinds(): Promise<ActorKinds> {
  inFlight ??= fetchActorKinds()
    .then((kinds) => {
      cached = kinds;
      for (const listener of listeners) listener(kinds);
    })
    .catch(() => {
      // A home that will not answer leaves everybody a person, which is
      // what the face said before and reads as nothing being wrong.
      cached = {};
    });
  return inFlight.then(() => cached ?? {});
}

export function useActorKinds(): ActorKinds {
  const [kinds, setKinds] = useState<ActorKinds>(cached ?? {});
  useEffect(() => {
    listeners.add(setKinds);
    void loadActorKinds().then((k) => setKinds(k));
    return () => {
      listeners.delete(setKinds);
    };
  }, []);
  return kinds;
}

/** The word a face card says for somebody who is not here: an agent that
 *  spoke and left is "an agent, away", never just "away", because a room
 *  that reads as six absent people is a different room from one that reads
 *  as five agents and a person. */
export const isAgentActor = (kinds: ActorKinds, actorId: string): boolean => kinds[actorId] === "agent";
