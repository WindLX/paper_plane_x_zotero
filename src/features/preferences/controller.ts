import { bindPreferencesPage } from "./view";
import { createPrefsViewModel } from "./viewModel";

export async function registerPrefsScripts(window: Window) {
  const viewModel = createPrefsViewModel(window);
  bindPreferencesPage(viewModel, window.document);
}
