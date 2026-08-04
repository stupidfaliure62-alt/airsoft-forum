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

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins + " min" + (mins === 1 ? "" : "s") + " ago";
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + " hour" + (hours === 1 ? "" : "s") + " ago";
  const days = Math.floor(hours / 24);
  return days + " day" + (days === 1 ? "" : "s") + " ago";
}

async function loadThreads(cat) {
  const { data, error } = await supabaseClient
    .from("threads")
    .select("title, body, reply_count, created_at, profiles(username)")
    .eq("category", cat)
    .order("created_at", { ascending: false });

  const real = (error || !data) ? [] : data.map(function (t) {
    return {
      title: t.title,
      author: t.profiles ? t.profiles.username : "unknown",
      replies: t.reply_count,
      date: timeAgo(t.created_at)
    };
  });

  return real.concat(SEED_THREADS[cat] || []);
}

async function saveThread(cat, title, body) {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    throw new Error("not-authenticated");
  }
  const { error } = await supabaseClient.from("threads").insert({
    category: cat,
    title: title,
    body: body,
    author_id: session.user.id
  });
  if (error) throw error;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function renderThreads(cat) {
  const list = document.getElementById("thread-list");
  list.innerHTML = '<li class="thread-empty">Loading threads...</li>';
  const threads = await loadThreads(cat);
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

async function initPostBox(cat) {
  const { data: { session } } = await supabaseClient.auth.getSession();
  const box = document.getElementById("post-box-inner");

  if (!session) {
    box.innerHTML = '<p class="auth-required">You need to <a href="auth.html">log in</a> to start a thread.</p>';
    return;
  }

  box.innerHTML =
    '<form id="post-form">' +
      '<input type="text" id="post-title" placeholder="Thread title" required>' +
      '<textarea id="post-message" placeholder="Write your message..." rows="4" required></textarea>' +
      '<button type="submit">Post Thread</button>' +
      '<p class="auth-error" id="post-error"></p>' +
    "</form>";

  document.getElementById("post-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    const titleInput = document.getElementById("post-title");
    const messageInput = document.getElementById("post-message");
    const errorEl = document.getElementById("post-error");
    const title = titleInput.value.trim();
    const message = messageInput.value.trim();
    if (!title || !message) return;

    try {
      await saveThread(cat, title, message);
      titleInput.value = "";
      messageInput.value = "";
      renderThreads(cat);
    } catch (err) {
      errorEl.textContent = "Couldn't post your thread. Please try again.";
    }
  });
}

async function initForumPage() {
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
  initPostBox(cat);

  supabaseClient.auth.onAuthStateChange(function () {
    initPostBox(cat);
  });
}

document.addEventListener("DOMContentLoaded", initForumPage);
