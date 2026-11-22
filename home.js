
// ======================================
// ANAS MUSIC LAB - HOME.JS
// ======================================

const scriptURL = "https://script.google.com/macros/s/AKfycbzfDCIY0hSKkxBaVIQ_SFXFfgUdpCgJqk10qN4NHinyppf2UoXQI-rPKRbu3anGOe3rXQ/exec";

const adminTrigger = "admin?webpass?";

let remoteSongs = [];
let activeView = "home";

const $ = selector => document.querySelector(selector);

const $$ = selector => [...document.querySelectorAll(selector)];


// ======================================
// LOCAL STORAGE
// ======================================

function readStore(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeStore(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}


// ======================================
// TOAST
// ======================================

function toast(message) {
  const el = $("#toast");

  el.textContent = message;
  el.classList.add("show");

  clearTimeout(toast.timer);

  toast.timer = setTimeout(() => {
    el.classList.remove("show");
  }, 2800);
}


// ======================================
// SONG NORMALIZATION
// ======================================

function normalizeRemoteSong(song) {
  if (!song || typeof song !== "object") return null;

  const id = String(
    song.id || song["Song ID"] || ""
  ).trim();

  const title = String(
    song.name || song.song || song.title || song["Song"] || ""
  ).trim();

  const artist = String(
    song.artist || song["Artist"] || ""
  ).trim();

  const category = String(
    song.category || song["Category"] || ""
  ).toLowerCase().trim();

  const video = String(
    song.videoUrl || song.videoURL || song["Video URL"] || ""
  ).trim();

  const cover = String(
    song.coverUrl || song.coverURL || song["Cover URL"] || ""
  ).trim();

  if (!id || !title || !video) return null;

  if (!["happy", "sad"].includes(category)) return null;

  return {
    id,
    title,
    artist,
    category,
    video,
    cover
  };
}


// ======================================
// DUPLICATE CHECKING
// ======================================

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function removeDuplicateSongs(list) {
  const seenIds = new Set();
  const seenVideos = new Set();
  const seenTitles = new Set();

  return list.filter(song => {
    const id = normalizeText(song.id);

    const video = String(song.video || "")
      .split("?")[0]
      .replace(/\/+$/, "")
      .toLowerCase();

    const title = normalizeText(song.title);
    const artist = normalizeText(song.artist);

    const titleArtist = `${title}-${artist}`;

    if (
      seenIds.has(id) ||
      seenVideos.has(video) ||
      seenTitles.has(titleArtist)
    ) {
      return false;
    }

    seenIds.add(id);
    seenVideos.add(video);
    seenTitles.add(titleArtist);

    return true;
  });
}


// ======================================
// LOAD SONGS FROM GOOGLE SHEETS
// ======================================

function loadRemoteSongs() {

  return new Promise(resolve => {

    const callbackName = "musicLabSongsCallback";

    const script = document.createElement("script");

    let finished = false;

    const timeout = setTimeout(() => {
      finish(false);
    }, 15000);


    function finish(success) {

      if (finished) return;

      finished = true;

      clearTimeout(timeout);

      delete window[callbackName];

      script.remove();

      $("#loadingState").hidden = true;

      $("#loadError").hidden = success;

      updateCounts();

      renderPersonalSections();

      applySearch();

      resolve(remoteSongs);
    }


    window[callbackName] = response => {

      const list = Array.isArray(response)
        ? response
        : response?.songs || response?.data || [];

      if (!Array.isArray(list)) {
        finish(false);
        return;
      }

      const normalized = list
        .map(normalizeRemoteSong)
        .filter(Boolean);

      remoteSongs = removeDuplicateSongs(normalized);


      // Clear old cards before rendering new songs

      $(".allhappysongs").replaceChildren();

      $(".allsadsongs").replaceChildren();


      // Add each song to its correct category

      remoteSongs.forEach(song => {

        const container = song.category === "happy"
          ? $(".allhappysongs")
          : $(".allsadsongs");

        container.appendChild(makeCard(song));

      });


      finish(true);
    };


    script.onerror = () => finish(false);

    script.src =
      `${scriptURL}?action=songs&callback=${callbackName}&_=${Date.now()}`;

    document.body.appendChild(script);

  });

}


// ======================================
// SONG CARDS
// ======================================

function makeCard(song, options = {}) {

  const card = document.createElement("article");

  card.className = "song-card";

  card.dataset.id = song.id;

  card.dataset.category = song.category || "";


  // Cover image

  const img = document.createElement("img");

  img.className = "song-img";

  img.alt = song.title;

  img.loading = "lazy";

  img.src = song.cover || "images/ranimg.png";

  img.onerror = () => {
    img.onerror = null;
    img.src = "images/ranimg.png";
  };


  // Song information

  const info = document.createElement("div");

  info.className = "songinfo";


  const heading = document.createElement("h2");

  heading.textContent = song.title;


  const artist = document.createElement("p");

  artist.className = "artist";

  artist.textContent = "Artist: " + (song.artist || "Unknown");


  // Play button

  const play = document.createElement("button");

  play.className = "play-btn";

  play.type = "button";

  play.textContent = "▶ Play";

  play.addEventListener("click", () => {

    location.href =
      "player.html?song=" + encodeURIComponent(song.id);

  });


  info.append(heading, artist, play);

  card.append(img, info);


  makeFavoriteButton(card, song.id);


  // Recent history remove button

  if (options.recent) {

    const remove = document.createElement("button");

    remove.type = "button";

    remove.className = "remove-recent";

    remove.textContent = "Remove";

    remove.addEventListener("click", () => {
      removeRecent(song.id);
    });

    card.append(remove);

  }

  return card;
}


// ======================================
// FAVORITES
// ======================================

function isFavorite(id) {

  return readStore("musicFavorites")
    .some(song => song.id === id);

}


function makeFavoriteButton(card, id) {

  let button = card.querySelector(".favorite-btn");

  if (!button) {

    button = document.createElement("button");

    button.className = "favorite-btn";

    button.type = "button";

    button.setAttribute("aria-label", "Toggle favorite");

    button.addEventListener("click", () => {
      toggleFavorite(id);
    });

    card.appendChild(button);

  }

  const active = isFavorite(id);

  button.classList.toggle("active", active);

  button.title = active
    ? "Remove from favorites"
    : "Add to favorites";

  button.textContent = active ? "♥" : "♡";

}


function toggleFavorite(id) {

  const song = remoteSongs.find(s => s.id === id);

  if (!song) return;

  let favorites = readStore("musicFavorites");

  if (favorites.some(s => s.id === id)) {

    favorites = favorites.filter(s => s.id !== id);

    toast("Removed from Favorites.");

  } else {

    favorites.unshift(song);

    toast("Added to Favorites.");

  }

  writeStore("musicFavorites", favorites);

  renderPersonalSections();

}


// ======================================
// RECENTLY PLAYED
// ======================================

function removeRecent(id) {

  const recent = readStore("musicRecent")
    .filter(song => song.id !== id);

  writeStore("musicRecent", recent);

  renderPersonalSections();

  toast("Song removed from history.");

}


function clearRecent() {

  writeStore("musicRecent", []);

  renderPersonalSections();

  toast("Listening history cleared.");

}


// ======================================
// PERSONAL SECTIONS
// ======================================

function renderPersonalSections() {

  const favorites = readStore("musicFavorites");

  const recent = readStore("musicRecent");


  $("#favoritesList").replaceChildren(
    ...favorites.map(song => makeCard(song))
  );


  $("#recentList").replaceChildren(
    ...recent.map(song => makeCard(song, { recent: true }))
  );


  $("#favoritesCount").textContent =
    `${favorites.length} songs`;

  $("#recentCount").textContent =
    `${recent.length} songs`;


  applyView();

}


// ======================================
// SONG COUNTS
// ======================================

function updateCounts() {

  const happy = $$(".allhappysongs .song-card").length;

  const sad = $$(".allsadsongs .song-card").length;

  $("#happyCount").textContent = `${happy} songs`;

  $("#sadCount").textContent = `${sad} songs`;

}


// ======================================
// NAVIGATION VIEWS
// ======================================

function applyView() {

  const sections = {
    home: ["happySection", "sadSection"],
    happy: ["happySection"],
    sad: ["sadSection"],
    favorites: ["favoritesSection"],
    recent: ["recentSection"]
  };

  const allowed = sections[activeView] || sections.home;


  [
    "happySection",
    "sadSection",
    "favoritesSection",
    "recentSection"
  ].forEach(id => {

    const section = $("#" + id);

    if (!allowed.includes(id)) {
      section.hidden = true;
    }

  });


  if (allowed.includes("favoritesSection")) {

    $("#favoritesSection").hidden =
      readStore("musicFavorites").length === 0;

  }


  if (allowed.includes("recentSection")) {

    $("#recentSection").hidden =
      readStore("musicRecent").length === 0;

  }


  applySearch();

}


// ======================================
// SEARCH
// ======================================

function applySearch() {

  const query = $("#musicSearch").value.trim().toLowerCase();

  let total = 0;


  const groups = [
    {
      id: "happySection",
      selector: ".allhappysongs"
    },
    {
      id: "sadSection",
      selector: ".allsadsongs"
    }
  ];


  groups.forEach(group => {

    const section = $("#" + group.id);

    const cards = [
      ...section.querySelectorAll(
        group.selector + " .song-card"
      )
    ];

    let visible = 0;


    cards.forEach(card => {

      const text = (
        (card.querySelector("h2")?.textContent || "") +
        " " +
        (card.querySelector(".artist")?.textContent || "")
      ).toLowerCase();

      const match = text.includes(query);

      card.hidden = !match;

      if (match) visible++;

    });


    section.dataset.matches = visible;

  });


  const allowed = activeView === "happy"
    ? ["happySection"]
    : activeView === "sad"
      ? ["sadSection"]
      : activeView === "home"
        ? ["happySection", "sadSection"]
        : [];


  allowed.forEach(id => {

    const section = $("#" + id);

    const visible = Number(section.dataset.matches || 0);

    section.hidden = visible === 0;

    total += visible;

  });


  // Favorites and recent search

  if (
    activeView === "favorites" ||
    activeView === "recent"
  ) {

    const isFavorites = activeView === "favorites";

    const list = isFavorites
      ? $("#favoritesList")
      : $("#recentList");

    const section = isFavorites
      ? $("#favoritesSection")
      : $("#recentSection");

    const cards = [...list.querySelectorAll(".song-card")];

    let visible = 0;


    cards.forEach(card => {

      const text = (
        (card.querySelector("h2")?.textContent || "") +
        " " +
        (card.querySelector(".artist")?.textContent || "")
      ).toLowerCase();

      card.hidden = !text.includes(query);

      if (!card.hidden) visible++;

    });


    section.hidden = visible === 0;

    total += visible;

  }


  $("#noResults").hidden = !query || total > 0;

}


// ======================================
// SHUFFLE MIX
// ======================================

$("#topbtn").addEventListener("click", () => {

  if (!remoteSongs.length) {
    toast("Music library is still loading!");
    return;
  }

  const song = remoteSongs[
    Math.floor(Math.random() * remoteSongs.length)
  ];

  location.href =
    "player.html?song=" + encodeURIComponent(song.id);

});


// ======================================
// SEARCH EVENT
// ======================================

$("#musicSearch").addEventListener("input", applySearch);


// ======================================
// YEAR
// ======================================

$("#year").textContent = new Date().getFullYear();


// ======================================
// SONG REQUEST SYSTEM
// ======================================

const overlay = $("#requestoverlay");

const form = $("#requestform");

const status = $("#requeststatus");

const submit = $("#submitrequest");


$("#requestbtn").addEventListener("click", () => {

  overlay.classList.add("active");

  status.textContent = "";

  $("#requestusername").focus();

});


function closeRequest() {

  overlay.classList.remove("active");

}


$("#closeRequest").addEventListener("click", closeRequest);


overlay.addEventListener("click", event => {

  if (event.target === overlay) {
    closeRequest();
  }

});


document.addEventListener("keydown", event => {

  if (event.key === "Escape") {
    closeRequest();
  }

});


form.addEventListener("submit", async event => {

  event.preventDefault();


  const song = $("#songname").value.trim();


  // Admin access

  if (song.toLowerCase() === adminTrigger) {

    location.href = scriptURL + "?page=admin";

    return;

  }


  const data = {

    name: $("#requestusername").value.trim(),

    song,

    artist: $("#artistname").value.trim(),

    link: $("#songlink").value.trim(),

    category: $("#songcategory").value,

    message: $("#songmessage").value.trim()

  };


  if (
    !data.name ||
    !data.song ||
    !["happy", "sad"].includes(data.category)
  ) {

    status.textContent =
      "Please complete all required fields.";

    return;

  }


  submit.disabled = true;

  submit.textContent = "Sending...";

  status.textContent = "";


  try {

    await fetch(scriptURL, {

      method: "POST",

      mode: "no-cors",

      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },

      body: JSON.stringify(data)

    });


    status.textContent =
      "Request sent for review. Thank you!";

    toast("Request submitted.");

    form.reset();


  } catch (error) {

    console.error(error);

    status.textContent =
      "Could not send your request. Check your connection and try again.";

    toast("Request failed.");


  } finally {

    submit.disabled = false;

    submit.textContent = "Submit Request";

  }

});


