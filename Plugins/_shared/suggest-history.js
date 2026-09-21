// Recent-usage history for the @/# autocomplete popup: a synced, case-insensitively-deduped list of the mentions and
// hashtags you've used, most-recently-used first. Entries are lightweight suggestion objects — `{ value, date }` (the
// handle/acct/tag to insert, and its newest known use in epoch ms — the post's own date), plus whatever extras the
// service wants to carry (Mastodon adds an `id` so the popup can batch-hydrate current names/avatars). One rule keeps
// the order honest no matter which feeder runs when: the merge keeps each value's newest date and sorts by it — so an
// old post resurfacing in a thread can't jump its tags ahead of what you just typed, and a post made on another
// client sorts to where it belongs. Capped, best-effort — a hiccup here must never fail a post that already
// succeeded. Churn-free: an unchanged list skips the synced write, so a timeline full of your own posts doesn't
// rewrite storage every refresh.
//
// What lives here is only the service-agnostic concept ("recents"): remembering values and offering them back.
// Extracting mentions/tags from a post, hydrating names/avatars, and merging with server search results all differ
// per service and stay in each service's shared file.
const HISTORY_MAX = 100;   // stored depth — how far back typing a prefix can still find someone
const HISTORY_SHOW = 25;   // rows a bare "@"/"#" offers, and the per-call hydrate batch cap (Bluesky's getProfiles takes at most 25 actors)

function remember(key, entries) {
    try {
        const clean = (entries ?? []).filter(entry => entry?.value);
        if (clean.length === 0) { return; }
        const history = historyList(key);
        const before = JSON.stringify(history);
        const merged = new Map(history.map(entry => [entry.value.toLowerCase(), entry]));
        for (const entry of clean) {
            const existing = merged.get(entry.value.toLowerCase());
            if (existing == null || (entry.date ?? 0) > (existing.date ?? 0)) { merged.set(entry.value.toLowerCase(), entry); }
        }
        const next = JSON.stringify([...merged.values()].sort((a, b) => (b.date ?? 0) - (a.date ?? 0)).slice(0, HISTORY_MAX));
        if (next !== before) { setItem(key, next, true); }
    } catch (error) {
        console.log(`remember(${key}) failed (non-fatal): ${error}`);
    }
}

// The stored history for `key` as suggestion objects, tolerating legacy plain-string entries from before that shape.
// Capped on read too, so a longer list stored by an earlier build (or another device) still respects HISTORY_MAX.
function historyList(key) {
    return JSON.parse(getItem(key, true) ?? "[]").map(entry => typeof entry === "string" ? { value: entry } : entry).filter(entry => entry?.value).slice(0, HISTORY_MAX);
}

// The remembered entries for `key`: a bare marker (empty query) gets the most-recent HISTORY_SHOW; a partial query
// searches the WHOLE stored depth for case-insensitive prefix matches — so someone pushed off the bare list by a
// burst of one-off mentions is still found the moment you type a few letters. Degrades to none on any storage/parse
// hiccup.
function recent(key, query) {
    try {
        const list = historyList(key);
        const lowerQuery = query.toLowerCase();
        return query.length === 0 ? list.slice(0, HISTORY_SHOW) : list.filter(entry => entry.value.toLowerCase().startsWith(lowerQuery));
    } catch (error) {
        return [];
    }
}
