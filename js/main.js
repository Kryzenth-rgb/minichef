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
  var PATIENCE = 45000;
  var PER_SERVICE = 5;
  var FACES = ["👩", "👨", "🧑", "👵", "👴", "🧒"];

  var run = null;
  var client = null;
  var plate = [];
  var grill = null;
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
  function showClient(on) {
    $("client").classList.toggle("hidden", !on);
    $("client-empty").classList.toggle("hidden", on);
  }
  function overlay(title, text, btn) {
    $("ov-title").textContent = title;
    $("ov-text").textContent = text;
    $("ov-btn").textContent = btn;
    $("overlay").classList.remove("hidden");
  }

  /* ---------- Affichage ---------- */
  function renderRecipe() {
    var html = "";
    for (var i = 0; i < RECIPE.length; i++) {
      var cls = i < plate.length ? "ri done" : (i === plate.length ? "ri next" : "ri");
      html += '<i class="' + cls + '">' + ICONS[RECIPE[i]] + "</i>";
    }
    $("recipe").innerHTML = html;
  }
  function plateIcon(p) {
    if (p.ing === "steak") return p.q >= 1 ? "🍖" : "🥩";
    return ICONS[p.ing];
  }
  function renderPlate() {
    var html = "";
    for (var i = 0; i < RECIPE.length; i++) {
      if (i < plate.length) html += '<div class="slot full">' + plateIcon(plate[i]) + "</div>";
      else html += '<div class="slot"></div>';
    }
    $("plate").innerHTML = html;
  }
  function grillState() {
    if (!grill) return "empty";
    var t = Date.now() - grill.start;
    if (t < COOK_RAW) return "raw";
    if (t < COOK_BURN) return "perfect";
    return "burnt";
  }
  function renderGrill() {
    var s = grillState();
    var icons = { empty: "♨️", raw: "🥩", perfect: "🍖", burnt: "⬛" };
    $("grill-icon").textContent = icons[s];
    $("grill-label").textContent = s === "empty" ? "Steak" : "Retirer";
    var m = $("grill-marker");
    if (grill) {
      var pct = Math.min(100, (Date.now() - grill.start) / COOK_MAX * 100);
      m.style.display = "block";
      m.style.left = "calc(" + pct + "% - 2px)";
    } else {
      m.style.display = "none";
    }
  }
  function renderPatience() {
    if (!client) return;
    var left = Math.max(0, 1 - (Date.now() - client.born) / PATIENCE);
    var f = $("patience-fill");
    f.style.width = (left * 100) + "%";
    f.classList.toggle("low", left < 0.3);
    if (left <= 0) clientLeaves();
  }

  /* ---------- Boucle de jeu ---------- */
  function startLoop() {
    stopLoop();
    loop = setInterval(function () {
      renderGrill();
      renderPatience();
    }, 100);
  }
  function stopLoop() {
    if (loop) { clearInterval(loop); loop = null; }
  }

  /* ---------- Clients ---------- */
  function spawnClient() {
    if (!run) return;
    client = { born: Date.now() };
    plate = [];
    $("face").textContent = FACES[Math.floor(Math.random() * FACES.length)];
    $("patience-fill").style.width = "100%";
    $("patience-fill").classList.remove("low");
    showClient(true);
    renderRecipe();
    renderPlate();
    say("Un client arrive ! Pain, steak, salade, pain. Lance vite le steak !");
  }
  function clientDone() {
    run.done++;
    later(function () { showClient(false); }, 900);
    if (run.done >= PER_SERVICE) later(endService, 1200);
    else later(spawnClient, 2000);
  }
  function clientLeaves() {
    if (!client) return;
    run.lost++;
    $("face").textContent = "😡";
    say("Un client est parti fâché… Sois plus rapide !");
    client = null;
    plate = [];
    renderPlate();
    renderRecipe();
    clientDone();
  }

  /* ---------- Actions du joueur ---------- */
  function addIng(ing) {
    if (!run) return;
    if (!client) { say("Pas de client pour l'instant. Patience !"); return; }
    if (plate.length >= RECIPE.length) { say("L'assiette est complète : appuie sur Servir !"); return; }
    var expected = RECIPE[plate.length];
    if (ing !== expected) { say("Pas maintenant ! Il faut d'abord " + NAMES[expected] + "."); return; }
    plate.push({ ing: ing, q: 1 });
    busy();
    renderPlate();
    renderRecipe();
    if (plate.length === RECIPE.length) say("Hamburger prêt ! Appuie sur Servir.");
    else say("Bien ! Ensuite : " + NAMES[RECIPE[plate.length]] + ".");
  }

  function onGrill() {
    if (!run) return;
    var s = grillState();
    if (s === "empty") {
      grill = { start: Date.now() };
      busy();
      renderGrill();
      say("Le steak cuit. Retire-le quand la barre est dorée !");
      return;
    }
    if (s === "burnt") {
      grill = null;
      renderGrill();
      say("Brûlé ! Je le jette. Pose un nouveau steak.");
      return;
    }
    if (!client) { say("Pas de client pour l'instant."); return; }
    if (plate.length >= RECIPE.length || RECIPE[plate.length] !== "steak") {
      say("Le steak attendra : ce n'est pas encore son tour. Attention à ne pas le brûler !");
      return;
    }
    plate.push({ ing: "steak", q: s === "perfect" ? 1 : 0.4 });
    grill = null;
    busy();
    renderGrill();
    renderPlate();
    renderRecipe();
    say((s === "perfect" ? "Cuisson parfaite ! " : "Un peu cru… mais ça passe. ") +
        "Ensuite : " + NAMES[RECIPE[plate.length]] + ".");
  }

  function trash() {
    if (!run || !client) return;
    plate = [];
    renderPlate();
    renderRecipe();
    say("Assiette jetée. On recommence !");
  }

  function serve() {
    if (!run) return;
    if (!client) { say("Pas de client à servir."); return; }
    if (plate.length < RECIPE.length) { say("Il manque des ingrédients !"); return; }
    var q = plate[1].q;
    var left = Math.max(0, 1 - (Date.now() - client.born) / PATIENCE);
    var coins = Math.round(8 + q * 6 + left * 6);
    var points = Math.round(100 * (q * 0.6 + left * 0.4));
    state.coins += coins;
    state.score += points;
    save();
    refresh();
    run.served++;
    run.coins += coins;
    run.q.push(q);
    $("face").textContent = "😋";
    toast("+" + coins + " 🪙");
    say(q >= 1
      ? "Excellent ! Cuisson parfaite, +" + coins + " pièces."
      : "Merci ! Mais le steak était un peu cru. +" + coins + " pièces.");
    client = null;
    plate = [];
    renderPlate();
    renderRecipe();
    clientDone();
  }

  /* ---------- Début et fin de service ---------- */
  function startService() {
    clearTimers();
    run = { served: 0, lost: 0, done: 0, coins: 0, q: [] };
    client = null;
    plate = [];
    grill = null;
    $("overlay").classList.add("hidden");
    showClient(false);
    renderRecipe();
    renderPlate();
    renderGrill();
    startLoop();
    say("Le service commence ! Le premier client arrive.");
    later(spawnClient, 1200);
  }

  function endService() {
    if (!run) return;
    var sum = 0;
    for (var i = 0; i < run.q.length; i++) sum += run.q[i];
    var avg = run.q.length ? sum / run.q.length : 0;
    var stars = 0;
    if (run.served >= PER_SERVICE && avg >= 0.9) stars = 3;
    else if (run.served >= 4) stars = 2;
    else if (run.served >= 1) stars = 1;
    stopLoop();
    var served = run.served;
    var coins = run.coins;
    run = null;
    overlay(
      "Service terminé !",
      "Clients servis : " + served + "/" + PER_SERVICE + "\n" +
      "Pièces gagnées : " + coins + " 🪙\n" +
      (stars ? "⭐".repeat(stars) : "Pas d'étoile cette fois"),
      "Rejouer"
    );
  }

  function openGame() {
    clearTimers();
    stopLoop();
    run = null;
    client = null;
    plate = [];
    grill = null;
    refresh();
    showClient(false);
    renderRecipe();
    renderPlate();
    renderGrill();
    say("Bienvenue au Petit Gourmet !");
    overlay(
      "Le Petit Gourmet",
      "Sers 5 clients.\nHamburger : pain, steak doré, salade, pain.\nAstuce : lance le steak dès qu'un client arrive !",
      "Commencer"
    );
    show("screen-game");
  }

  function goMenu() {
    clearTimers();
    stopLoop();
    run = null;
    client = null;
    show("screen-title");
  }

  /* ---------- Branchements ---------- */
  $("btn-play").addEventListener("click", openGame);
  $("btn-back").addEventListener("click", goMenu);
  $("ov-btn").addEventListener("click", startService);
  $("ov-menu").addEventListener("click", goMenu);
  $("btn-grill").addEventListener("click", onGrill);
  $("btn-serve").addEventListener("click", serve);
  $("btn-trash").addEventListener("click", trash);

  var tools = document.querySelectorAll("[data-ing]");
  for (var i = 0; i < tools.length; i++) {
    (function (b) {
      b.addEventListener("click", function () { addIng(b.getAttribute("data-ing")); });
    })(tools[i]);
  }

  refresh();
})();
