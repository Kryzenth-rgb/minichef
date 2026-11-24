(function () {
  "use strict";

  var MC = window.MC;
  var st = MC.state;
  var armed = false;

  function $(id) { return document.getElementById(id); }

  function starsStr(n) { return "⭐".repeat(n) + "☆".repeat(3 - n); }
  function totalStars() {
    var t = 0;
    for (var i = 0; i < st.stars.length; i++) t += st.stars[i];
    return t;
  }

  /* ---------- Accueil ---------- */
  function renderHome() {
    $("pf-name").textContent = st.name;
    $("pf-level").textContent = st.level;
    $("home-coins").textContent = st.coins;
    $("play-lvl").textContent = "Niveau 1-" + (MC.nextLevel() + 1);
  }
  function showHome() {
    renderHome();
    MC.show("screen-home");
  }
  MC.showHome = showHome;

  /* ---------- Cartes ---------- */
  function item(icon, title, text, locked) {
    return '<div class="mc-card' + (locked ? " locked" : "") + '">' +
      '<div class="c-ic">' + icon + "</div>" +
      '<div class="c-tx"><b>' + title + "</b><span>" + text + "</span></div>" +
      (locked ? '<div class="c-lock">🔒</div>' : "") + "</div>";
  }
  function quest(title, val, goal) {
    var done = val >= goal;
    var pct = Math.min(1, val / goal) * 100;
    return '<div class="mc-card">' +
      '<div class="c-ic">' + (done ? "✅" : "🎯") + "</div>" +
      '<div class="c-tx"><b>' + title + "</b>" +
      '<div class="q-bar"><div style="width:' + pct + '%"></div></div>' +
      "<span>" + Math.min(val, goal) + " / " + goal + "</span></div></div>";
  }

  /* ---------- Contenu des écrans ---------- */
  var SCREENS = {
    niveaux: {
      title: "▶ Choisir un niveau",
      html: function () {
        var out = '<div class="sec-title">Belleville · Le Petit Gourmet · ' +
          totalStars() + " / " + (MC.LEVELS.length * 3) + " ⭐</div>";
        for (var i = 0; i < MC.LEVELS.length; i++) {
          var L = MC.LEVELS[i];
          var open = i === 0 || st.stars[i - 1] >= 1;
          out += '<div class="mc-card lv-card' + (open ? "" : " locked") + '"' +
            (open ? ' data-level="' + i + '"' : "") + ">" +
            '<div class="c-ic lvn">1-' + (i + 1) + "</div>" +
            '<div class="c-tx"><b>Niveau 1-' + (i + 1) + "</b>" +
            "<span>" + (open ? starsStr(st.stars[i]) + " · " + L.clients + " clients" : "Termine le niveau précédent") + "</span></div>" +
            (open ? "" : '<div class="c-lock">🔒</div>') + "</div>";
        }
        return out;
      }
    },
    recettes: {
      title: "📖 Recettes",
      html: function () {
        return item("🍢", "Brochettes de poulet et plantains",
            "Poulet → marinade → brochette → gril.<br>Plantains à la friteuse.<br>Débloqué", false) +
          item("🍗", "Poulet braisé et accompagnement", "Bientôt disponible", true) +
          item("🍩", "Beignets-haricots", "Bientôt disponible", true);
      }
    },
    ameliorations: {
      title: "⭐ Améliorations",
      html: function () {
        var out = "";
        var group = "";
        for (var i = 0; i < MC.UPGRADES.length; i++) {
          var u = MC.UPGRADES[i];
          if (u.group !== group) {
            group = u.group;
            out += '<div class="sec-title">' + group + "</div>";
          }
          var lvl = st.up[u.id] || 0;
          var max = u.costs.length;
          var pips = "▮".repeat(lvl) + "▯".repeat(max - lvl);
          var btn;
          if (lvl >= max) {
            btn = '<button class="mini-btn" disabled>MAX</button>';
          } else {
            var cost = u.costs[lvl];
            btn = '<button class="mini-btn" data-up="' + u.id + '"' +
              (st.coins < cost ? " disabled" : "") + ">Améliorer<br>" + cost + " 🪙</button>";
          }
          out += '<div class="mc-card"><div class="c-ic">' + u.icon + "</div>" +
            '<div class="c-tx"><b>' + u.title + "</b><span>" + u.text + "</span>" +
            '<div class="pips">' + pips + "</div></div>" + btn + "</div>";
        }
        out += item("🪴", "Décoration du restaurant", "Bientôt disponible", true);
        return out;
      }
    },
    carte: {
      title: "🌍 Carte du monde",
      html: function () {
        return item("🏠", "Belleville · Le Petit Gourmet", "6 niveaux · Disponible", false) +
          item("🏖️", "Port-Soleil", "Cuisine côtière · Bientôt", true) +
          item("🏛️", "Bellacosta", "Inspirations méditerranéennes · Bientôt", true) +
          item("🏯", "Hoshimori", "Cuisine japonaise · Bientôt", true) +
          item("🌆", "Nova Cité", "Cuisine fusion · Bientôt", true);
      }
    },
    quetes: {
      title: "📜 Quêtes",
      html: function () {
        return quest("Sers 10 clients", st.served, 10) +
          quest("Réussis un combo x3", st.bestCombo, 3) +
          quest("Collecte 9 étoiles", totalStars(), 9) +
          quest("Obtiens 3 étoiles sur un niveau", st.threeStars ? 1 : 0, 1);
      }
    },
    boutique: {
      title: "🛒 Boutique",
      html: function () {
        return item("🧢", "Tenues et toques", "Bientôt disponible", true) +
          item("🪑", "Décorations", "Bientôt disponible", true) +
          item("💡", "Pour l'instant", "Aucun achat : gagne des pièces en jouant !", false);
      }
    },
    profil: {
      title: "🧑‍🍳 Profil du chef",
      html: function () {
        return '<div class="mc-card wide"><div class="c-ic">👦</div><div class="c-tx">' +
          '<b>Nom du chef</b><input id="name-input" maxlength="12">' +
          '</div><button id="name-save" class="mini-btn">Enregistrer</button></div>' +
          item("🏅", "Niveau", st.level, false) +
          item("🪙", "Pièces", st.coins, false) +
          item("⭐", "Étoiles", totalStars() + " / " + (MC.LEVELS.length * 3), false) +
          item("🍽️", "Clients servis", st.served, false) +
          item("🔥", "Meilleur combo", st.bestCombo, false);
      }
    },
    parametres: {
      title: "⚙️ Paramètres",
      html: function () {
        return '<div class="mc-card wide"><div class="c-ic">💡</div><div class="c-tx">' +
          "<b>Astuces d'Auguste</b><span id=\"tips-state\"></span></div>" +
          '<button id="tg-tips" class="mini-btn"></button></div>' +
          '<div class="mc-card wide"><div class="c-ic">🗑️</div><div class="c-tx">' +
          "<b>Progression</b><span>Efface pièces, étoiles, améliorations et quêtes.</span></div>" +
          '<button id="btn-reset" class="mini-btn danger"></button></div>' +
          item("ℹ️", "Mini Chef", "Prototype 0.1 · SmartLife Apps", false);
      }
    }
  };

  function bindProfil() {
    var inp = $("name-input");
    inp.value = st.name;
    $("name-save").addEventListener("click", function () {
      var v = inp.value.trim();
      if (!v) return;
      st.name = v.slice(0, 12);
      MC.save();
      $("name-save").textContent = "Enregistré ✅";
    });
  }

  function paintSettings() {
    $("tg-tips").textContent = st.tips ? "OUI" : "NON";
    $("tips-state").textContent = st.tips ? "Auguste commente le jeu." : "Auguste reste discret.";
    $("btn-reset").textContent = armed ? "Confirmer ?" : "Remettre à zéro";
  }

  function bindSettings() {
    paintSettings();
    $("tg-tips").addEventListener("click", function () {
      st.tips = !st.tips;
      MC.save();
      paintSettings();
    });
    $("btn-reset").addEventListener("click", function () {
      if (!armed) { armed = true; paintSettings(); return; }
      Object.assign(st, MC.makeDefaults());
      MC.save();
      MC.refresh();
      armed = false;
      showHome();
    });
  }

  function openSub(key) {
    var s = SCREENS[key];
    if (!s) return;
    armed = false;
    $("sub-title").textContent = s.title;
    $("sub-body").innerHTML = s.html();
    $("sub-body").scrollTop = 0;
    if (key === "profil") bindProfil();
    if (key === "parametres") bindSettings();
    MC.show("screen-sub");
  }
  MC.openLevels = function () { openSub("niveaux"); };

  /* ---------- Branchements ---------- */
  $("btn-play").addEventListener("click", MC.openLevels);

  document.addEventListener("click", function (e) {
    var lvl = e.target.closest("[data-level]");
    if (lvl) { MC.openGame(parseInt(lvl.getAttribute("data-level"), 10)); return; }
    var up = e.target.closest("[data-up]");
    if (up) {
      if (MC.buy(up.getAttribute("data-up"))) openSub("ameliorations");
      return;
    }
    var go = e.target.closest("[data-go]");
    if (go) openSub(go.getAttribute("data-go"));
  });
  $("sub-back").addEventListener("click", showHome);

  renderHome();
})();
// FIN DU FICHIER
