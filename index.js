const SEED_COUNTS = {
  "general-discussion": 2,
  "news-announcements": 1,
  "replicas-upgrades": 2,
  "loadouts-gear": 1,
  "buy-sell-trade": 2,
  "field-ratings": 1,
  "events-milsims": 1
};

document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll("[data-cat]").forEach(async function (el) {
    const cat = el.dataset.cat;
    const { count, error } = await supabaseClient
      .from("threads")
      .select("*", { count: "exact", head: true })
      .eq("category", cat);

    const total = (error ? 0 : count || 0) + (SEED_COUNTS[cat] || 0);
    el.textContent = total.toLocaleString();
  });
});
