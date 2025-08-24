// emergencyBus.js
export const emergencyBus = {
  _subs: new Set(),
  on(cb) { this._subs.add(cb); return () => this._subs.delete(cb); },
  emit(payload) { this._subs.forEach(fn => fn(payload)); },
};
