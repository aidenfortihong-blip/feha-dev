// FEHA // CYBERDECK CORE
// Modular runtime registry for Cyberdeck/JACK IN subsystems.

(() => {
  try { globalThis.FEHA_CYBER_CORE?.destroy?.(); } catch {}

  const VERSION = "0.9.1";
  const modules = new Map();
  const listeners = new Map();
  let initialized = false;

  function bucket(event) {
    if (!listeners.has(event)) listeners.set(event,new Set());
    return listeners.get(event);
  }

  const api = {
    version:VERSION,

    registerModule(name,module) {
      const key = String(name ?? "").trim();
      if (!key) throw new Error("Cyberdeck module requires a name.");

      const previous = modules.get(key);
      try { previous?.destroy?.(); } catch (err) {
        console.warn("FEHA CYBER CORE // destroy previous module failed",key,err);
      }

      modules.set(key,module);

      if (initialized) {
        Promise.resolve(module?.init?.(api)).catch(err => {
          console.error("FEHA CYBER CORE // module init failed",key,err);
        });
      }

      return module;
    },

    module(name) {
      return modules.get(String(name ?? "").trim()) ?? null;
    },

    modules() {
      return new Map(modules);
    },

    on(event,handler) {
      if (typeof handler !== "function") return () => {};
      bucket(event).add(handler);
      return () => api.off(event,handler);
    },

    off(event,handler) {
      listeners.get(event)?.delete?.(handler);
    },

    async emit(event,payload) {
      const handlers = [...(listeners.get(event) ?? [])];
      const results = [];

      for (const handler of handlers) {
        try {
          results.push(await handler(payload,api));
        } catch (err) {
          console.error("FEHA CYBER CORE // event failed",event,err);
          results.push(undefined);
        }
      }

      return results;
    },

    async init() {
      if (initialized) return api;
      initialized = true;

      const failures = [];

      for (const [name,module] of modules) {
        try {
          await module?.init?.(api);
        } catch (err) {
          console.error("FEHA CYBER CORE // module init failed",name,err);
          failures.push({
            name,
            error:err
          });
        }
      }

      if (failures.length) {
        initialized = false;

        const error = new Error(
          "Cyberdeck module init failed: " +
          failures.map(entry => entry.name).join(", ")
        );

        error.failures = failures;
        throw error;
      }

      return api;
    },

    async destroy() {
      initialized = false;

      for (const [name,module] of [...modules].reverse()) {
        try {
          await module?.destroy?.(api);
        } catch (err) {
          console.warn("FEHA CYBER CORE // module destroy failed",name,err);
        }
      }

      modules.clear();
      listeners.clear();

      if (game?.adk?.cyberdeck === api) {
        delete game.adk.cyberdeck;
      }

      if (globalThis.FEHA_CYBER_CORE === api) {
        delete globalThis.FEHA_CYBER_CORE;
      }
    }
  };

  game.adk ??= {};
  game.adk.cyberdeck = api;
  globalThis.FEHA_CYBER_CORE = api;
})();
