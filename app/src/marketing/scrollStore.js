let offset = 0;
const listeners = new Set();

export const marketingScrollStore = {
  getOffset() {
    return offset;
  },
  setOffset(value) {
    const next = Math.min(1, Math.max(0, value));
    if (next === offset) return;
    offset = next;
    listeners.forEach((listener) => listener(offset));
  },
  subscribe(listener) {
    listeners.add(listener);
    listener(offset);
    return () => listeners.delete(listener);
  },
};
