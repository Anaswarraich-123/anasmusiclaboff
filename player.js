
const params = new URLSearchParams(location.search);
const $ = s => document.querySelector(s);

const video = $("#video");
const image = $("#image");
const loader = $(".loader");
const playbtn = $("#playingbtn");
const backbtn = $("#backbtn");
const nextbtn = $("#nextbtn");
const sname = $("#name");
const progress = $("#progress");
const currenttime = $("#currenttime");
const duration = $("#duration");
const fullscreenbtn = $("#fullscreenbtn");
const favBtn = $("#favoritePlayer");
const status = $("#playerstatus");
const playerCard = $(".card");
const artworkWrap = $(".artwork-wrap");
const videobtn = $("#videobtn");
const imagebtn = $("#imagebtn");

const scriptURL = "https://script.google.com/macros/s/AKfycbzfDCIY0hSKkxBaVIQ_SFXFfgUdpCgJqk10qN4NHinyppf2UoXQI-rPKRbu3anGOe3rXQ/exec";

progress.step = "any";

/* ICONS */

const playIcon = `
<svg viewBox="0 0 24 24" width="25" height="25" fill="currentColor">
  <path d="M8 5.8c0-.8.9-1.3 1.6-.9l10 6.2a1.1 1.1 0 0 1 0 1.8l-10 6.2c-.7.4-1.6-.1-1.6-.9z"/>
</svg>`;

const pauseIcon = `
<svg viewBox="0 0 24 24" width="25" height="25" fill="currentColor">
  <rect x="5" y="3.5" width="5" height="17" rx="1.5"/>
  <rect x="14" y="3.5" width="5" height="17" rx="1.5"/>
</svg>`;

function setPlayIcon(playing) {
  playbtn.innerHTML = playing ? pauseIcon : playIcon;
  playbtn.setAttribute("aria-label", playing ? "Pause" : "Play");
}

/* STATE */

let remoteSongs = [];
let song = params.get("song") || localStorage.getItem("selectedSong") || "";
let playlist = [];
let index = -1;

let metadataReady = false;
let introTimer = null;
let controlsTimer = null;
let progressFrame = null;

let progressAnchorTime = 0;
let progressAnchorNow = 0;

/* DEVICE */

const isMobile = () =>
  window.matchMedia("(pointer: coarse)").matches;

/* DISPLAY MODE */

let displayMode = localStorage.getItem("musicDisplayMode") || "image";

function setDisplayMode(mode) {
  displayMode = mode;
  localStorage.setItem("musicDisplayMode", mode);

  if (mode === "image") {
    video.style.opacity = "0";
    video.style.pointerEvents = "none";

    image.style.display = "block";
    image.style.opacity = "1";

    imagebtn.style.borderBottom = "2px solid #8f61ba";
    videobtn.style.borderBottom = "none";
  } else {
    image.style.opacity = "0";
    image.style.display = "none";

    video.style.opacity = "1";
    video.style.pointerEvents = "auto";

    videobtn.style.borderBottom = "2px solid #8f61ba";
    imagebtn.style.borderBottom = "none";
  }
}

videobtn.addEventListener("click", () => setDisplayMode("video"));
imagebtn.addEventListener("click", () => setDisplayMode("image"));

image.style.display = "block";
setDisplayMode(displayMode);

/* LOADER */

function showLoader() {
  loader.style.display = "flex";
}

function hideLoader() {
  loader.style.display = "none";
}

/* STORAGE */

const readStore = key => {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
};

const writeStore = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

function formatTime(n) {
  if (!Number.isFinite(n)) return "0:00";

  return `${Math.floor(n / 60)}:${String(
    Math.floor(n % 60)
  ).padStart(2, "0")}`;
}

/* CATEGORY CORRECTIONS */

function correctCategory(song) {
  const id = String(song.videoId || "").toLowerCase();
  const name = String(song.title || "").toLowerCase();

  if (
    id === "mererashke" ||
    id === "deewaneham" ||
    name === "mere rashke qamar" ||
    name === "deewane hum"
  ) {
    return "sad";
  }

  return song.category;
}

/* NORMALIZE API DATA */

