import { PreferencesViewModel } from "./viewModel";

export function bindPreferencesPage(
  viewModel: PreferencesViewModel,
  doc: Document,
) {
  const input = doc.querySelector(
    `#zotero-prefpane-${addon.data.config.addonRef}-paperPlaneBaseURL`,
  ) as HTMLInputElement | null;

  const shell = doc.querySelector(".ppx-pref-shell");
  if (!input || !shell) {
    return;
  }

  const syncInputState = () => {
    input.value = viewModel.fields.paperPlaneBaseURL.value;
    shell.classList.toggle(
      "is-invalid",
      !viewModel.fields.paperPlaneBaseURL.valid,
    );
    input.setAttribute(
      "aria-invalid",
      String(!viewModel.fields.paperPlaneBaseURL.valid),
    );
  };

  input.addEventListener("input", () => {
    viewModel.updateField("paperPlaneBaseURL", input.value);
    syncInputState();
  });

  input.addEventListener("change", () => {
    viewModel.normalizeField("paperPlaneBaseURL");
    syncInputState();
  });

  syncInputState();
}
