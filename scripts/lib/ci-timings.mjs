/** Elapsed intervals from one run; parallel jobs must never be added together. */
export function ciTiming(run, jobs) {
  const millis = (value) => value ? Date.parse(value) : NaN;
  const completed = jobs.filter((job) => Number.isFinite(millis(job.started_at)) && Number.isFinite(millis(job.completed_at)));
  const created = millis(run.createdAt);
  if (!completed.length || !Number.isFinite(created)) return null;
  const started = Math.min(...completed.map((job) => millis(job.started_at)));
  const ended = Math.max(...completed.map((job) => millis(job.completed_at)));
  const green = completed.flatMap((job) => job.steps ?? [])
    .find((step) => step.name.startsWith("Advance `green`") && step.conclusion === "success");
  const greenAt = millis(green?.completed_at);
  return {
    queue: (started - created) / 1000,
    execution: (ended - started) / 1000,
    elapsed: (ended - created) / 1000,
    green: Number.isFinite(greenAt) ? (greenAt - created) / 1000 : null,
  };
}
