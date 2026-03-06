export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { loadSettingsIntoEnv } = await import("./lib/settings-manager");
    await loadSettingsIntoEnv();
  }
}
