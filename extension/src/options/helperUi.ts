import { downloadText } from "../platform/bundleIo.js";
import { buildWindowsInstaller, isWindows } from "../platform/helperInstaller.js";
import { getNativeClient, nativeEnabled, setNativeEnabled } from "../platform/nativeFolder.js";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const POLL_MS = 2000;
const POLL_LIMIT_MS = 5 * 60_000;

function advancedCommand(chromium: boolean): string {
  const id = chromium ? ` --chrome-id ${chrome.runtime.id}` : "";
  return `node extension/host/install-host.mjs --folder "<your SyncMark data folder>"${id}`;
}

async function connectedText(): Promise<string | null> {
  const client = await getNativeClient();
  return client ? `Connected. Shared folder: ${client.root || "(unknown)"}. Changes sync automatically.` : null;
}

async function turnOn(status: HTMLElement, box: HTMLInputElement): Promise<boolean> {
  const text = await connectedText();
  if (!text) return false;
  await setNativeEnabled(true);
  box.checked = true;
  status.textContent = text;
  return true;
}

/** Wait for the user to finish the downloaded setup, then switch instant sync on by itself. */
function waitForHelper(status: HTMLElement, box: HTMLInputElement): void {
  const started = Date.now();
  status.textContent = "Waiting for setup to finish… open the downloaded SyncMark-Setup file.";
  const timer = setInterval(async () => {
    if (await turnOn(status, box)) return clearInterval(timer);
    if (Date.now() - started > POLL_LIMIT_MS) {
      clearInterval(timer);
      status.textContent = "Still not connected. Run the downloaded setup file, then click Test connection.";
    }
  }, POLL_MS);
}

/** Optional native helper: one-click setup, auto-connect, instant two-way sync. */
export async function initHelperUi(chromium: boolean): Promise<void> {
  const box = $("helperOn") as HTMLInputElement;
  const status = $("helperStatus");
  const windows = isWindows();
  $("helperCmd").textContent = advancedCommand(chromium);
  $("helperSteps").classList.toggle("hidden", !windows);
  $("btnHelperSetup").classList.toggle("hidden", !windows);
  if (!windows) ($("helperAdvanced") as HTMLDetailsElement).open = true;

  box.checked = await nativeEnabled();
  if (box.checked) status.textContent = (await connectedText()) ?? "Helper not running. Click Test connection.";
  else if (await turnOn(status, box)) status.textContent += " (found automatically)";

  $("btnHelperSetup").addEventListener("click", () => {
    const geckoId = chrome.runtime.getManifest().browser_specific_settings?.gecko?.id;
    const text = buildWindowsInstaller(chromium ? chrome.runtime.id : "", geckoId);
    downloadText("SyncMark-Setup.cmd", text, "application/octet-stream");
    waitForHelper(status, box);
  });
  box.addEventListener("change", async () => {
    if (!box.checked) {
      await setNativeEnabled(false);
      status.textContent = "Instant sync is off. Using the folder picker and manual exchange.";
    } else if (!(await turnOn(status, box))) {
      box.checked = false;
      status.textContent = "Helper not found yet. Use Set up instant sync first.";
    }
  });
  $("btnHelperTest").addEventListener("click", async () => {
    status.textContent = "Testing…";
    status.textContent = (await connectedText()) ?? "Helper not found. Use Set up instant sync, then try again.";
  });
  $("btnHelperCopy").addEventListener("click", () => void navigator.clipboard.writeText($("helperCmd").textContent ?? ""));
}
