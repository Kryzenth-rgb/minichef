(function () {
  "use strict";

  var KEY = "minichef_save_v1";

  var LEVELS = [
    { clients: 6,  spawn: 7000, pat: 45000, rush: 0.2,  duo: 0.4,  goals: [55, 80, 105],   ch: "nolost" },
    { clients: 7,  spawn: 6500, pat: 43000, rush: 0.3,  duo: 0.5,  goals: [75, 105, 135],  ch: "noburn" },
    { clients: 8,  spawn: 6000, pat: 41000, rush: 0.35, duo: 0.5,  goals: [90, 125, 160],  ch: "combo:3" },
    { clients: 9,  spawn: 5500, pat: 40000, rush: 0.4,  duo: 0.55, goals: [105, 145, 185], ch: "perfect:5" },
    { clients: 10, spawn: 5200, pat: 38000, rush: 0.4,  duo: 0.6,  goals: [120, 165, 210], ch: "nolost" },
    { clients: 12, spawn: 4800, pat: 36000, rush: 0.45, duo: 0.6,  goals: [150, 205, 260], ch: "combo:4" }
  ];

  var UPGRADES = [
    { id: "grill", icon: "🔥", group: "Cuisine", title: "Gril rapide",
      text: "Brochettes cuites 12 % plus vite par niveau", costs: [60, 120, 200] },
    { id: "fry", icon: "🍌", group: "Cuisine", title: "Friteuse rapide",
      text: "Plantains frits 12 % plus vite par niveau", costs: [50, 100, 170] },
    { id: "price", icon: "💰", group: "Cuisine", title: "Prix des plats",
      text: "+10 % de pièces par plat et par niveau", costs: [80, 160, 260] },
    { id: "patience", icon: "⏳", group: "Salle", title: "Clients patients",
      text: "+12 % de patience par niveau", costs: [70, 140, 230] }
  ];

  var GRILL = { raw: 3000, burn: 6000, max: 8000 };
  var FRY = { raw: 2000, burn: 4500, max: 6000 };
  var SLOTS = 3;
  var CH_REWARD = 25;
  var ICON = { brochette: "🍢", plantain: "🍌" };
  var LABEL = { brochette: "les brochettes", plantain: "les plantains" };
  var FACES = ["👩", "👨", "🧑", "👵", "👴", "🧒"];

  var state = load();

  var cur = 0;
  var lv = LEVELS[0];
  var cfgG = GRILL;
  var cfgF = FRY;
  var pf = 1;
  var pm = 1;
  var phase = "intro";
  var after = "retry";

  var run = null;
  var clients = [null, null, null];
  var plate = [];
  var board = null;
  var grills = [null, null];
  var fryers = [null, null];
  var timers = [];
  var loop = null;

  /* ---------- Sauvegarde ---------- */
  function makeDefaults() {
    return {
      coins: 0, score: 0, level: 1,
      name: "Chef", served: 0, bestCombo: 0, threeStars: false, tips: true,
      stars: LEVELS.map(function () { return 0; }),
      chDone: LEVELS.map(function () { return false; }),
      up: { grill: 0, fry: 0, price: 0, patience: 0 }
    };
  }
  function load() {
    var s = makeDefaults();
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var d = JSON.parse(raw);
        Object.assign(s, d);
        s.up = Object.assign(makeDefaults().up, d.up || {});
        s.stars = LEVELS.map(function (_, i) { return (d.stars && d.stars[i]) || 0; });
        s.chDone = LEVELS.map(function (_, i) { return !!(d.chDone && d.chDone[i]); });
      }
    } catch (e) {}
    return s;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  /* ---------- Outils ---------- */
  function $(id) { return document.getElementById(id); }
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function clearTimers() {
    for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]);
    timers = [];
  }
  function show(id) {
    var screens = document.querySelectorAll(".screen");
    for (var i = 0; i < screens.length; i++) screens[i].classList.add("hidden");
    $(id).classList.remove("hidden");
  }
  function say(text) { $("hint").innerHTML = "<b>Auguste :</b> " + text; }
  function refresh() {
    state.level = 1 + Math.floor(state.score / 500);
    $("coins").textContent = state.coins;
  }
  function busy() {
    var c = $("chef");
    c.classList.remove("busy");
    void c.offsetWidth;
    c.classList.add("busy");
  }
  function toast(text) {
    var t = $("toast");
    t.textContent = text;
    t.classList.remove("show");
    void t.offsetWidth;
    t.classList.add("show");
  }
  function overlay(title, text, btn) {
    $("ov-title").textContent = title;
    $("ov-text").textContent = text;
    $("ov-btn").textContent = btn;
    $("overlay").classList.remove("hidden");
  }
  function updateCombo() {
    var el = $("combo");
    if (run && run.combo >= 2) {
      el.textContent = "🔥 x" + run.combo;
      el.classList.remove("hidden");
    } else {
      el.classList.add("hidden");
    }
  }
  function updateHud() {
    var g = lv.goals;
    var gain = run ? run.gain : 0;
    $("gfill").style.width = Math.min(100, gain / g[2] * 100) + "%";
    $("gtxt").textContent = gain;
    for (var k = 0; k < 3; k++) {
      var s = $("gs" + (k + 1));
      s.style.left = (g[k] / g[2] * 100) + "%";
      s.classList.toggle("on", gain >= g[k]);
    }
    $("left").textContent = run ? Math.max(0, lv.clients - run.done) : lv.clients;
  }

  /* ---------- Défis d'Auguste ---------- */
  function parseCh(ch) {
    var p = ch.split(":");
    return { k: p[0], n: parseInt(p[1] || "0", 10) };
  }
  function chText(ch) {
    var c = parseCh(ch);
    if (c.k === "nolost") return "ne perds aucun client";
    if (c.k === "noburn") return "ne brûle aucun plat";
    if (c.k === "combo") return "fais un combo x" + c.n;
    if (c.k === "perfect") return "sers " + c.n + " plats parfaits";
    return "";
  }
  function chOk(ch, r) {
    var c = parseCh(ch);
    if (c.k === "nolost") return r.lost === 0;
    if (c.k === "noburn") return r.burnt === 0;
    if (c.k === "combo") return r.best >= c.n;
    if (c.k === "perfect") return r.perfects >= c.n;
    return false;
  }

  /* ---------- Améliorations ---------- */
  function scale(b, f) {
    var raw = b.raw * f;
    var burn = raw + (b.burn - b.raw);
    return { raw: raw, burn: burn, max: burn + (b.max - b.burn) };
  }
  function barBg(c) {
    var a = (c.raw / c.max * 100).toFixed(1);
    var b = (c.burn / c.max * 100).toFixed(1);
    return "linear-gradient(to right,#e57373 0 " + a + "%,#F2C65D " + a + "% " + b + "%,#555 " + b + "% 100%)";
  }
  function applyUpgrades() {
    cfgG = scale(GRILL, 1 - 0.12 * state.up.grill);
    cfgF = scale(FRY, 1 - 0.12 * state.up.fry);
    pf = 1 + 0.12 * state.up.patience;
    pm = 1 + 0.10 * state.up.price;
    for (var i = 0; i < 2; i++) {
      $("gm" + i).parentNode.style.background = barBg(cfgG);
      $("fm" + i).parentNode.style.background = barBg(cfgF);
    }
  }
  function buy(id) {
    var u = null;
    for (var i = 0; i < UPGRADES.length; i++) if (UPGRADES[i].id === id) u = UPGRADES[i];
    if (!u) return false;
    var lvl = state.up[id] || 0;
    if (lvl >= u.costs.length) return false;
    var cost = u.costs[lvl];
    if (state.coins < cost) return false;
    state.coins -= cost;
    state.up[id] = lvl + 1;
    save();
    refresh();
    return true;
  }
  function nextLevel() {
    for (var i = 0; i < LEVELS.length; i++) if (state.stars[i] < 1) return i;
    return LEVELS.length - 1;
  }

  /* ---------- Clients ---------- */
  function leftOf(c) {
    return Math.max(0, 1 - (Date.now() - c.born) / c.patience);
  }

  function renderClients() {
    var html = "";
    for (var i = 0; i < SLOTS; i++) {
      var c = clients[i];
      if (!c) {
        html += '<div class="cslot empty" data-slot="' + i + '"><span>🪑</span></div>';
      } else {
        html += '<div class="cslot" data-slot="' + i + '">' +
          '<div class="face">' + c.face + "</div>" +
          '<div class="bubble"><div>';
        for (var k = 0; k < c.order.length; k++) {
          html += '<span class="dish">' + ICON[c.order[k]] + "</span>";
        }
        if (c.rushed) html += '<span class="rush">⏱</span>';
        html += '</div><div class="patience"><div id="pf' + i + '"></div></div></div></div>';
      }
    }
    $("salle").innerHTML = html;
    paintBars();
    markReady();
  }

  function paintBars() {
    for (var i = 0; i < SLOTS; i++) {
      var c = clients[i];
      if (!c || c.state !== "wait") continue;
      var f = $("pf" + i);
      if (!f) continue;
      var left = leftOf(c);
      f.style.width = (left * 100) + "%";
      f.classList.toggle("low", left < 0.3);
    }
  }

  function matches(order) {
    if (plate.length !== order.length) return false;
    var a = plate.map(function (p) { return p.type; }).sort().join();
    return a === order.slice().sort().join();
  }

  function markReady() {
    var els = document.querySelectorAll(".cslot");
    for (var k = 0; k < els.length; k++) {
      var i = parseInt(els[k].getAttribute("data-slot"), 10);
      var c = clients[i];
      els[k].classList.toggle("ready", !!c && c.state === "wait" && matches(c.order));
    }
  }

  function checkPatience() {
    for (var i = 0; i < SLOTS; i++) {
      var c = clients[i];
      if (c && c.state === "wait" && leftOf(c) <= 0) clientLeaves(i);
    }
  }

  function trySpawn() {
    if (!run || run.spawned >= lv.clients) return;
    var free = -1;
    for (var i = 0; i < SLOTS; i++) {
      if (!clients[i]) { free = i; break; }
    }
    if (free < 0) { later(trySpawn, 1500); return; }
    var rushed = run.spawned > 0 && Math.random() < lv.rush;
    var duo = run.spawned === 0 || Math.random() < lv.duo;
    var order = duo ? ["brochette", "plantain"]
      : (Math.random() < 0.5 ? ["brochette"] : ["plantain"]);
    clients[free] = {
      born: Date.now(),
      patience: (rushed ? lv.pat * 0.7 : lv.pat) * pf,
      rushed: rushed,
      face: FACES[Math.floor(Math.random() * FACES.length)],
      order: order,
      state: "wait"
    };
    run.spawned++;
    renderClients();
    if (run.spawned === 1) {
      say("Un client arrive ! Brochette : touche Poulet, Marinade, puis Embrocher. Plantains : directement à la friteuse.");
    } else if (rushed) {
      say("Attention, un client pressé ⏱ est arrivé : il a moins de patience !");
    }
    if (run.spawned < lv.clients) later(trySpawn, lv.spawn);
  }

  function finishClient(i) {
    run.done++;
    updateHud();
    later(function () { clients[i] = null; renderClients(); }, 900);
    if (run.done >= lv.clients) later(endService, 1300);
  }

  function clientLeaves(i) {
    var c = clients[i];
    if (!c || c.state !== "wait") return;
    c.state = "done";
    c.face = "😡";
    run.lost++;
    run.combo = 0;
    updateCombo();
    say("Un client est parti fâché… Sois plus rapide !");
    renderClients();
    finishClient(i);
  }

  /* ---------- Assiette ---------- */
  function renderPlate() {
    var html = "";
    for (var i = 0; i < 2; i++) {
      if (i < plate.length) html += '<div class="slot full">' + ICON[plate[i].type] + "</div>";
      else html += '<div class="slot"></div>';
    }
    $("plate").innerHTML = html;
    markReady();
  }

  function addToPlate(type, q) {
    for (var i = 0; i < plate.length; i++) {
      if (plate[i].type === type) {
        say("Il y a déjà " + LABEL[type] + " dans l'assiette !");
        return false;
      }
    }
    if (plate.length >= 2) { say("L'assiette est pleine."); return false; }
    plate.push({ type: type, q: q });
    busy();
    renderPlate();
    return true;
  }

  /* ---------- Planche de préparation ---------- */
  function renderBoard() {
    var b = $("board");
    var txt = { poulet: "🍗", marine: "🍗🌶️", brochette: "🍢" };
    b.textContent = board ? txt[board.stage] : "";
    b.classList.toggle("on", !!board);
  }

  function onPrep(kind) {
    if (!run) return;
    if (kind === "poulet") {
      if (board) { say("La planche est déjà occupée : termine ou pose ta brochette."); return; }
      board = { stage: "poulet" };
      busy();
      say("Poulet prêt. Ajoute maintenant la marinade 🌶️.");
    } else if (kind === "marinade") {
      if (!board) { say("Prends d'abord le poulet."); return; }
      if (board.stage !== "poulet") { say("C'est déjà mariné : touche Embrocher."); return; }
      board.stage = "marine";
      busy();
      say("Bien mariné ! Touche Embrocher.");
    } else if (kind === "brochette") {
      if (!board || board.stage !== "marine") {
        say("Il faut d'abord le poulet, puis la marinade.");
        return;
      }
      board.stage = "brochette";
      busy();
      say("Brochette prête ! Pose-la sur un gril.");
    }
    renderBoard();
  }

  /* ---------- Gril et friteuse ---------- */
  function stateOf(item, cfg) {
    if (!item) return "empty";
    var t = Date.now() - item.start;
    if (t < cfg.raw) return "raw";
    if (t < cfg.burn) return "perfect";
    return "burnt";
  }

  function paintStation(list, cfg, ip, lp, mp, icons, emptyLabel) {
    for (var i = 0; i < list.length; i++) {
      var s = stateOf(list[i], cfg);
      $(ip + i).textContent = icons[s];
      $(lp + i).textContent = s === "empty" ? emptyLabel : (s === "burnt" ? "Jeter" : "Retirer");
      var m = $(mp + i);
      if (list[i]) {
        var pct = Math.min(100, (Date.now() - list[i].start) / cfg.max * 100);
        m.style.display = "block";
        m.style.left = "calc(" + pct + "% - 2px)";
      } else {
        m.style.display = "none";
      }
    }
  }

  function renderStations() {
    paintStation(grills, cfgG, "gi", "gl", "gm",
      { empty: "♨️", raw: "🍗", perfect: "🍢", burnt: "⬛" }, "Brochette");
    paintStation(fryers, cfgF, "fi", "fl", "fm",
      { empty: "🥘", raw: "🍌", perfect: "🍌", burnt: "⬛" }, "Plantain");
  }

  function burnScan(list, cfg) {
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      if (it && !it.b && stateOf(it, cfg) === "burnt") {
        it.b = true;
        run.burnt++;
      }
    }
  }

  function onGrill(i) {
    if (!run) return;
    var s = stateOf(grills[i], cfgG);
    if (s === "empty") {
      if (!board || board.stage !== "brochette") {
        say("Prépare d'abord une brochette : Poulet, Marinade, puis Embrocher.");
        return;
      }
      grills[i] = { start: Date.now() };
      board = null;
      renderBoard();
      busy();
      say("La brochette grille. Retire-la quand la barre est dorée !");
    } else if (s === "burnt") {
      grills[i] = null;
      say("Brûlée ! Je la jette. Il faudra en refaire une.");
    } else {
      if (!addToPlate("brochette", s === "perfect" ? 1 : 0.4)) return;
      grills[i] = null;
      say(s === "perfect" ? "Cuisson parfaite !" : "Un peu cru… mais ça passe.");
    }
    renderStations();
  }

  function onFry(i) {
    if (!run) return;
    var s = stateOf(fryers[i], cfgF);
    if (s === "empty") {
      fryers[i] = { start: Date.now() };
      busy();
      say("Le plantain frit. Retire-le quand la barre est dorée : ça va vite !");
    } else if (s === "burnt") {
      fryers[i] = null;
      say("Brûlé ! Je le jette.");
    } else {
      if (!addToPlate("plantain", s === "perfect" ? 1 : 0.4)) return;
      fryers[i] = null;
      say(s === "perfect" ? "Plantain doré, parfait !" : "Encore un peu pâle… mais ça passe.");
    }
    renderStations();
  }

  function trash() {
    if (!run) return;
    plate = [];
    renderPlate();
    say("Assiette jetée. On recommence !");
  }

  /* ---------- Service d'un client ---------- */
  function serveSlot(i) {
    if (!run) return;
    var c = clients[i];
    if (!c || c.state !== "wait") return;
    if (!plate.length) { say("L'assiette est vide : prépare d'abord la commande."); return; }
    if (!matches(c.order)) {
      var wrong = null;
      for (var k = 0; k < plate.length; k++) {
        if (c.order.indexOf(plate[k].type) < 0) wrong = plate[k].type;
      }
      if (wrong) say("Ce client n'a pas commandé " + LABEL[wrong] + " !");
      else say("Il manque encore un plat dans l'assiette.");
      return;
    }
    var sumq = 0;
    var perfect = true;
    for (var j = 0; j < plate.length; j++) {
      sumq += plate[j].q;
      if (plate[j].q < 1) perfect = false;
    }
    var items = plate.length;
    var avg = sumq / items;
    var left = leftOf(c);
    if (perfect) { run.combo++; run.perfects++; } else { run.combo = 0; }
    if (run.combo > run.best) run.best = run.combo;
    if (run.combo > state.bestCombo) state.bestCombo = run.combo;
    var bonus = perfect ? Math.min(run.combo - 1, 4) * 2 : 0;
    var coins = Math.round((items * 5 + sumq * 4 + left * 5) * pm) + bonus;
    var points = Math.round(50 * sumq + 30 * left * items) + bonus * 10;
    state.coins += coins;
    state.score += points;
    state.served += 1;
    save();
    refresh();
    run.served++;
    run.gain += coins;
    run.q.push(avg);
    c.state = "done";
    c.face = "😋";
    plate = [];
    renderPlate();
    renderClients();
    updateCombo();
    toast(bonus > 0 ? "COMBO x" + run.combo + "  +" + coins + " 🪙" : "+" + coins + " 🪙");
    say(perfect
      ? "Excellent ! Tout est parfait, +" + coins + " pièces."
      : "Merci ! Mais la cuisson pouvait être meilleure. +" + coins + " pièces.");
    finishClient(i);
  }

  /* ---------- Boucle de jeu ---------- */
  function startLoop() {
    stopLoop();
    loop = setInterval(function () {
      renderStations();
      if (!run) return;
      checkPatience();
      paintBars();
      if (run) { burnScan(grills, cfgG); burnScan(fryers, cfgF); }
    }, 100);
  }
  function stopLoop() {
    if (loop) { clearInterval(loop); loop = null; }
  }

  /* ---------- Début et fin de niveau ---------- */
  function resetKitchen() {
    clients = [null, null, null];
    plate = [];
    board = null;
    grills = [null, null];
    fryers = [null, null];
  }

  function startService() {
    clearTimers();
    resetKitchen();
    applyUpgrades();
    run = {
      served: 0, lost: 0, done: 0, gain: 0, q: [],
      spawned: 0, combo: 0, best: 0, perfects: 0, burnt: 0
    };
    $("overlay").classList.add("hidden");
    renderClients();
    renderPlate();
    renderBoard();
    renderStations();
    updateCombo();
    updateHud();
    startLoop();
    say("Le service commence ! Prépare une brochette, le premier client arrive.");
    later(trySpawn, 1500);
  }

  function starsStr(n) { return n ? "⭐".repeat(n) : "Aucune étoile"; }

  function endService() {
    if (!run) return;
    clearTimers();
    var g = lv.goals;
    var gain = run.gain;
    var stars = gain >= g[2] ? 3 : (gain >= g[1] ? 2 : (gain >= g[0] ? 1 : 0));
    var ok = chOk(lv.ch, run);
    var reward = 0;
    var first = false;
    if (stars > state.stars[cur]) state.stars[cur] = stars;
    if (stars === 3) state.threeStars = true;
    if (ok && stars >= 1 && !state.chDone[cur]) {
      state.chDone[cur] = true;
      state.coins += CH_REWARD;
      reward = CH_REWARD;
      first = true;
    }
    save();
    refresh();
    stopLoop();
    var best = run.best;
    run = null;
    updateCombo();
    updateHud();
    after = (stars >= 1 && cur + 1 < LEVELS.length) ? "next" : "retry";
    phase = "end";
    var chLine = ok
      ? "Défi d'Auguste : réussi ✅" + (first ? " (+" + reward + " 🪙)" : "")
      : "Défi d'Auguste : raté ❌ (" + chText(lv.ch) + ")";
    overlay(
      stars ? "Niveau 1-" + (cur + 1) + " réussi !" : "Niveau raté",
      "Pièces gagnées : " + gain + " / " + g[2] + " 🪙\n" +
      starsStr(stars) + "\n" +
      (stars ? "" : "Il fallait au moins " + g[0] + " 🪙\n") +
      "Meilleur combo : " + best + "\n" + chLine,
      after === "next" ? "Niveau suivant" : "Rejouer"
    );
  }

  function openGame(idx) {
    clearTimers();
    stopLoop();
    run = null;
    cur = idx;
    lv = LEVELS[idx];
    resetKitchen();
    applyUpgrades();
    $("screen-game").classList.toggle("no-tips", !state.tips);
    refresh();
    renderClients();
    renderPlate();
    renderBoard();
    renderStations();
    updateCombo();
    updateHud();
    say("Bienvenue au Petit Gourmet !");
    phase = "intro";
    var g = lv.goals;
    overlay(
      "Niveau 1-" + (idx + 1),
      "Objectif en pièces :\n⭐ " + g[0] + "   ⭐⭐ " + g[1] + "   ⭐⭐⭐ " + g[2] + "\n" +
      "Clients à servir : " + lv.clients + "\n" +
      "Défi d'Auguste (+" + CH_REWARD + " 🪙) : " + chText(lv.ch),
      "Commencer"
    );
    show("screen-game");
  }

  function goHome() {
    clearTimers();
    stopLoop();
    run = null;
    window.MC.showHome();
  }

  function goLevels() {
    clearTimers();
    stopLoop();
    run = null;
    window.MC.openLevels();
  }

  /* ---------- Branchements ---------- */
  $("btn-back").addEventListener("click", goHome);
  $("ov-btn").addEventListener("click", function () {
    if (phase === "intro") startService();
    else openGame(after === "next" ? cur + 1 : cur);
  });
  $("ov-menu").addEventListener("click", goLevels);
  $("btn-trash").addEventListener("click", trash);

  $("salle").addEventListener("click", function (e) {
    var el = e.target.closest(".cslot");
    if (!el) return;
    serveSlot(parseInt(el.getAttribute("data-slot"), 10));
  });

  function bindAll(selector, attr, fn) {
    var list = document.querySelectorAll(selector);
    for (var n = 0; n < list.length; n++) {
      (function (b) {
        b.addEventListener("click", function () { fn(b.getAttribute(attr)); });
      })(list[n]);
    }
  }
  bindAll("[data-prep]", "data-prep", onPrep);
  bindAll("[data-grill]", "data-grill", function (v) { onGrill(parseInt(v, 10)); });
  bindAll("[data-fry]", "data-fry", function (v) { onFry(parseInt(v, 10)); });

  /* Partage avec le menu (menu.js) */
  window.MC = {
    state: state,
    makeDefaults: makeDefaults,
    LEVELS: LEVELS,
    UPGRADES: UPGRADES,
    save: save,
    refresh: refresh,
    show: show,
    buy: buy,
    nextLevel: nextLevel,
    openGame: openGame,
    showHome: function () { show("screen-home"); },
    openLevels: function () { show("screen-home"); }
  };

  refresh();
  updateHud();
})();
// FIN DU FICHIER
