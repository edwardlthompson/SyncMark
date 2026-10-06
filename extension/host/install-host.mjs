#!/usr/bin/env node
// Register the SyncMark native messaging host for Chrome/Edge/Brave and Firefox.
//   node install-host.mjs --folder "C:\Users\me\Documents\SyncMark" --chrome-id <extension id>
//   node install-host.mjs --uninstall
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const NAME = "com.syncmark.host";
const GECKO_ID = "syncmark@edwardlthompson.github.io";
const here = dirname(fileURLToPath(import.meta.url));

function arg(flag) {
  const out = [];
  process.argv.forEach((a, i) => a === flag && process.argv[i + 1] && out.push(process.argv[i + 1]));
  return out;
}

const win = process.platform === "win32";
const mac = process.platform === "darwin";
const regKeys = [
  ["chrome", "Software\\Google\\Chrome\\NativeMessagingHosts"],
  ["chrome", "Software\\Microsoft\\Edge\\NativeMessagingHosts"],
  ["chrome", "Software\\BraveSoftware\\Brave-Browser\\NativeMessagingHosts"],
  ["firefox", "Software\\Mozilla\\NativeMessagingHosts"],
];
const unixDirs = () => {
  const h = homedir();
  return mac
    ? [
        ["chrome", join(h, "Library/Application Support/Google/Chrome/NativeMessagingHosts")],
        ["chrome", join(h, "Library/Application Support/Microsoft Edge/NativeMessagingHosts")],
        ["firefox", join(h, "Library/Application Support/Mozilla/NativeMessagingHosts")],
      ]
    : [
        ["chrome", join(h, ".config/google-chrome/NativeMessagingHosts")],
        ["chrome", join(h, ".config/chromium/NativeMessagingHosts")],
        ["chrome", join(h, ".config/BraveSoftware/Brave-Browser/NativeMessagingHosts")],
        ["firefox", join(h, ".mozilla/native-messaging-hosts")],
      ];
};

function uninstall() {
  if (win) {
    for (const [, key] of regKeys) {
      try {
        execFileSync("reg", ["delete", `HKCU\\${key}\\${NAME}`, "/f"], { stdio: "ignore" });
      } catch {
        /* not registered */
      }
    }
  } else {
    for (const [, dir] of unixDirs()) rmSync(join(dir, `${NAME}.json`), { force: true });
  }
  console.log("SyncMark host unregistered.");
}

function install() {
  const folder = arg("--folder")[0];
  const chromeIds = arg("--chrome-id");
  if (!folder || !existsSync(join(resolve(folder), "space.json"))) {
    console.error('Pass --folder "<your SyncMark data folder>" (the one containing space.json).');
    process.exit(1);
  }
  writeFileSync(join(here, "config.json"), JSON.stringify({ root: resolve(folder) }, null, 2));

  const script = join(here, "syncmark-host.mjs");
  const launcher = join(here, win ? "syncmark-host.cmd" : "syncmark-host.sh");
  writeFileSync(
    launcher,
    win
      ? `@echo off\r\n"${process.execPath}" "${script}" %*\r\n`
      : `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`,
  );
  if (!win) chmodSync(launcher, 0o755);

  const manifest = (kind) => ({
    name: NAME,
    description: "SyncMark shared-folder helper",
    path: launcher,
    type: "stdio",
    ...(kind === "firefox"
      ? { allowed_extensions: [GECKO_ID] }
      : { allowed_origins: chromeIds.map((id) => `chrome-extension://${id}/`) }),
  });
  if (!chromeIds.length) console.warn("No --chrome-id given: Chrome/Edge/Brave will be skipped.");

  if (win) {
    for (const kind of ["chrome", "firefox"]) {
      if (kind === "chrome" && !chromeIds.length) continue;
      const file = join(here, `${NAME}.${kind}.json`);
      writeFileSync(file, JSON.stringify(manifest(kind), null, 2));
      for (const [k, key] of regKeys.filter(([k]) => k === kind)) {
        execFileSync("reg", ["add", `HKCU\\${key}\\${NAME}`, "/ve", "/t", "REG_SZ", "/d", file, "/f"], {
          stdio: "ignore",
        });
        void k;
      }
    }
  } else {
    for (const [kind, dir] of unixDirs()) {
      if (kind === "chrome" && !chromeIds.length) continue;
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `${NAME}.json`), JSON.stringify(manifest(kind), null, 2));
    }
  }
  console.log(`SyncMark host registered for ${resolve(folder)}. Restart your browser(s), then enable it in SyncMark settings.`);
}

if (process.argv.includes("--uninstall")) uninstall();
else install();
