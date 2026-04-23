import { createPaperSidebarStore } from "./store";
import { createPaperSidebarViewModel } from "./viewModel";
import { renderPaperSidebar } from "./view";

export function mountPaperSidebar(
  body: HTMLDivElement,
  item: Zotero.Item | undefined,
  setSectionSummary: (summary: string) => void,
) {
  const store = createPaperSidebarStore(item);

  const rerender = () => {
    const vm = createPaperSidebarViewModel(store);
    renderPaperSidebar(body, vm);
    setSectionSummary(store.getSummary());
  };

  store.subscribe(rerender);
  rerender();
  void store.autoSync();
}