function normalize(s) {
  const id = String(s.id || s.songId || s["Song ID"] || "").trim();
  const title = String(s.name || s.song || s.title || s.Song || "").trim();
  const artist = String(s.artist || s.Artist || "").trim();
  const videoId = String(s.videoId || s["Video ID"] || "").trim();

  const category = String(
    s.category || s.Category || ""
  ).toLowerCase().trim();

  const video = String(
    s.videoUrl || s.videoURL || s.video || s["Video URL"] || ""
  ).trim();

  const image = String(
    s.coverUrl || s.coverURL || s.image || s["Cover URL"] || ""
  ).trim();

  if (!id || !title || !video || !["happy", "sad"].includes(category)) {
    return null;
  }

  if (!/^https?:\/\//i.test(video)) return null;

  const item = {
    id,
    title,
    artist,
    videoId,
    category,
    video,
    image
  };

  item.category = correctCategory(item);

  return item;
}

/* LOAD SONGS FROM GOOGLE SHEETS */

function loadRemote() {
  return new Promise(resolve => {
    const callbackName = "musicLabCallback_" + Date.now();
    const script = document.createElement("script");

    let finished = false;

    const timeout = setTimeout(() => finish(false), 15000);

    function finish(success) {
      if (finished) return;

      finished = true;
      clearTimeout(timeout);

      delete window[callbackName];
      script.remove();

      resolve(success);
    }

    window[callbackName] = response => {
      const list = Array.isArray(response)
        ? response
        : response?.songs || response?.data || [];

      if (!Array.isArray(list)) {
        finish(false);
        return;
      }

      const normalized = list.map(normalize).filter(Boolean);

      const seenIds = new Set();
      const seenVideos = new Set();

      remoteSongs = normalized.filter(item => {
        const videoKey = item.video.toLowerCase();

        if (seenIds.has(item.id) || seenVideos.has(videoKey)) {
          return false;
        }

        seenIds.add(item.id);
        seenVideos.add(videoKey);

        return true;
      });

      finish(true);
    };

    script.onerror = () => finish(false);

    script.src =
      `${scriptURL}?action=songs&callback=${callbackName}&_=${Date.now()}`;

    document.body.appendChild(script);
  });
}

/* OLD ID ALIASES */

const aliases = {
  victory: "victoryanthem",
  rashkeqamar: "mererashke",
  deewameham: "deewaneham",
  terameraafsana: "teramera"
};

function cleanId(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getSong(id) {
  if (!id) return null;

  const value = String(id).trim();
  const cleaned = cleanId(value);
  const alias = aliases[cleaned] || cleaned;

  return (
    remoteSongs.find(s => s.id === value) ||
    remoteSongs.find(s => s.videoId.toLowerCase() === value.toLowerCase()) ||
    remoteSongs.find(s => cleanId(s.videoId) === alias) ||
    remoteSongs.find(s => cleanId(s.title) === alias) ||
    null
  );
}

/* PLAYLIST */

function buildPlaylist(selectedSong) {
  if (!selectedSong) return [];

  return remoteSongs
    .filter(s => s.category === selectedSong.category)
    .map(s => s.id);
}

function updatePlaylist() {
  const selected = getSong(song);

  playlist = buildPlaylist(selected);
  index = playlist.indexOf(song);

  backbtn.disabled = index <= 0;
  nextbtn.disabled = index < 0 || index >= playlist.length - 1;
}

/* RECENTLY PLAYED */

function storeRecent(id, details) {
  const item = {
    id,
    title: details.title,
    artist: details.artist || "",
    cover: details.image || "",
    category: details.category
  };

  let list = readStore("musicRecent");

  list = list.filter(s => s.id !== id);
  list.unshift(item);

  writeStore("musicRecent", list.slice(0, 12));
}

/* FAVORITES */

function favoriteState() {
  const favorites = readStore("musicFavorites");
  const active = favorites.some(s => s.id === song);

  favBtn.classList.toggle("active", active);
  favBtn.textContent = active
    ? "♥ Saved to Favorites"
    : "♡ Add to Favorites";
}

function toggleFavorite() {
  const details = getSong(song);
  if (!details) return;

  let favorites = readStore("musicFavorites");

  if (favorites.some(s => s.id === song)) {
    favorites = favorites.filter(s => s.id !== song);
    status.textContent = "Removed from Favorites.";
  } else {
    favorites.unshift({
      id: song,
      title: details.title,
      artist: details.artist,
      cover: details.image,
      category: details.category
    });

    status.textContent = "Added to Favorites.";
  }

  writeStore("musicFavorites", favorites);
  favoriteState();
}

/* SAVE SELECTED SONG */

function saveSelected(id) {
  localStorage.setItem("selectedSong", id);

  const url = new URL(location.href);
  url.searchParams.set("song", id);

  history.replaceState(null, "", url);
}

/* PROGRESS BAR */

function syncProgressClock() {
  progressAnchorTime = video.currentTime;
  progressAnchorNow = performance.now();
}

function renderProgress(time) {
  if (!Number.isFinite(video.duration) || video.duration <= 0) return;

  const safeTime = Math.min(time, video.duration);

  progress.value = (safeTime / video.duration) * 100;
  currenttime.textContent = formatTime(safeTime);
  duration.textContent = formatTime(video.duration);
}

function updateProgressDisplay() {
  syncProgressClock();
  renderProgress(video.currentTime);
}

function stopProgressAnimation() {
  if (progressFrame !== null) {
    cancelAnimationFrame(progressFrame);
    progressFrame = null;
  }
}

function animateProgress() {
  stopProgressAnimation();
  syncProgressClock();

  function frame() {
    if (
      video.paused ||
      video.ended ||
      video.seeking ||
      !Number.isFinite(video.duration) ||
      video.duration <= 0
    ) {
      progressFrame = null;
      return;
    }

    const elapsed =
      (performance.now() - progressAnchorNow) / 1000;

    const estimatedTime =
      progressAnchorTime + elapsed * video.playbackRate;

    renderProgress(estimatedTime);

    progressFrame = requestAnimationFrame(frame);
  }

  progressFrame = requestAnimationFrame(frame);
}

/* LOAD SONG */

function loadSong(id) {
  const details = getSong(id);

  if (!details) {
    status.textContent =
      "Song not found. Please select a song from your library.";

    hideLoader();
    return;
  }

  song = details.id;
  saveSelected(song);

  clearTimeout(introTimer);
  clearTimeout(controlsTimer);
  stopProgressAnimation();

  playerCard.classList.remove("controls-hidden");

  video.pause();
  video.removeAttribute("src");
  video.load();

  metadataReady = false;

  document.title = `${details.title} | Anas Music Lab`;

  sname.textContent = details.artist
    ? `${details.title} | ${details.artist}`
    : details.title;

  status.textContent = "";

  progress.value = 0;
  currenttime.textContent = "0:00";
  duration.textContent = "0:00";

  setPlayIcon(false);

  image.style.display = "none";
  image.removeAttribute("src");

  if (details.image) {
    image.src = details.image;
  }

  setDisplayMode(displayMode);

  showLoader();

  video.src = details.video;
  video.load();

  storeRecent(song, details);
  favoriteState();
  updatePlaylist();
}

/* IMAGE EVENTS */

image.addEventListener("load", () => {
  if (displayMode === "image") {
    image.style.display = "block";
  }
});

image.addEventListener("error", () => {
  image.style.display = "none";
  image.removeAttribute("src");
});

/* VIDEO EVENTS */

video.addEventListener("loadedmetadata", () => {
  metadataReady = true;
  duration.textContent = formatTime(video.duration);
});

video.addEventListener("loadeddata", () => {
  hideLoader();
  updateProgressDisplay();

  clearTimeout(introTimer);

  introTimer = setTimeout(() => {
    if (video.paused) {
      video.play().catch(() => {
        status.textContent =
          "Press Play to start listening. Autoplay was blocked.";

        setPlayIcon(false);
      });
    }
  }, 1200);
});

video.addEventListener("playing", () => {
  hideLoader();
  setPlayIcon(true);
  status.textContent = "";

  animateProgress();
  showFullscreenControls();
});

/* PAUSE: TIMER ALSO WORKS WHEN PAUSED */

video.addEventListener("pause", () => {
  setPlayIcon(false);
  stopProgressAnimation();
  updateProgressDisplay();

  showFullscreenControls();
});

video.addEventListener("waiting", () => {
  if (!video.paused) {
    stopProgressAnimation();
    showLoader();
  }
});

video.addEventListener("stalled", () => {
  if (!video.paused) {
    stopProgressAnimation();
    showLoader();
  }
});

video.addEventListener("canplay", hideLoader);

video.addEventListener("seeking", stopProgressAnimation);

video.addEventListener("seeked", () => {
  updateProgressDisplay();

  if (!video.paused) {
    animateProgress();
  }
});

video.addEventListener("timeupdate", () => {
  if (video.paused || video.seeking) {
    updateProgressDisplay();
  } else {
    syncProgressClock();
  }
});

video.addEventListener("ratechange", syncProgressClock);

video.addEventListener("ended", () => {
  stopProgressAnimation();
  move(1);
});

video.addEventListener("error", () => {
  hideLoader();
  stopProgressAnimation();
  setPlayIcon(false);

  status.textContent =
    "Song load nahi ho saka. Internet ya video URL check karo.";
});

/* SEEKING */

progress.addEventListener("input", () => {
  if (metadataReady && Number.isFinite(video.duration)) {
    video.currentTime =
      (Number(progress.value) / 100) * video.duration;

    updateProgressDisplay();
  }

  revealControls();
});

/* PLAY / PAUSE */

function playPause() {
  if (!metadataReady) {
    status.textContent = "Your song is still loading.";
    return;
  }

  clearTimeout(introTimer);

  if (video.paused) {
    video.play().catch(() => {
      status.textContent = "Playback could not start. Try again.";
      setPlayIcon(false);
    });
  } else {
    video.pause();
  }
}

/* NEXT / PREVIOUS */

function move(step) {
  const nextIndex = index + step;

  if (nextIndex >= 0 && nextIndex < playlist.length) {
    loadSong(playlist[nextIndex]);
  }
}

/* BUTTON EVENTS */

playbtn.addEventListener("click", playPause);

backbtn.addEventListener("click", () => move(-1));
nextbtn.addEventListener("click", () => move(1));

favBtn.addEventListener("click", toggleFavorite);

/* PC VIDEO CLICK */

video.addEventListener("click", () => {
  if (!isMobile()) {
    playPause();
  }
});

image.addEventListener("click", () => {
  if (!isMobile()) {
    playPause();
  }
});

/* FULLSCREEN CONTROLS */

function showFullscreenControls() {
  if (document.fullscreenElement !== playerCard) return;

  clearTimeout(controlsTimer);
  playerCard.classList.remove("controls-hidden");

  controlsTimer = setTimeout(() => {
    if (document.fullscreenElement === playerCard) {
      playerCard.classList.add("controls-hidden");
    }
  }, 3000);
}

function hideFullscreenControls() {
  clearTimeout(controlsTimer);

  if (document.fullscreenElement === playerCard) {
    playerCard.classList.add("controls-hidden");
  }
}

function revealControls() {
  if (document.fullscreenElement !== playerCard) return;
  if (isMobile()) return;

  showFullscreenControls();
}

/* MOBILE FULLSCREEN TAP DETECTION */

artworkWrap.addEventListener("pointerup", event => {
  if (!isMobile()) return;
  if (document.fullscreenElement !== playerCard) return;

  const target = event.target;

  // Buttons aur doosre controls par tap ko ignore karo
  if (
    target.closest(
      "#fullscreenbtn, #imagebtn, #videobtn, .track-details, .timeline, .controls, #playerstatus, .loader"
    )
  ) {
    return;
  }

  // Hidden controls hon to show karo
  if (playerCard.classList.contains("controls-hidden")) {
    showFullscreenControls();
  } else {
    // Visible hon to hide karo
    hideFullscreenControls();
  }
});

/* PC MOUSE MOVEMENT */

playerCard.addEventListener("pointermove", event => {
  if (event.pointerType !== "touch") {
    revealControls();
  }
});

/* FULLSCREEN */

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement === playerCard) {
      await document.exitFullscreen();
    } else if (!document.fullscreenElement) {
      await playerCard.requestFullscreen();

      if (screen.orientation?.lock) {
        try {
          await screen.orientation.lock("landscape");
        } catch (error) {
          console.log("Orientation lock unavailable:", error);
        }
      }
    }
  } catch (error) {
    console.warn("Fullscreen error:", error);
  }
}

