const CATEGORIES = {
  "general-discussion": {
    icon: "GD",
    title: "General Discussion",
    desc: "Talk about anything airsoft related."
  },
  "news-announcements": {
    icon: "NB",
    title: "News & Announcements",
    desc: "Site updates and community news."
  },
  "replicas-upgrades": {
    icon: "RP",
    title: "Replicas & Upgrades",
    desc: "AEGs, GBBs, HPA, and internals."
  },
  "loadouts-gear": {
    icon: "LO",
    title: "Loadouts & Gear",
    desc: "Plate carriers, camo, and kit setups."
  },
  "buy-sell-trade": {
    icon: "BS",
    title: "Buy / Sell / Trade",
    desc: "Marketplace for gear and replicas."
  },
  "field-ratings": {
    icon: "FR",
    title: "Field Ratings",
    desc: "Reviews and ratings for local fields."
  },
  "events-milsims": {
    icon: "EV",
    title: "Events & Milsims",
    desc: "Find and organize local events."
  }
};

const SEED_THREADS = {
  "general-discussion": [
    { title: "First time at a field tomorrow, any tips?", author: "greenhorn22", replies: 14, date: "2 hours ago" },
    { title: "What got you into airsoft?", author: "woodlandwarrior", replies: 41, date: "1 day ago" }
  ],
  "news-announcements": [
    { title: "Forum rules updated for 2026", author: "admin", replies: 3, date: "3 days ago" }
  ],
  "replicas-upgrades": [
    { title: "Best AEG gearbox for the price?", author: "gearheadgus", replies: 22, date: "5 hours ago" },
    { title: "HPA engine recommendations", author: "hpahenry", replies: 9, date: "1 day ago" }
  ],
  "loadouts-gear": [
    { title: "Show off your plate carrier setup", author: "kitcollector", replies: 67, date: "6 hours ago" }
  ],
  "buy-sell-trade": [
    { title: "WTS: barely used M4 replica", author: "sellersam", replies: 5, date: "12 hours ago" },
    { title: "WTB: mid-cap mags", author: "magmaniac", replies: 2, date: "1 day ago" }
  ],
  "field-ratings": [
    { title: "Review: Blacksite Airsoft field", author: "fieldscout", replies: 18, date: "4 hours ago" }
  ],
  "events-milsims": [
    { title: "Milsim weekend event, October", author: "opscommand", replies: 30, date: "2 days ago" }
  ]
};

function storageKey(cat) {
  return "af_threads_" + cat;
}

function loadThreads(cat) {
  const stored = localStorage.getItem(storageKey(cat));
  const custom = stored ? JSON.parse(stored) : [];
  return custom.concat(SEED_THREADS[cat] || []);
}

function saveThread(cat, thread) {
  const stored = localStorage.getItem(storageKey(cat));
  const custom = stored ? JSON.parse(stored) : [];
  custom.unshift(thread);
  localStorage.setItem(storageKey(cat), JSON.stringify(custom));
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderThreads(cat) {
  const list = document.getElementById("thread-list");
  const threads = loadThreads(cat);
  list.innerHTML = "";
  if (threads.length === 0) {
    list.innerHTML = '<li class="thread-empty">No threads yet. Start the conversation below.</li>';
    return;
  }
  threads.forEach(function (t) {
    const li = document.createElement("li");
    li.className = "thread-row";
    li.innerHTML =
      '<div class="thread-info">' +
        '<span class="thread-title">' + escapeHtml(t.title) + "</span>" +
        '<p class="thread-meta">by ' + escapeHtml(t.author) + " &middot; " + escapeHtml(t.date) + "</p>" +
      "</div>" +
      '<div class="forum-stats"><span>' + t.replies + "</span> replies</div>";
    list.appendChild(li);
  });
}

function initForumPage() {
  const params = new URLSearchParams(window.location.search);
  const cat = params.get("cat");
  const category = CATEGORIES[cat];

  if (!category) {
    window.location.href = "index.html";
    return;
  }

  document.title = category.title + " | AF";
  document.getElementById("category-icon").textContent = category.icon;
  document.getElementById("category-title").textContent = category.title;
  document.getElementById("category-desc").textContent = category.desc;
  document.getElementById("category-crumb").textContent = category.title;

  renderThreads(cat);

  const form = document.getElementById("post-form");
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    const titleInput = document.getElementById("post-title");
    const messageInput = document.getElementById("post-message");
    const title = titleInput.value.trim();
    const message = messageInput.value.trim();
    if (!title || !message) return;

    saveThread(cat, {
      title: title,
      author: "You",
      replies: 0,
      date: "just now"
    });

    titleInput.value = "";
    messageInput.value = "";
    renderThreads(cat);
  });
}

document.addEventListener("DOMContentLoaded", initForumPage);
