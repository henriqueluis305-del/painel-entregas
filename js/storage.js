const IS_LOCAL = ['localhost', '127.0.0.1', ''].includes(location.hostname);
const _DATA_PFX = '__data__';

const Storage = {
  isLocal: () => IS_LOCAL,

  async get(path) {
    if (IS_LOCAL) {
      const override = localStorage.getItem(_DATA_PFX + path);
      if (override !== null) return override;
      try {
        const r = await fetch(`data/${path}`);
        return r.ok ? r.text() : null;
      } catch { return null; }
    }
    return ghGet(path);
  },

  async getJSON(path) {
    const txt = await Storage.get(path);
    if (!txt) return null;
    try { return JSON.parse(txt); } catch { return null; }
  },

  async put(path, content, message) {
    if (IS_LOCAL) {
      localStorage.setItem(_DATA_PFX + path, content);
      return true;
    }
    return ghPut(path, content, message);
  },

  async listDir(path) {
    if (IS_LOCAL) {
      try {
        const lsOverride = localStorage.getItem('__manifest__');
        const manifest = lsOverride
          ? JSON.parse(lsOverride)
          : await fetch('data/manifest.json').then(r => r.json());
        return (manifest[path] || []).map(name => ({ name, type: 'dir' }));
      } catch { return []; }
    }
    return ghListDir(path);
  },
};
