(function () {
  "use strict";

  var KEY = "minichef_save_v1";
  var DEFAULTS = {
    coins: 0, score: 0, level: 1,
    name: "Chef", served: 0, bestCombo: 0, threeStars: false, tips: true
  };
  var state = load();

  var GRILL = { raw: 3000, burn: 6000, max: 8000 };
  var FRY = { raw: 2000, burn: 4500, max: 6000 };
  var TOTAL = 6;
  var SLOTS = 3;
  var DURATION = 150;
  var GOAL = 70;
  var ICON = { brochette: "🍢", plantain: "🍌" };
  var LABEL = { brochette: "les brochettes", plantain: "les plantains" };
  var FACES = ["👩", "👨", "🧑", "👵", "👴", "🧒"];
  var ORDERS = [
    ["brochette", "plantain"], ["brochette", "plantain"],
    ["brochette"], ["plantain"]
  ];

  var run = null;
  var clients = [null, null, null];
  var plate = [];
  var board = null;
  var grills = [null, null];
  var fryers = [null, null];
  var timers = [];
  var loop = null;

  /* ---------- Sauvegarde ---------- */
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) return Object.assign({}, DEFAULTS, JSON.parse(raw));
    } catch (e) {}
    return Object.assign({}, DEFAULTS);
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
    $("score").textContent = state.score;
    $("level").textContent = state.level;
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
  function fmt(sec) {
    sec = Math.max(0, Math.ceil(sec));
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }
  function updateHud() {
    $("goal").textContent = (run ? run.gain : 0) + "/" + GOAL;
    var left = run ? DURATION - (Date.now() - run.t0) / 1000 : DURATION;
    $("timer").textContent = fmt(left);
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
    if (!run || run.spawned >= TOTAL) return;
    var free = -1;
    for (var i = 0; i < SLOTS; i++) {
      if (!clients[i]) { free = i; break; }
    }
    if (free < 0) { later(trySpawn, 1500); return; }
    var rushed = run.spawned > 0 && Math.random() < 0.35;
    var order = run.spawned === 0 ? ORDERS[0] : ORDERS[Math.floor(Math.random() * ORDERS.length)];
    clients[free] = {
      born: Date.now(),
      patience: rushed ? 30000 : 45000,
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
    if (run.spawned < TOTAL) later(trySpawn, 7000);
  }

  function finishClient(i) {
    run.done++;
    later(function () { clients[i] = null; renderClients(); }, 900);
    if (run.done >= TOTAL) later(endService, 1300);
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
    paintStation(grills, GRILL, "gi", "gl", "gm",
      { empty: "♨️", raw: "🍗", perfect: "🍢", burnt: "⬛" }, "Brochette");
    paintStation(fryers, FRY, "fi", "fl", "fm",
      { empty: "🥘", raw: "🍌", perfect: "🍌", burnt: "⬛" }, "Plantain");
  }

  function onGrill(i) {
    if (!run) return;
    var s = stateOf(grills[i], GRILL);
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
    var s = stateOf(fryers[i], FRY);
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
    if (perfect) run.combo++; else run.combo = 0;
    if (run.combo > run.best) run.best = run.combo;
    if (run.combo > state.bestCombo) state.bestCombo = run.combo;
    var bonus = perfect ? Math.min(run.combo - 1, 4) * 2 : 0;
    var coins = Math.round(items * 5 + sumq * 4 + left * 5) + bonus;
    var points = Math.round(50 * sumq + 30 * left * items) + bonus * 10;
    state.coins += coins;
    state.score += points;
    state.served += 1;
    save();
    refresh();
    run.served++;
    run.coins += coins;
    run.gain += coins;
    run.q.push(avg);
    c.state = "done";
    c.face = "😋";
    plate = [];
    renderPlate();
    renderClients();
    updateCombo();
    updateHud();
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
      updateHud();
      if (run && DURATION - (Date.now() - run.t0) / 1000 <= 0) endService();
    }, 100);
  }
  function stopLoop() {
    if (loop) { clearInterval(loop); loop = null; }
  }

  /* ---------- Début et fin de service ---------- */
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
    run = {
      served: 0, lost: 0, done: 0, coins: 0, gain: 0, q: [],
      spawned: 0, combo: 0, best: 0, t0: Date.now()
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

  function endService() {
    if (!run) return;
    clearTimers();
    var sum = 0;
    for (var i = 0; i < run.q.length; i++) sum += run.q[i];
    var avg = run.q.length ? sum / run.q.length : 0;
    var reached = run.gain >= GOAL;
    var stars = 0;
    if (reached && run.lost === 0 && run.served >= TOTAL && avg >= 0.9) stars = 3;
    else if (reached) stars = 2;
    else if (run.served >= 1) stars = 1;
    if (stars === 3) state.threeStars = true;
    save();
    stopLoop();
    var served = run.served;
    var gain = run.gain;
    var best = run.best;
    run = null;
    updateCombo();
    updateHud();
    overlay(
      reached ? "Objectif atteint !" : "Service terminé",
      "Clients servis : " + served + "/" + TOTAL + "\n" +
      "Pièces gagnées : " + gain + " / " + GOAL + " 🪙\n" +
      "Meilleur combo : " + best + "\n" +
      (stars ? "⭐".repeat(stars) : "Pas d'étoile cette fois"),
      "Rejouer"
    );
  }

  function openGame() {
    clearTimers();
    stopLoop();
    run = null;
    resetKitchen();
    $("screen-game").classList.toggle("no-tips", !state.tips);
    refresh();
    renderClients();
    renderPlate();
    renderBoard();
    renderStations();
    updateCombo();
    updateHud();
    say("Bienvenue au Petit Gourmet !");
    overlay(
      "Le Petit Gourmet",
      "Sers 6 clients en 2 min 30. Objectif : " + GOAL + " pièces.\n" +
      "Brochette : poulet, marinade, embrocher, puis gril.\n" +
      "Plantains : touche la friteuse.\n" +
      "Assiette prête : touche le client.",
      "Commencer"
    );
    show("screen-game");
  }

  function goMenu() {
    clearTimers();
    stopLoop();
    run = null;
    window.MC.showHome();
  }

  /* ---------- Branchements ---------- */
  $("btn-play").addEventListener("click", openGame);
  $("btn-back").addEventListener("click", goMenu);
  $("ov-btn").addEventListener("click", startService);
  $("ov-menu").addEventListener("click", goMenu);
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
    defaults: DEFAULTS,
    save: save,
    refresh: refresh,
    show: show,
    showHome: function () { show("screen-home"); }
  };

  refresh();
})();
