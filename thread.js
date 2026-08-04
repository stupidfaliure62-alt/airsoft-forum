function timeAgoThread(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins + " min" + (mins === 1 ? "" : "s") + " ago";
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + " hour" + (hours === 1 ? "" : "s") + " ago";
  const days = Math.floor(hours / 24);
  return days + " day" + (days === 1 ? "" : "s") + " ago";
}

function escapeHtmlThread(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function loadReplies(threadId) {
  const { data, error } = await supabaseClient
    .from("replies")
    .select("body, image_url, created_at, profiles(username)")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data.map(function (r) {
    return {
      body: r.body,
      imageUrl: r.image_url,
      author: r.profiles ? r.profiles.username : "unknown",
      date: timeAgoThread(r.created_at)
    };
  });
}

async function renderReplies(threadId) {
  const list = document.getElementById("replies-list");
  list.innerHTML = '<li class="thread-empty">Loading replies...</li>';
  const replies = await loadReplies(threadId);
  document.getElementById("replies-heading").textContent = "Replies (" + replies.length + ")";
  list.innerHTML = "";
  if (replies.length === 0) {
    list.innerHTML = '<li class="thread-empty">No replies yet. Be the first to reply.</li>';
    return;
  }
  replies.forEach(function (r) {
    const li = document.createElement("li");
    li.className = "thread-row";
    li.innerHTML =
      '<div class="thread-info">' +
        '<p class="reply-body">' + escapeHtmlThread(r.body) + "</p>" +
        (r.imageUrl ? '<img class="reply-image" src="' + escapeHtmlThread(r.imageUrl) + '" alt="">' : "") +
        '<p class="thread-meta">by ' + escapeHtmlThread(r.author) + " &middot; " + escapeHtmlThread(r.date) + "</p>" +
      "</div>";
    list.appendChild(li);
  });
}

async function saveReply(threadId, body, imageUrl) {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) throw new Error("not-authenticated");
  const { error } = await supabaseClient.from("replies").insert({
    thread_id: threadId,
    body: body,
    image_url: imageUrl || null,
    author_id: session.user.id
  });
  if (error) throw error;
}

async function initReplyBox(threadId) {
  const { data: { session } } = await supabaseClient.auth.getSession();
  const box = document.getElementById("reply-box-inner");

  if (!session) {
    box.innerHTML = '<p class="auth-required">You need to <a href="auth.html">log in</a> to reply.</p>';
    return;
  }

  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("is_banned")
    .eq("id", session.user.id)
    .single();

  if (profile && profile.is_banned) {
    box.innerHTML = '<p class="auth-required">Your account has been banned from posting.</p>';
    return;
  }

  box.innerHTML =
    '<form id="reply-form">' +
      '<textarea id="reply-message" placeholder="Write your reply..." rows="3" required></textarea>' +
      '<button type="submit">Post Reply</button>' +
      '<p class="auth-error" id="reply-error"></p>' +
    "</form>";

  const formEl = document.getElementById("reply-form");
  attachImagePicker(formEl, document.getElementById("reply-message"));

  formEl.addEventListener("submit", async function (e) {
    e.preventDefault();
    const messageInput = document.getElementById("reply-message");
    const errorEl = document.getElementById("reply-error");
    const message = messageInput.value.trim();
    if (!message) return;

    try {
      let imageUrl = null;
      if (formEl._selectedImageFile) {
        imageUrl = await uploadSelectedImage(formEl._selectedImageFile);
      }
      await saveReply(threadId, message, imageUrl);
      messageInput.value = "";
      renderReplies(threadId);
    } catch (err) {
      errorEl.textContent = "Couldn't post your reply. Please try again.";
    }
  });
}

async function initThreadPage() {
  const params = new URLSearchParams(window.location.search);
  const threadId = params.get("id");

  if (!threadId) {
    window.location.href = "index.html";
    return;
  }

  const { data: thread, error } = await supabaseClient
    .from("threads")
    .select("id, category, title, body, image_url, created_at, profiles(username)")
    .eq("id", threadId)
    .single();

  if (error || !thread) {
    window.location.href = "index.html";
    return;
  }

  const category = CATEGORIES[thread.category];
  const author = thread.profiles ? thread.profiles.username : "unknown";

  document.title = thread.title + " | AF";
  document.getElementById("thread-title").textContent = thread.title;
  document.getElementById("thread-meta").textContent = "by " + author + " · " + timeAgoThread(thread.created_at);
  document.getElementById("thread-body").textContent = thread.body;
  document.getElementById("thread-crumb").textContent = thread.title;

  if (thread.image_url) {
    const img = document.getElementById("thread-image");
    img.src = thread.image_url;
    img.style.display = "block";
  }

  if (category) {
    document.getElementById("category-crumb-link").textContent = category.title;
    document.getElementById("category-crumb-link").href = "forum.html?cat=" + encodeURIComponent(thread.category);
  }

  renderReplies(threadId);
  initReplyBox(threadId);

  supabaseClient.auth.onAuthStateChange(function () {
    initReplyBox(threadId);
  });
}

document.addEventListener("DOMContentLoaded", initThreadPage);
