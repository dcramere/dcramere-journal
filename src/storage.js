// Vervangt de window.storage-API uit Claude-artifacts door een versie die
// gewoon in de browser van de bezoeker draait (localStorage). Let op: dit
// betekent dat elke browser/apparaat zijn EIGEN journal heeft — er wordt
// niets gedeeld of gesynchroniseerd tussen mensen of apparaten.

const PREFIX = "dcramere-journal:";

function get(key) {
  return new Promise((resolve, reject) => {
    try {
      const value = window.localStorage.getItem(PREFIX + key);
      if (value === null) {
        reject(new Error(`Geen waarde gevonden voor key "${key}"`));
        return;
      }
      resolve({ key, value, shared: false });
    } catch (err) {
      reject(err);
    }
  });
}

function set(key, value) {
  return new Promise((resolve, reject) => {
    try {
      window.localStorage.setItem(PREFIX + key, value);
      resolve({ key, value, shared: false });
    } catch (err) {
      reject(err);
    }
  });
}

function del(key) {
  return new Promise((resolve, reject) => {
    try {
      window.localStorage.removeItem(PREFIX + key);
      resolve({ key, deleted: true, shared: false });
    } catch (err) {
      reject(err);
    }
  });
}

export const storage = { get, set, delete: del };
