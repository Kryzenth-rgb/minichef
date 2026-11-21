(function () {
  "use strict";

  var KEY = "minichef_save_v1";
  var DEFAULTS = { coins: 0, score: 0, level: 1 };
  var state = load();

  var ORDER = ["prep", "cuisson", "froid", "dressage", "service"];
  var ZONES = {
    prep: { tool: "🔪", msg: "Ici, on lave et on coupe les ingrédients : salade, tomates, oignons." },
    cuisson: { tool: "🔥", msg: "Les steaks et les frites cuisent ici. Attention à ne pas les brûler !" },
    froid: { tool: "🧊", msg: "Le jus d'orange et les ingrédients frais se préparent ici." },
    dressage: { tool: "🍽️", msg: "C'est ici qu'on assemble le hamburger et qu'on dresse l'assiette." },
    service: { tool: "🛎️", msg: "On sert le client ici. Bien servi, bien payé !" }
  };
  var IDLE_MSG = "Touche une zone de la cuisine pour y envoyer ton chef !";
  var timer = null;

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

  function $(id) { return document.getElementById(id); }

  function show(id) {
    var screens = document.querySelectorAll(".screen");
    for (var i = 0; i < screens.length; i++) screens[i].classList.add("hidden");
    $(id).classList.remove("hidden");
  }

  function say(text) {
    $("hint").innerHTML = "<b>Auguste :</b> " + text;
  }

  function refresh() {
    $("coins").textContent = state.coins;
    $("score").textContent = state.score;
    $("level").textContent = state.level;
  }

  function clearActive() {
    var zs = document.querySelectorAll(".zone");
    for (var i = 0; i < zs.length; i++) zs[i].classList.remove("active");
  }

  function chefIdle() {
    $("chef").style.left = "40%";
    $("chef").classList.remove("busy");
    $("chef-tool").textContent = "";
    clearActive();
    say(IDLE_MSG);
  }

  function goTo(key, button) {
    if (timer) clearTimeout(timer);
    clearActive();
    button.classList.add("active");
    $("chef").style.left = (ORDER.indexOf(key) * 20) + "%";
    $("chef").classList.add("busy");
    $("chef-tool").textContent = ZONES[key].tool;
    say(ZONES[key].msg);
    timer = setTimeout(chefIdle, 2000);
  }

  $("btn-play").addEventListener("click", function () {
    refresh();
    chefIdle();
    show("screen-game");
  });

  $("btn-back").addEventListener("click", function () {
    if (timer) clearTimeout(timer);
    show("screen-title");
  });

  var zoneButtons = document.querySelectorAll(".zone");
  zoneButtons.forEach(function (b) {
    b.addEventListener("click", function () {
      goTo(b.getAttribute("data-zone"), b);
    });
  });

  refresh();
})();
