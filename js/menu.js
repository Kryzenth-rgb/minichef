(function () {
  "use strict";

  var MC = window.MC;
  var st = MC.state;
  var armed = false;

  function $(id) { return document.getElementById(id); }

  /* ---------- Accueil ---------- */
  function renderHome() {
    $("pf-name").textContent = st.name;
    $("pf-level").textContent = st.level;
    $("home-coins").textContent = st.coins;
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
        return item("🔥", "Gril plus rapide", "Bientôt disponible", true) +
          item("🍌", "Friteuse plus grande", "Bientôt disponible", true) +
          item("🪴", "Décoration du restaurant", "Bientôt disponible", true);
      }
    },
    carte: {
      title: "🌍 Carte du monde",
      html: function () {
        return item("🏠", "Belleville · Le Petit Gourmet", "Niveau 1-1 · Disponible", false) +
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
          quest("Obtiens 3 étoiles sur un service", st.threeStars ? 1 : 0, 1);
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
          item("⭐", "Score total", st.score, false) +
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
          "<b>Progression</b><span>Efface les pièces, le score et les quêtes.</span></div>" +
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
      Object.assign(st, MC.defaults);
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

  /* ---------- Branchements ---------- */
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-go]");
    if (b) openSub(b.getAttribute("data-go"));
  });
  $("sub-back").addEventListener("click", showHome);

  renderHome();
})();
