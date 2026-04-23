export type PaperNoticeType = "default" | "warning" | "error" | "success";
const NOTICE_CLOSE_DELAY = 4000;

export interface PaperNoticeOptions {
  closeDelay?: number;
}

export interface ProgressHandle {
  update(progress: number, text: string): void;
  finish(text: string, closeDelay?: number): void;
}

export function showPaperNotice(
  text: string,
  type: PaperNoticeType,
  options: PaperNoticeOptions = {},
) {
  new ztoolkit.ProgressWindow(addon.data.config.addonName, {
    closeOnClick: true,
    closeTime: options.closeDelay ?? NOTICE_CLOSE_DELAY,
  })
    .createLine({
      text,
      type,
      progress: 100,
    })
    .show();
}

export function createPaperProgress(text: string): ProgressHandle {
  const popupWin = new ztoolkit.ProgressWindow(addon.data.config.addonName, {
    closeOnClick: true,
    closeTime: -1,
  })
    .createLine({
      text,
      type: "default",
      progress: 0,
    })
    .show();

  return {
    update(progress, nextText) {
      popupWin.changeLine({
        progress,
        text: nextText,
      });
    },
    finish(nextText, closeDelay = 5000) {
      popupWin.changeLine({
        progress: 100,
        text: nextText,
      });
      popupWin.startCloseTimer(closeDelay);
    },
  };
}
