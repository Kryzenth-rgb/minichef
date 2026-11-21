(function () {
  "use strict";

  var KEY = "minichef_save_v1";
  var state = load();

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) return Object.assign({ coins: 0 }, JSON.parse(raw));
    } catch (e) {}
    return { coins: 0 };
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

  function refresh() { $("coins").textContent = state.coins; }

  $("btn-play").addEventListener("click", function () {
    refresh();
    show("screen-resto");
  });

  $("btn-test").addEventListener("click", function () {
    state.coins += 10;
    save();
    refresh();
  });

  $("btn-back").addEventListener("click", function () {
    show("screen-title");
  });

  refresh();
})();
