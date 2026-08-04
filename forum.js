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
    .select("id, title, body, image_url, reply_count, created_at, profiles(username)")
    .eq("category", cat)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map(function (t) {
    return {
      id: t.id,
      title: t.title,
      author: t.profiles ? t.profiles.username : "unknown",
      replies: t.reply_count,
      date: timeAgo(t.created_at)
    };
  });
}

async function saveThread(cat, title, body, imageUrl) {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    throw new Error("not-authenticated");
  }
  const { error } = await supabaseClient.from("threads").insert({
    category: cat,
    title: title,
    body: body,
    image_url: imageUrl || null,
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
        '<a class="thread-title" href="thread.html?id=' + encodeURIComponent(t.id) + '">' + escapeHtml(t.title) + "</a>" +
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

  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("is_admin, is_banned")
    .eq("id", session.user.id)
    .single();

  if (profile && profile.is_banned) {
    box.innerHTML = '<p class="auth-required">Your account has been banned from posting.</p>';
    return;
  }

  if (cat === "news-announcements" && (!profile || !profile.is_admin)) {
    box.innerHTML = '<p class="auth-required">Only verified admins can post in News &amp; Announcements.</p>';
    return;
  }

  box.innerHTML =
    '<form id="post-form">' +
      '<input type="text" id="post-title" placeholder="Thread title" required>' +
      '<textarea id="post-message" placeholder="Write your message..." rows="4" required></textarea>' +
      '<button type="submit">Post Thread</button>' +
      '<p class="auth-error" id="post-error"></p>' +
    "</form>";

  const formEl = document.getElementById("post-form");
  attachImagePicker(formEl, document.getElementById("post-message"));

  formEl.addEventListener("submit", async function (e) {
    e.preventDefault();
    const titleInput = document.getElementById("post-title");
    const messageInput = document.getElementById("post-message");
    const errorEl = document.getElementById("post-error");
    const title = titleInput.value.trim();
    const message = messageInput.value.trim();
    if (!title || !message) return;

    try {
      let imageUrl = null;
      if (formEl._selectedImageFile) {
        imageUrl = await uploadSelectedImage(formEl._selectedImageFile);
      }
      await saveThread(cat, title, message, imageUrl);
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
