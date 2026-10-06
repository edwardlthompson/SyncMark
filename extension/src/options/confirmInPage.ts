/** In-page confirm — never use window.confirm (Firefox “prevent dialogs” breaks deletes). */

export function confirmInPage(opts: {
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
}): Promise<boolean> {
  return new Promise((resolve) => {
    const existing = document.getElementById("syncmarkConfirm");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "syncmarkConfirm";
    overlay.className = "confirm-overlay";
    overlay.setAttribute("role", "alertdialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "syncmarkConfirmTitle");

    const panel = document.createElement("div");
    panel.className = "confirm-panel";
    panel.innerHTML = `<h3 id="syncmarkConfirmTitle"></h3><p class="confirm-body"></p>`;
    (panel.querySelector("h3") as HTMLElement).textContent = opts.title;
    (panel.querySelector(".confirm-body") as HTMLElement).textContent = opts.body;

    const row = document.createElement("div");
    row.className = "row";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "secondary";
    cancel.textContent = opts.cancelLabel ?? "Cancel";
    const ok = document.createElement("button");
    ok.type = "button";
    ok.className = "danger";
    ok.textContent = opts.confirmLabel ?? "Remove";
    row.append(cancel, ok);
    panel.append(row);
    overlay.append(panel);
    document.body.append(overlay);
    ok.focus();

    const finish = (value: boolean) => {
      overlay.remove();
      resolve(value);
    };
    cancel.addEventListener("click", () => finish(false));
    ok.addEventListener("click", () => finish(true));
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) finish(false);
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        document.removeEventListener("keydown", onKey);
        finish(false);
      }
    };
    document.addEventListener("keydown", onKey);
  });
}