fullscreenbtn.addEventListener("click", toggleFullscreen);

video.addEventListener("dblclick", toggleFullscreen);
image.addEventListener("dblclick", toggleFullscreen);

/* FULLSCREEN CHANGE */

document.addEventListener("fullscreenchange", () => {
  clearTimeout(controlsTimer);
  playerCard.classList.remove("controls-hidden");

  if (document.fullscreenElement === playerCard) {
    showFullscreenControls();
  } else {
    screen.orientation?.unlock?.();
  }
});

/* KEYBOARD */

document.addEventListener("keydown", event => {
  if (
    event.code === "Space" &&
    !["INPUT", "TEXTAREA", "BUTTON"].includes(
      document.activeElement.tagName
    )
  ) {
    event.preventDefault();
    playPause();
  }

  if (document.fullscreenElement === playerCard) {
    revealControls();
  }
});

/* START PLAYER */

async function start() {
  showLoader();
  status.textContent = "Loading songs...";

  const success = await loadRemote();

  if (!success || remoteSongs.length === 0) {
    hideLoader();

    status.textContent =
      "Songs load nahi ho sake. Google Sheets connection check karo.";

    return;
  }

  let selected = getSong(song);

  if (!song) {
    selected = remoteSongs[0];
  }

  if (!selected) {
    hideLoader();

    status.textContent =
      "Selected song nahi mila. Library se dobara song select karo.";

    return;
  }

  loadSong(selected.id);
}

start();
