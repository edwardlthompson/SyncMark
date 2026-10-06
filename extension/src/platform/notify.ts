/** Completion feedback: system notification + short chime (respects reduced-motion / mute prefs). */

const NOTIFY_ICON = "../icons/icon128.png";

export async function playDoneChime(): Promise<void> {
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const t = ctx.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.08, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.setValueAtTime(1174, t + 0.09);
    osc.start(t);
    osc.stop(t + 0.25);
    await new Promise((r) => setTimeout(r, 280));
    await ctx.close();
  } catch {
    /* audio blocked or unavailable */
  }
}

export async function notifyDone(title: string, message: string): Promise<void> {
  void playDoneChime();
  try {
    if (!chrome.notifications?.create) return;
    await chrome.notifications.create(`syncmark-${Date.now()}`, {
      type: "basic",
      iconUrl: NOTIFY_ICON,
      title,
      message: message.slice(0, 250),
      priority: 1,
    });
  } catch {
    /* permission or API missing */
  }
}
