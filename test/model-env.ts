/** Fixtures supply their own model settings after setup; the developer's
 * environment must not override the empty test keystore. */
export function isolateModelEnv(env: NodeJS.ProcessEnv): void {
  for (const name of ["TYPESAFE_API_KEY", "GEMINI_API_KEY", "ISOCAN_TEXT_API_KEY", "ISOCAN_TEXT_PROVIDER", "ISOCAN_TEXT_MODEL"]) {
    delete env[name];
  }
}
