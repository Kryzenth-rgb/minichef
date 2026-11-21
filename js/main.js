(function () {
  "use strict";

  var KEY = "minichef_save_v1";
  var DEFAULTS = { coins: 0, score: 0, level: 1 };
  var state = load();

  var RECIPE = ["pain", "steak", "salade", "pain"];
  var NAMES = { pain: "le pain", steak: "le steak", salade: "la salade" };
  var ICONS = { pain: "🍞", steak: "🥩", salade: "🥬" };
  var COOK_RAW = 3000;
  var COOK_BURN = 6000;
  var COOK_MAX = 8000;
  var PATIENCE = 40000;
  var TOTAL = 6;
  var SLOTS = 3;
  var GRILLS = 2;
  var FACES = ["👩", "👨", "🧑", "👵", "👴", "🧒"];

  var run = null;
  var clients = [null, null, null];
  var plate = [];
  var grills = [null, null];
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

  /* ---------- Clients ---------- */
  function leftOf(c) {
    return Math.max(0, 1 - (Date.now() - c.born) / PATIENCE);
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
          '<div class="bubble"><span class="dish">🍔</span>' +
          '<div class="patience"><div id="pf' + i + '"></div></div></div></div>';
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

  function markReady() {
    var full = plate.length === RECIPE.length;
    var els = document.querySelectorAll(".cslot");
    for (var k = 0; k < els.length; k++) {
      var i = parseInt(els[k].getAttribute("data-slot"), 10);
      var c = clients[i];
      els[k].classList.toggle("ready", full && !!c && c.state === "wait");
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
    clients[free] = {
      born: Date.now(),
      face: FACES[Math.floor(Math.random() * FACES.length)],
      state: "wait"
    };
    run.spawned++;
    renderClients();
    if (run.spawned === 1) say("Un client arrive ! Pain, steak, salade, pain. Lance vite un steak !");
    if (run.spawned < TOTAL) later(trySpawn, 6500);
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
  function plateIcon(p) {
    if (p.ing === "steak") return p.q >= 1 ? "🍖" : "🥩";
    return ICONS[p.ing];
  }
  function renderPlate() {
    var html = "";
    for (var i = 0; i < RECIPE.length; i++) {
      if (i < plate.length) {
        html += '<div class="slot full">' + plateIcon(plate[i]) + "</div>";
      } else {
        html += '<div class="slot ghost' + (i === plate.length ? " next" : "") + '">' +
          ICONS[RECIPE[i]] + "</div>";
      }
    }
    $("plate").innerHTML = html;
    markReady();
  }

  /* ---------- Grils ---------- */
  function grillState(g) {
    if (!g) return "empty";
    var t = Date.now() - g.start;
    if (t < COOK_RAW) return "raw";
    if (t < COOK_BURN) return "perfect";
    return "burnt";
  }
  function renderGrills() {
    var icons = { empty: "♨️", raw: "🥩", perfect: "🍖", burnt: "⬛" };
    for (var i = 0; i < GRILLS; i++) {
      var s = grillState(grills[i]);
      $("gi" + i).textContent = icons[s];
      $("gl" + i).textContent = s === "empty" ? "Steak" : (s === "burnt" ? "Jeter" : "Retirer");
      var m = $("m" + i);
      if (grills[i]) {
        var pct = Math.min(100, (Date.now() - grills[i].start) / COOK_MAX * 100);
        m.style.display = "block";
        m.style.left = "calc(" + pct + "% - 2px)";
      } else {
        m.style.display = "none";
      }
    }
  }

  /* ---------- Boucle de jeu ---------- */
  function startLoop() {
    stopLoop();
    loop = setInterval(function () {
      renderGrills();
      if (run) { checkPatience(); paintBars(); }
    }, 100);
  }
  function stopLoop() {
    if (loop) { clearInterval(loop); loop = null; }
  }

  /* ---------- Actions du joueur ---------- */
  function addIng(ing) {
    if (!run) return;
    if (plate.length >= RECIPE.length) { say("L'assiette est complète : touche un client pour le servir !"); return; }
    var expected = RECIPE[plate.length];
    if (ing !== expected) { say("Pas maintenant ! Il faut d'abord " + NAMES[expected] + "."); return; }
    plate.push({ ing: ing, q: 1 });
    busy();
    renderPlate();
    if (plate.length === RECIPE.length) say("Hamburger prêt ! Touche un client pour le servir.");
    else say("Bien ! Ensuite : " + NAMES[RECIPE[plate.length]] + ".");
  }

  function onGrill(i) {
    if (!run) return;
    var s = grillState(grills[i]);
    if (s === "empty") {
      grills[i] = { start: Date.now() };
      busy();
      renderGrills();
      say("Le steak cuit. Retire-le quand la barre est dorée !");
      return;
    }
    if (s === "burnt") {
      grills[i] = null;
      renderGrills();
      say("Brûlé ! Je le jette. Pose un nouveau steak.");
      return;
    }
    if (plate.length >= RECIPE.length || RECIPE[plate.length] !== "steak") {
      say("Le steak attendra : ce n'est pas encore son tour. Attention à ne pas le brûler !");
      return;
    }
    plate.push({ ing: "steak", q: s === "perfect" ? 1 : 0.4 });
    grills[i] = null;
    busy();
    renderGrills();
    renderPlate();
    say((s === "perfect" ? "Cuisson parfaite ! " : "Un peu cru… mais ça passe. ") +
        "Ensuite : " + NAMES[RECIPE[plate.length]] + ".");
  }

  function trash() {
    if (!run) return;
    plate = [];
    renderPlate();
    say("Assiette jetée. On recommence !");
  }

  function serveSlot(i) {
    if (!run) return;
    var c = clients[i];
    if (!c || c.state !== "wait") return;
    if (plate.length < RECIPE.length) {
      say("Prépare d'abord le hamburger, puis touche le client.");
      return;
    }
    var q = plate[1].q;
    var left = leftOf(c);
    if (q >= 1) run.combo++; else run.combo = 0;
    if (run.combo > run.best) run.best = run.combo;
    var bonus = q >= 1 ? Math.min(run.combo - 1, 4) * 2 : 0;
    var coins = Math.round(8 + q * 6 + left * 6) + bonus;
    var points = Math.round(100 * (q * 0.6 + left * 0.4)) + bonus * 10;
    state.coins += coins;
    state.score += points;
    save();
    refresh();
    run.served++;
    run.coins += coins;
    run.q.push(q);
    c.state = "done";
    c.face = "😋";
    plate = [];
    renderPlate();
    renderClients();
    updateCombo();
    toast(bonus > 0 ? "COMBO x" + run.combo + "  +" + coins + " 🪙" : "+" + coins + " 🪙");
    say(q >= 1
      ? "Excellent ! Cuisson parfaite, +" + coins + " pièces."
      : "Merci ! Mais le steak était un peu cru. +" + coins + " pièces.");
    finishClient(i);
  }

  /* ---------- Début et fin de service ---------- */
  function startService() {
    clearTimers();
    run = { served: 0, lost: 0, done: 0, coins: 0, q: [], spawned: 0, combo: 0, best: 0 };
    clients = [null, null, null];
    plate = [];
    grills = [null, null];
    $("overlay").classList.add("hidden");
    renderClients();
    renderPlate();
    renderGrills();
    updateCombo();
    startLoop();
    say("Le service commence ! Prépare un steak, le premier client arrive.");
    later(trySpawn, 1500);
  }

  function endService() {
    if (!run) return;
    var sum = 0;
    for (var i = 0; i < run.q.length; i++) sum += run.q[i];
    var avg = run.q.length ? sum / run.q.length : 0;
    var stars = 0;
    if (run.lost === 0 && run.served >= TOTAL && avg >= 0.9) stars = 3;
    else if (run.served >= TOTAL - 1) stars = 2;
    else if (run.served >= 1) stars = 1;
    stopLoop();
    var served = run.served;
    var coins = run.coins;
    var best = run.best;
    run = null;
    updateCombo();
    overlay(
      "Service terminé !",
      "Clients servis : " + served + "/" + TOTAL + "\n" +
      "Pièces gagnées : " + coins + " 🪙\n" +
      "Meilleur combo : " + best + "\n" +
      (stars ? "⭐".repeat(stars) : "Pas d'étoile cette fois"),
      "Rejouer"
    );
  }

  function openGame() {
    clearTimers();
    stopLoop();
    run = null;
    clients = [null, null, null];
    plate = [];
    grills = [null, null];
    refresh();
    renderClients();
    renderPlate();
    renderGrills();
    updateCombo();
    say("Bienvenue au Petit Gourmet !");
    overlay(
      "Le Petit Gourmet",
      "Sers 6 clients.\nHamburger : pain, steak doré, salade, pain.\nQuand l'assiette est prête, touche un client.",
      "Commencer"
    );
    show("screen-game");
  }

  function goMenu() {
    clearTimers();
    stopLoop();
    run = null;
    show("screen-title");
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

  var ingButtons = document.querySelectorAll("[data-ing]");
  for (var i = 0; i < ingButtons.length; i++) {
    (function (b) {
      b.addEventListener("click", function () { addIng(b.getAttribute("data-ing")); });
    })(ingButtons[i]);
  }
  var grillButtons = document.querySelectorAll("[data-grill]");
  for (var j = 0; j < grillButtons.length; j++) {
    (function (b) {
      b.addEventListener("click", function () { onGrill(parseInt(b.getAttribute("data-grill"), 10)); });
    })(grillButtons[j]);
  }

  refresh();
})();
