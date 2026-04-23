interface PrefFieldState {
  key: "paperPlaneBaseURL";
  value: string;
  normalizedValue: string;
  valid: boolean;
}

export interface PreferencesViewModel {
  fields: {
    paperPlaneBaseURL: PrefFieldState;
  };
  updateField(key: PrefFieldState["key"], value: string): void;
  normalizeField(key: PrefFieldState["key"]): void;
}

export function createPrefsViewModel(window: Window): PreferencesViewModel {
  const input = window.document.querySelector(
    `#zotero-prefpane-${addon.data.config.addonRef}-paperPlaneBaseURL`,
  ) as HTMLInputElement | null;

  const initialValue = input?.value || "";
  const state: PrefFieldState = {
    key: "paperPlaneBaseURL",
    value: initialValue,
    normalizedValue: normalizeBaseURL(initialValue),
    valid: isValidServiceBaseURL(initialValue),
  };

  return {
    fields: {
      paperPlaneBaseURL: state,
    },
    updateField(_key, value) {
      state.value = value;
      state.normalizedValue = normalizeBaseURL(value);
      state.valid = isValidServiceBaseURL(value);
    },
    normalizeField(_key) {
      state.value = normalizeBaseURL(state.value);
      state.normalizedValue = state.value;
      state.valid = isValidServiceBaseURL(state.value);
    },
  };
}

function normalizeBaseURL(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function isValidServiceBaseURL(value: string) {
  const normalized = normalizeBaseURL(value);
  if (!normalized) {
    return true;
  }

  try {
    const parsed = new URL(normalized);
    return Boolean(parsed.protocol && parsed.host);
  } catch (_error) {
    return false;
  }
}
