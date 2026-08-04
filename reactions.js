const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

async function getVoteData(targetType, targetId) {
  const { data: { session } } = await supabaseClient.auth.getSession();
  const { data } = await supabaseClient
    .from("votes")
    .select("value, user_id")
    .eq("target_type", targetType)
    .eq("target_id", targetId);

  const rows = data || [];
  const score = rows.reduce(function (sum, r) { return sum + r.value; }, 0);
  const mine = session ? rows.find(function (r) { return r.user_id === session.user.id; }) : null;
  return { score: score, userVote: mine ? mine.value : 0 };
}

async function castVote(targetType, targetId, value) {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) throw new Error("not-authenticated");

  const { data: existing } = await supabaseClient
    .from("votes")
    .select("id, value")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (existing && existing.value === value) {
    await supabaseClient.from("votes").delete().eq("id", existing.id);
  } else if (existing) {
    await supabaseClient.from("votes").update({ value: value }).eq("id", existing.id);
  } else {
    await supabaseClient.from("votes").insert({
      target_type: targetType,
      target_id: targetId,
      user_id: session.user.id,
      value: value
    });
  }
}

async function renderVoteWidget(container, targetType, targetId) {
  const { score, userVote } = await getVoteData(targetType, targetId);
  container.innerHTML =
    '<button class="vote-btn vote-up' + (userVote === 1 ? " active" : "") + '" data-value="1" title="Upvote">&#9650;</button>' +
    '<span class="vote-score">' + score + "</span>" +
    '<button class="vote-btn vote-down' + (userVote === -1 ? " active" : "") + '" data-value="-1" title="Downvote">&#9660;</button>';

  container.querySelectorAll(".vote-btn").forEach(function (btn) {
    btn.addEventListener("click", async function () {
      try {
        await castVote(targetType, targetId, parseInt(btn.dataset.value, 10));
        renderVoteWidget(container, targetType, targetId);
      } catch (err) {
        alert("You need to log in to vote.");
      }
    });
  });
}

async function getReactionData(targetType, targetId) {
  const { data: { session } } = await supabaseClient.auth.getSession();
  const { data } = await supabaseClient
    .from("reactions")
    .select("emoji, user_id")
    .eq("target_type", targetType)
    .eq("target_id", targetId);

  const rows = data || [];
  const counts = {};
  rows.forEach(function (r) {
    counts[r.emoji] = (counts[r.emoji] || 0) + 1;
  });
  const mine = session
    ? rows.filter(function (r) { return r.user_id === session.user.id; }).map(function (r) { return r.emoji; })
    : [];
  return { counts: counts, mine: mine };
}

async function toggleReaction(targetType, targetId, emoji) {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) throw new Error("not-authenticated");

  const { data: existing } = await supabaseClient
    .from("reactions")
    .select("id")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .eq("user_id", session.user.id)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existing) {
    await supabaseClient.from("reactions").delete().eq("id", existing.id);
  } else {
    await supabaseClient.from("reactions").insert({
      target_type: targetType,
      target_id: targetId,
      user_id: session.user.id,
      emoji: emoji
    });
  }
}

async function renderReactionBar(container, targetType, targetId) {
  const { counts, mine } = await getReactionData(targetType, targetId);

  function pill(emoji) {
    const isMine = mine.indexOf(emoji) !== -1;
    const count = counts[emoji] || 0;
    return '<button class="reaction-pill' + (isMine ? " active" : "") + '" data-emoji="' + emoji + '">' +
      emoji + (count ? ' <span class="reaction-count">' + count + "</span>" : "") +
      "</button>";
  }

  const active = REACTION_EMOJIS.filter(function (e) { return counts[e]; });
  const rest = REACTION_EMOJIS.filter(function (e) { return !counts[e]; });

  container.innerHTML =
    active.map(pill).join("") +
    '<button type="button" class="reaction-add">+</button>' +
    '<span class="reaction-picker" style="display:none;">' + rest.map(pill).join("") + "</span>";

  container.querySelectorAll("[data-emoji]").forEach(function (btn) {
    btn.addEventListener("click", async function () {
      try {
        await toggleReaction(targetType, targetId, btn.dataset.emoji);
        renderReactionBar(container, targetType, targetId);
      } catch (err) {
        alert("You need to log in to react.");
      }
    });
  });

  const addBtn = container.querySelector(".reaction-add");
  const picker = container.querySelector(".reaction-picker");
  addBtn.addEventListener("click", function () {
    picker.style.display = picker.style.display === "none" ? "inline-flex" : "none";
  });
}
