(function () {
  const GIFTS_KEY = "gpp_gifts_v1";
  const SELECTIONS_KEY = "gpp_selections_v1";

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  function gifts() {
    return read(GIFTS_KEY, []);
  }

  function selections() {
    return read(SELECTIONS_KEY, []);
  }

  function saveGifts(list) {
    write(GIFTS_KEY, list);
  }

  function saveSelections(list) {
    write(SELECTIONS_KEY, list);
  }

  function selectedCountByGift() {
    const map = {};
    for (const s of selections()) {
      map[s.giftId] = (map[s.giftId] || 0) + 1;
    }
    return map;
  }

  function giftWithAvailability() {
    const counts = selectedCountByGift();
    return gifts().map((g) => ({
      ...g,
      selected: counts[g.id] || 0,
      remaining: Math.max(0, Number(g.quantity || 0) - (counts[g.id] || 0)),
    }));
  }

  function csvEscape(val) {
    const s = String(val ?? "");
    if (s.includes(",") || s.includes("\n") || s.includes('"')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function downloadCsv(filename, rows) {
    const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }

  window.GPP = {
    uid,
    gifts,
    selections,
    saveGifts,
    saveSelections,
    giftWithAvailability,
    downloadCsv,
  };
})();