// ======================================
// LOAD MUSIC LIBRARY
// ======================================

loadRemoteSongs();


// ======================================
// RESPONSIVE SIDEBAR
// ======================================

const sidebar = $("#sidebar");

const menuToggle = $("#menuToggle");

const mobileScrim = $("#mobileScrim");


function closeSidebar() {

  sidebar.classList.remove("open");

  mobileScrim.classList.remove("show");

  menuToggle.setAttribute("aria-expanded", "false");

}


menuToggle.addEventListener("click", () => {

  const open = sidebar.classList.toggle("open");

  mobileScrim.classList.toggle("show", open);

  menuToggle.setAttribute("aria-expanded", String(open));

});


mobileScrim.addEventListener("click", closeSidebar);


// ======================================
// NAVIGATION LINKS
// ======================================

document.querySelectorAll(".nav-link").forEach(link => {

  link.addEventListener("click", () => {

    document.querySelectorAll(".nav-link").forEach(item => {
      item.classList.remove("active");
    });

    link.classList.add("active");

    closeSidebar();


    const section = link.dataset.section;


    activeView =
      section === "happySection" ? "happy" :
      section === "sadSection" ? "sad" :
      section === "favoritesSection" ? "favorites" :
      section === "recentSection" ? "recent" :
      "home";


    applyView();


    if (activeView === "home") {

      $("#home").scrollIntoView({
        behavior: "smooth"
      });

      return;

    }


    const targetId =
      activeView === "happy" ? "happySection" :
      activeView === "sad" ? "sadSection" :
      activeView === "favorites" ? "favoritesSection" :
      "recentSection";


    const target = $("#" + targetId);


    if (target.hidden) {

      toast(
        activeView === "favorites"
          ? "No saved favorites yet."
          : activeView === "recent"
            ? "No listening history yet."
            : "No songs available in this category."
      );

    } else {

      target.scrollIntoView({
        behavior: "smooth"
      });

    }

  });

});


// ======================================
// CLEAR HISTORY BUTTON
// ======================================

$("#clearHistory").addEventListener("click", clearRecent);


// ======================================
// WINDOW RESIZE
// ======================================

window.addEventListener("resize", () => {

  if (window.innerWidth > 760) {
    closeSidebar();
  }

});
