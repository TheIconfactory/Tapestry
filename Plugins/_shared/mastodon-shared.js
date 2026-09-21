
// org.joinmastodon - shared

// The synced @/# usage history (remember/recent/HISTORY_*) lives in its own shared resource.
if (require('suggest-history.js') === false) {
    throw new Error("Failed to load suggest-history.js");
}

function normalizeAccount(account) {
    let result = account.trim();
    if (result.length > 1 && result.startsWith("@")) {
        result = result.slice(1);
    }
    return result;
}

function normalizeList(list) {
    return list.trim();
}

function normalizeTag(tag) {
    let result = tag.trim();
    if (result.length > 1 && result.startsWith("#")) {
        result = result.slice(1);
    }
    return result;
}

function postForItem(item) {
    const postDate = new Date(item["created_at"]);

    let shortcodes = {};
    let annotation = null;

    if (item["reblog"] != null) {
        const account = item["account"];
        const displayName = account["display_name"];
        const userName = account["username"];
        const accountName = (displayName ? displayName : userName);
        annotation = Annotation.createWithText(`${accountName} Boosted`);
        annotation.uri = account["url"];
        annotation.icon = account["avatar"];

        // We use the booster's display_name in the annotation and it may have custom emoji.
        const accountEmojis = account["emojis"];
        if (accountEmojis != null && accountEmojis.length > 0) {
            for (const emoji of accountEmojis) {
                shortcodes[emoji.shortcode] = emoji.static_url;
            }
        }

        // The rest of the info all comes from the boosted item itself.
        item = item["reblog"];
    }

    const uri = item["url"];
    const post = Item.createWithUriDate(uri, postDate);

    const account = item["account"];
    const displayName = account["display_name"];
    const userName = account["username"];
    const accountName = (displayName ? displayName : userName);
    const fullAccountName = account["acct"];
    const identity = Identity.createWithName(accountName);
    identity.username = "@" + fullAccountName;
    identity.uri = account["url"];
    identity.avatar = account["avatar"];
    post.author = identity;

    post.body = item["content"];

    const spoilerText = item["spoiler_text"];
    if (spoilerText != null && spoilerText.length > 0) {
        post.contentWarning = spoilerText;
    }
    else if (item["sensitive"] == true) {
        post.contentWarning = "Sensitive content";
    }
		
    if (annotation == null) {
        const visibility = item["visibility"] ?? "public";

        if (visibility == "private") {
            annotation = Annotation.createWithText(`FOLLOWERS ONLY`);
        }
        else if (visibility == "direct") {
            annotation = Annotation.createWithText(`PRIVATE MENTION`);
        }
        else if (visibility == "public" || visibility == "unlisted") {
            if (item.in_reply_to_account_id != null) {
                if (item.in_reply_to_account_id == account.id) {
                    let text = "Replying to self";
                    annotation = Annotation.createWithText(text);
                    annotation.uri = account["url"];
                }
                // "Replying to @X" annotations are intentionally omitted — they were inconsistent across timelines vs.
                // threads vs. mentions. Stashed below in case we revisit.
                /*
				else if (item.mentions != null && item.mentions.length > 0) {
					const mentions = item.mentions;
					const account = mentions[0];
					const userName = account["username"];
					let text = "Replying to @" + userName;
					if (mentions.length > 1) {
						text += " and others";
					}
					annotation = Annotation.createWithText(text);
					annotation.uri = account["url"];
				}
				*/
            }
        }
    }

    if (annotation != null) {
        post.annotations = [annotation];
    }

    const itemEmojis = item["emojis"];
    if (itemEmojis != null && itemEmojis.length > 0) {
        for (const emoji of itemEmojis) {
            shortcodes[emoji.shortcode] = emoji.static_url;
        }
    }

    const accountEmojis = account["emojis"];
    if (accountEmojis != null && accountEmojis.length > 0) {
        for (const emoji of accountEmojis) {
            shortcodes[emoji.shortcode] = emoji.static_url;
        }
    }

    post.shortcodes = shortcodes;

    // Carry visibility/language/content warning so a reply can default to the parent's — Mastodon doesn't inherit
    // any of them server-side. Only an author-written spoiler carries over (a bare `sensitive` flag has no text).
    post.metadata = { id: item.id, visibility: item["visibility"] ?? "public" };
    if (item["language"] != null) { post.metadata.language = item["language"]; }
    if (spoilerText != null && spoilerText.length > 0) { post.metadata.contentWarning = spoilerText; }

    post.actions.add("reply");

    post.actions.add(item?.favourited ? "unfavorite" : "favorite");
    post.actions.add(item?.reblogged ? "unboost" : "boost");
    // Quote only where the instance supports it (Mastodon 4.5+ / API v7). The quoted post's own approval policy may
    // still reject it at send — the server enforces that, surfaced as an error.
    if (quoteCapable) { post.actions.add("quote"); }
    post.actions.add(item?.bookmarked ? "unbookmark" : "bookmark");
    post.actions.add(item?.replies_count > 0 ? "replies" : "thread");

    // Only your own posts can be deleted. `account` is the post's author (a boost was already unwrapped to the
    // original post above), and "userId" is the authenticated account stored during verify/load.
    const myUserId = getItem("userId");
    if (myUserId != null && account?.id == myUserId) {
        post.actions.add("delete");
        post.actions.add("edit");
        // Your own post: fold its mentions/tags into the autocomplete history, dated by the post (remember keeps
        // each value's newest use). This is what seeds the picker from posts you made before this existed or on
        // another client.
        learnFromPost(item);
    }

    let attachments = [];

    const mediaAttachments = item["media_attachments"];
    if (mediaAttachments != null && mediaAttachments.length > 0) {
        for (const mediaAttachment of mediaAttachments) {
            attachments.push(attachmentForMedia(mediaAttachment));
        }
    }

    const quote = item["quote"];
    if (quote != null && quote.quoted_status != null) {
        let attachment = postForItem(quote.quoted_status)
        attachments.push(attachment);
    }

    const card = item["card"];
    if (card != null && card.url != null) {
        let attachment = LinkAttachment.createWithUrl(card.url);
        if (card.type != null && card.type.length > 0) {
            attachment.type = card.type;
        }
        if (card.title != null && card.title.length > 0) {
            attachment.title = card.title;
        }
        if (card.description != null && card.description.length > 0) {
            attachment.subtitle = card.description;
        }
        if (card.author_name != null && card.author_name.length > 0) {
            attachment.authorName = card.author_name;
        }
        if (card.author_url != null && card.author_url.length > 0) {
            attachment.authorProfile = card.author_url;
        }
        if (card.image != null && card.image.length > 0) {
            attachment.image = card.image;
        }
        if (card.blurhash != null && card.blurhash.length > 0) {
            attachment.blurhash = card.blurhash;
        }
        if (card.width != null && card.height != null) {
            attachment.aspectSize = {width : card.width, height: card.height};
        }
        attachments.push(attachment);
    }

    const poll = item["poll"];
    if (poll != null && poll.options != null && poll.expires_at != null) {
        // The own-poll check needs external context (poll author vs. the authenticated user); expired/voted are
        // read off the poll inside fillPollAttachment.
        const notOwnPoll = item.account?.id !== getItem("userId");
        attachments.push(fillPollAttachment(PollAttachment.create(), poll, notOwnPoll));
        // Offer a reload of the results while the poll is still open — its counts can still change. Once it's over,
        // results are final, so no refresh. (A public GET, so this works for the unauthenticated variants too.)
        if (poll.expired !== true) {
            post.actions.add("refresh");
        }
    }

    post.attachments = attachments;

    return post;
}

// One status media_attachment → a media attachment object (url, thumbnail, alt text, blurhash, focus, size, MIME).
// Shared by the read side (postForItem) and the edit seed, which layers the compose-only fields on top.
function attachmentForMedia(mediaAttachment) {
    const attachment = MediaAttachment.createWithUrl(mediaAttachment["url"]);
    if (mediaAttachment["preview_url"] != null) {
        attachment.thumbnail = mediaAttachment["preview_url"];
    }
    if (mediaAttachment["description"] != null) {
        attachment.text = mediaAttachment["description"];
    }
    if (mediaAttachment["blurhash"] != null) {
        attachment.blurhash = mediaAttachment["blurhash"];
    }
    if (mediaAttachment["meta"] != null) {
        const metadata = mediaAttachment["meta"];
        if (metadata["focus"] != null) {
            const focus = metadata["focus"];
            if (focus["x"] != null && focus["y"] != null) {
                attachment.focalPoint = {x : focus["x"], y: focus["y"]};
            }
        }
        if (metadata["original"] != null) {
            const original = metadata["original"];
            if (original["width"] != null && original["height"] != null) {
                attachment.aspectSize = {width : original["width"], height: original["height"]};
            }
        }
    }
    // The service's own type maps straight onto the app's media kinds — the one fact a URL can't supply, since a
    // gifv is a video/mp4 that would otherwise classify as video. An unmapped type (e.g. "unknown") declares
    // nothing, leaving the app's extension fallback to decide. `metadata` is the service id an edit's submit needs
    // to reference the attachment; both ride on EVERY attachment so the ordinary read-side object doubles as an
    // edit seed.
    attachment.mediaType = { image: "image", gifv: "animation", video: "video", audio: "audio" }[mediaAttachment["type"]];
    attachment.metadata = { id: mediaAttachment["id"] };
    return attachment;
}

// Populate a poll attachment from a Mastodon poll object. Shared by the initial item build and the post-vote
// update (the /votes response is itself an updated poll). Notes on the Mastodon shape:
//   - option `id` is the zero-based choice index Mastodon votes by (so the app's vote value is index/indices).
//   - `voters_count` is null for a single-choice poll, so `voters` is only set when present.
//   - `own_votes` is [] (not null) for an authenticated-but-unvoted poll, so `value` is only set when the user
//     actually voted; the app reads a value that matches an option as "already voted".
//   - `action` (the vote affordance) is set only when you can actually cast a vote — not your own poll, not
//     expired, not already voted — AND the connector's actions.json defines "vote". Otherwise the poll renders
//     results-only; a valid `value` is what tells the app it's "voted" (the action isn't needed for that state).
function fillPollAttachment(attachment, poll, notOwnPoll) {
    attachment.options = poll.options.map((option, index) => PollOption.create(option.title, option.votes_count, String(index)));
    attachment.endDate = new Date(poll.expires_at);
    attachment.multipleChoice = poll?.multiple ?? false;
    const canVote = notOwnPoll && poll.expired !== true && poll.voted !== true;
    attachment.action = canVote ? "vote" : undefined;
    attachment.metadata = { id: poll.id };
    if (poll.voters_count != null) {
        attachment.voters = poll.voters_count;
    }
    if (poll.voted === true && Array.isArray(poll.own_votes) && poll.own_votes.length > 0) {
        attachment.value = poll.own_votes.join(",");
    }
    return attachment;
}

// Re-fetch a single status by id and rebuild the item — the worker for the `refresh` (role: "refresh") action, so
// a poll's results (and, eventually, any per-item stats) can be reloaded in place. A public GET, so it works for
// the unauthenticated variants too.
async function refreshItem(id) {
    const status = await fetch(`${site}/api/v1/statuses/${id}`).json();
    return [postForItem(status)];
}

// By being in mastodon-shared.js, all of the mastodon connectors get this.
// However, most actions will not work unless authenticated! So be sure to
// edit the actions.json file for each connector and only include the ones
// that can actually work for the non-authorized connector variants!
// Cached `/api/v2/instance` — the instance's capability sheet (status/media/poll limits, languages, …). Fetch the
// whole record once and read fields as needed. Public endpoint, so it works unauthenticated too. Weekly TTL; on
// failure falls back to the last good cache, else null.
async function getInstance() {
    const TTL = 7 * 24 * 60 * 60 * 1000;   // one week
    const cached = getItem("instance");
    const stored = cached != null ? JSON.parse(cached) : null;
    if (stored != null && Date.now() - stored.fetchedAt < TTL) {
        return stored.record;   // still fresh — no fetch
    }

    try {
        const record = await fetch(`${site}/api/v2/instance`).json();
        setItem("instance", JSON.stringify({ fetchedAt: Date.now(), record }));
        return record;
    } catch (error) {
        console.log(`getInstance fetch failed, using ${stored != null ? "stale cache" : "defaults"}: ${error}`);
        return stored?.record ?? null;
    }
}

// The instance's custom emoji, for `:`-autocomplete. Only picker-visible ones, keyed to their static image. Weekly
// TTL; a failed fetch degrades to stale cache, else an empty list.
async function getCustomEmojis() {
    const TTL = 7 * 24 * 60 * 60 * 1000;   // one week
    const cached = getItem("customEmojis");
    const stored = cached != null ? JSON.parse(cached) : null;
    if (stored != null && Date.now() - stored.fetchedAt < TTL) {
        return stored.shortcodes;   // still fresh — no fetch
    }

    try {
        const emojis = await fetch(`${site}/api/v1/custom_emojis`).json();
        const shortcodes = emojis
            .filter(emoji => emoji.visible_in_picker !== false)
            .map(emoji => ({ shortcode: emoji.shortcode, url: emoji.static_url ?? emoji.url, category: emoji.category }));
        setItem("customEmojis", JSON.stringify({ fetchedAt: Date.now(), shortcodes }));
        return shortcodes;
    } catch (error) {
        console.log(`getCustomEmojis fetch failed, using ${stored != null ? "stale cache" : "none"}: ${error}`);
        return stored?.shortcodes ?? [];
    }
}

// Whether this instance can author quote posts (Mastodon 4.5+ / API v7). Resolved once per load and cached so every
// postForItem offers the quote action consistently. Defaults false.
let quoteCapable = false;

function supportsQuotePosts(instance) {
    return (instance?.api_versions?.mastodon ?? 0) >= 7;
}

// Whether media and a poll can coexist on one post. Mastodon dropped the server-side exclusivity in 4.6.0
// (PR #39203); older instances still reject the pairing, so gate the combined slot on the instance's major.minor
// — parsed from the leading digits of `version` ("4.6.3", "4.6.0-nightly.x", …) so 4.6 pre-releases match too.
function supportsMediaWithPoll(instance) {
    const match = /^(\d+)\.(\d+)/.exec(instance?.version ?? "");
    if (match == null) { return false; }
    const major = +match[1], minor = +match[2];
    return major > 4 || (major == 4 && minor >= 6);
}

// Build a compose draft. `reply` seeds the parent (mentions prefilled, `in_reply_to_id` in metadata); `newPost`
// starts blank; both mint an idempotency key up front and submit through the same `send` verb. `edit` seeds the
// target post's complete current state and submits through `saveEdit` instead — the app never learns it's editing.
async function composeDraft(actionId, target, id) {
    const draft = Draft.create();

    // An edit re-fetches its target up front: /source for the raw editable text (items carry rendered HTML), the
    // status itself for everything else (media ids, poll, quote, flags). Both null for every other compose action.
    const [status, source] = actionId == "edit"
        ? await Promise.all([fetch(`${site}/api/v1/statuses/${id}`).json(), fetch(`${site}/api/v1/statuses/${id}/source`).json()])
        : [null, null];

    if (actionId == "edit") {
        // No idempotency key — that's a create-only header. The `sensitive` flag deliberately does NOT ride along:
        // the app has one concept, the content warning, and saveEdit derives the flag from it (see there).
        draft.metadata = { id: id };
        draft.actions.add("saveEdit");
    } else {
        draft.metadata = { idempotencyKey: crypto.randomUUID() };
        draft.actions.add("send");
    }

    // Character counting matched to the server: the instance's max, URLs weighed as the server does, a mention
    // counting only its "@user". Values from the cached instance record; defaults cover a failed fetch.
    const instance = await getInstance();
    const statuses = instance?.configuration?.statuses;
    const canQuote = supportsQuotePosts(instance);
    const shortcodes = await getCustomEmojis();   // the instance's custom emoji, for `:`-autocomplete
    // Video/gifv limits Mastodon REJECTS over (so decline at INTAKE, not mid-post): its frame-rate cap where the
    // instance reports one, plus MAX_VIDEO_FRAMES (a source constant, not in the config). Size + dimensions are the
    // per-upload concern of fitMedia. A gifv obeys the same video limits.
    const videoLimit = { fps: instance?.configuration?.media_attachments?.video_frame_rate_limit ?? 120, frames: 36000 };
    // Alt-text length cap the server enforces, straight from the instance's config. Newer Mastodon reports 10000
    // (raised from 1500) — instances that don't report it are the older 1500-cap builds, so that's the fallback.
    const altTextLimit = { maxLength: instance?.configuration?.media_attachments?.description_limit ?? 1500 };
    // Poll shape from the instance's config (defaults cover a failed fetch / older builds). The duration presets are
    // the conventional client menu, filtered to the instance's allowed [min, max] expiration so we never offer one the
    // server would reject; the same window backs a free custom end-date pick.
    const pollCfg = instance?.configuration?.polls;
    // Fallbacks are Mastodon's own constants (PollExpirationValidator MIN/MAX_EXPIRATION), not round numbers: the
    // max is Rails' `1.month`, an average Gregorian month of 30.44 days, which is what instances actually report.
    const pollMinExpiration = pollCfg?.min_expiration ?? 300;         // 5 minutes
    const pollMaxExpiration = pollCfg?.max_expiration ?? 2629746;     // 1 month
    // The FIRST preset is the app's default length, so 1 day (Mastodon's own default) leads; the rest follow
    // chronologically (the app re-sorts by length for display). Filtered to the instance's allowed [min, max]. The
    // custom end-date mode inherits this same 1-day default (it declares no `default` of its own).
    const pollPresets = [
        { label: "1 day", seconds: 86400 },
        { label: "5 minutes", seconds: 300 }, { label: "30 minutes", seconds: 1800 },
        { label: "1 hour", seconds: 3600 }, { label: "6 hours", seconds: 21600 },
        { label: "3 days", seconds: 259200 }, { label: "7 days", seconds: 604800 },
    ].filter(preset => preset.seconds >= pollMinExpiration && preset.seconds <= pollMaxExpiration);
    // media + poll on one post only from 4.6 (see supportsMediaWithPoll); older instances keep them exclusive.
    const mediaPollCombos = supportsMediaWithPoll(instance) ? [["media", "poll"]] : [["media"], ["poll"]];
    draft.rules = {
        characterUnit: "graphemes",
        // The main counter's limit (default 500) spans the body AND the content warning — both count against it.
        characterCounter: { fields: ["body", "contentWarning"], characterLimit: { maxLength: statuses?.max_characters ?? 500 } },
        fields: {
            // The body is weighted; the content warning is a plain optional field (its URLs/mentions are NOT weighted).
            body: {
                placeholder: actionId == "reply" ? "Post your reply" : "What's on your mind?",
                weights: {
                    // URL → the reserved weight (23). The trailing class stops the match before sentence punctuation so
                    // it counts naturally, matching the server (twitter-text's URL regex) and erring toward NOT
                    // swallowing real text (an over-long match would undercount).
                    "https?://[^\\s]*[^\\s.,;:!?)\\]}]": statuses?.characters_reserved_per_url ?? 23,
                    // Mention → "@user", the @domain free ($1 is the "@user" part). The lookbehind mirrors the server's
                    // MENTION_RE: an @ glued to a preceding word char (or = or /) is NOT a mention.
                    "(?<![=/\\w])(@\\w+(?:[.-]+\\w+)*)(?:@[\\w.-]+)?": "$1"
                }
            },
            contentWarning: { availability: "optional" }   // opt-in; the user reveals it to add a warning
        },
        attributes: composeAttributes(canQuote, status?.visibility),
        shortcodes: shortcodes,
        // `@` and `#` autocomplete via suggest() (account/hashtag search); `:` emoji is served by `shortcodes` above.
        suggestions: ["@", "#"],
        // Mastodon's real media rules: up to 4 images and animations MIXED (a shared budget of 4), OR one video alone,
        // OR one audio alone — three mutually exclusive options of the one media slot. A poll shares the media
        // combination on 4.6+ (or stands alone on older instances); a quote (when supported) is always its own.
        attachments: {
            slots: {
                media: [{ allow: ["image", "animation"], max: 4 }, { allow: ["video"] }, { allow: ["audio"] }],
                poll: [{ allow: ["poll"] }],
                ...(canQuote ? { quote: [{ allow: ["item"] }] } : {})
            },
            combinations: canQuote ? [...mediaPollCombos, ["quote"]] : mediaPollCombos
        },
        media: { upload: "eager", supportsAltText: ["image", "animation", "video", "audio"], supportsFocusPoint: ["image", "animation"], altTextCharacterLimit: altTextLimit, limits: { video: videoLimit, animation: videoLimit } },
        poll: {
            options: { min: 2, max: pollCfg?.max_options ?? 4, characterLimit: { maxLength: pollCfg?.max_characters_per_option ?? 50 } },
            supportsMultipleChoice: true,   // Mastodon always allows it — no instance gate
            duration: { range: { min: pollMinExpiration, max: pollMaxExpiration }, presets: pollPresets }
        }
    };

    if (actionId == "reply") {
        draft.header = "Reply to " + (target.author?.name ?? target.author?.username ?? "post");
        draft.body = await replyMentionPrefill(id);
        draft.context = [target];
        draft.metadata.replyTo = id;
        // Inherit the parent's visibility/language/content warning where present (best-effort); `send` re-applies the
        // CW as spoiler_text + sensitive.
        if (target?.metadata?.visibility != null) { draft.attributeValues.visibility = target.metadata.visibility; }
        if (target?.metadata?.language != null) { draft.attributeValues.language = target.metadata.language; }
        if (target?.metadata?.contentWarning != null) { draft.contentWarning = target.metadata.contentWarning; }
    } else if (actionId == "quote") {
        // A quote is a new post embedding another: the item shows as a preview attachment, its id rides metadata.
        draft.header = "Quote " + (target.author?.name ?? target.author?.username ?? "post");
        draft.attachments = [target];
        draft.metadata.quotedId = id;
    } else if (actionId == "edit") {
        draft.header = "Edit Post";
        draft.body = source.text ?? "";
        if (source.spoiler_text != null && source.spoiler_text.length > 0) { draft.contentWarning = source.spoiler_text; }
        if (status.language != null) { draft.attributeValues.language = status.language; }
        // The post's current quote policy, read off quote_approval's automatic list ("public" implies anyone;
        // "followers" just them; neither means manual-only, i.e. "nobody" automatically).
        if (canQuote && (status.visibility == "public" || status.visibility == "unlisted")) {
            const automatic = status.quote_approval?.automatic ?? [];
            draft.attributeValues.quotePolicy = automatic.includes("public") ? "public" : (automatic.includes("followers") ? "followers" : "nobody");
        }

        // Seed the attachments by REUSING the ordinary item build: postForItem's media objects already carry
        // everything an edit needs (they're already-hosted — the app renders them remotely and never re-uploads),
        // and a quote's nested item seeds as-is (display-only — an edit can't remove or change a quote). Two
        // adjustments: the link card is dropped (the server regenerates cards itself, and the compose rules
        // declare no slot for one — seeding it would make the draft un-postable), and the read-side poll is
        // rebuilt compose-shaped below (an unchanged poll must still be re-submitted or the server destroys it).
        const attachments = (postForItem(status).attachments ?? []).filter(attachment => attachment.kind != "link" && attachment.kind != "poll");
        const poll = status["poll"];
        if (poll != null && poll.options != null && poll.expires_at != null) {
            const seeded = PollAttachment.create(poll.options.map(option => PollOption.create(option.title)));
            // Mastodon restarts a poll for its length on EVERY edit (its own client behaves this way), so every
            // seed gets a duration and never an end date — a stale endDate would also disable Post on an expired
            // poll, locking even text edits. Under that restart-on-edit norm the current run began at the last
            // edit (or at creation), so its length is expires_at minus that, clamped to the instance's window.
            const runStart = new Date(status.edited_at ?? status.created_at).getTime();
            const runSeconds = Math.round((new Date(poll.expires_at).getTime() - runStart) / 1000);
            seeded.duration = Math.min(Math.max(runSeconds, pollMinExpiration), pollMaxExpiration);
            seeded.multipleChoice = poll.multiple === true;
            seeded.metadata = { id: poll.id };
            attachments.push(seeded);
        }
        draft.attachments = attachments;
    } else {
        draft.header = "New Post";
    }

    return draft;
}

// The setting controls Mastodon offers: visibility, post language, and — only on quote-capable instances (4.5+ /
// API v7) — who may quote. quotePolicy applies only to public/unlisted posts (the server forces private/direct to
// "nobody"), expressed via `availableWhen` and re-guarded in `send`. An edit passes the post's FIXED visibility
// (the edit endpoint can't change it): the visibility chip is omitted, and quotePolicy — which IS editable — is
// then statically present or absent, since an `availableWhen` pointing at an undeclared attribute never unlocks.
function composeAttributes(canQuote, editVisibility) {
    const attributes = [];
    if (editVisibility == null) {
        attributes.push({
            name: "visibility", label: "Visibility", defaultValue: "public",
            choices: [
                { value: "public", label: "Public", description: "Anyone on and off Mastodon", icon: "globe" },
                { value: "unlisted", label: "Quiet public", description: "Hidden from Mastodon search results, trending, and public timelines", icon: "moon" },
                { value: "private", label: "Followers", description: "Only your followers", icon: "lock" },
                { value: "direct", label: "Private mention", description: "Everyone mentioned in the post", icon: "at" }
            ]
        });
    }
    // "Who can quote" is meaningful only where the server understands quotes (Mastodon 4.5+ / API v7); omit it elsewhere.
    if (canQuote && (editVisibility == null || editVisibility == "public" || editVisibility == "unlisted")) {
        const quotePolicy = {
            name: "quotePolicy", label: "Who can quote", defaultValue: "public",
            choices: [
                { value: "public", label: "Anyone", icon: "quote.bubble" },
                { value: "followers", label: "Followers", icon: "person.2" },
                { value: "nobody", label: "Just me", icon: "nosign" }
            ]
        };
        if (editVisibility == null) {
            quotePolicy.availableWhen = { attribute: "visibility", oneOf: ["public", "unlisted"] };
        }
        attributes.push(quotePolicy);
    }
    attributes.push({ name: "language", type: "language" });
    return attributes;
}

// The @-mentions to prefill into a reply: the post's author plus everyone it mentions (Mastodon convention keeps the
// whole thread in the loop), minus yourself, deduped. Fetched fresh so the list is current — and if the fetch fails
// the error cancels the reply, which deliberately covers replying to a since-deleted post. Trailing-spaced, or "".
async function replyMentionPrefill(id) {
    const myUserId = getItem("userId");
    const status = await fetch(`${site}/api/v1/statuses/${id}`).json();
    const participants = [status.account, ...(status.mentions ?? [])];
    const seen = new Set();
    const tokens = [];
    for (const person of participants) {
        if (person?.acct == null || seen.has(person.acct)) { continue; }
        if (myUserId != null && person.id == myUserId) { continue; }
        seen.add(person.acct);
        tokens.push("@" + person.acct);
    }
    return tokens.length > 0 ? tokens.join(" ") + " " : "";
}

// Autocomplete for the `@`/`#` markers: branch on the marker. A bare marker (no query yet) offers your recent-usage
// history instead of a live search, since there's nothing to search on yet.
async function suggest(match) {
    const marker = match[0];
    const query = match.slice(1);   // drop the marker; "" for a bare "@" / "#"
    if (marker === "@") { return await suggestAccounts(query); }
    if (marker === "#") { return await suggestHashtags(query); }
    return [];
}

// Accounts already looked up this session — "@acct" (lowercased) -> { description, image }. Nothing here is ever
// stored; it exists so reopening the popup or typing more of a handle doesn't refetch accounts hydrated moments ago
// (and so an already-shown avatar never flickers away mid-word). An entry whose lookup found nothing still counts as
// looked-up, so a moved/deleted account isn't re-queried on every keystroke.
const profileCache = new Map();

// @-mention autocomplete, one flow for the bare and typed cases: build the row list — your recent mentions first (all
// of them for a bare "@", the prefix matches for a typed query), then live server results from /accounts/search for a
// typed query, deduped (a server hit for an acct already surfaced from history enriches that row's name/avatar rather
// than duplicating it) — then hydrate whatever this session hasn't looked up yet in ONE batch. Your recent mentions
// always lead (in recency order); a partial query never lets a coincidental server match jump the queue, so heading
// for "@gedeonm" isn't hijacked by some "@gedeon" — tap down for that. The bare "@" typically pays the one hydrate
// batch; after that the cache means a keystroke costs just its search call.
//
// The search endpoint's default of NOT resolving unknown handles keeps it to locally known accounts (no per-keystroke
// WebFinger fetch). `acct` is "user" locally or "user@domain" for a remote account — exactly the mention text to insert.
async function suggestAccounts(query) {
    const rows = [];
    const byValue = new Map();
    const idByValue = new Map();   // "@acct" (lowercased) -> account id, for hydrating history rows by id
    const add = row => {
        const key = row.value.toLowerCase();
        const existing = byValue.get(key);
        if (existing == null) { byValue.set(key, row); rows.push(row); }
        else if (existing.image == null && row.image != null) { existing.description = row.description; existing.image = row.image; }
    };

    for (const entry of recent("mentionHistory", query)) {
        const value = "@" + entry.value;
        if (entry.id != null) { idByValue.set(value.toLowerCase(), entry.id); }
        add({ value, ...profileCache.get(value.toLowerCase()) });
    }

    if (query.length > 0) {
        const accounts = await fetch(`${site}/api/v1/accounts/search?q=${encodeURIComponent(query)}`).json();
        for (const account of accounts) {
            const row = { value: "@" + account.acct, description: account.display_name || account.username, image: account.avatar };
            profileCache.set(row.value.toLowerCase(), { description: row.description, image: row.image });
            add(row);
        }
    }

    await hydrateAccounts(rows, idByValue);
    return rows;
}

// Fill the CURRENT name/avatar into any history rows this session hasn't looked up yet (mutating them in place) via
// ONE /api/v1/accounts?id[]= batch — so a changed profile shows immediately, nothing about it is stored, and we don't
// fire a request per row at a shared instance. The slice keeps the batch modest; if a short prefix matches more
// history than that, the overflow rows just show plain for now and hydrate (via the cache) on a later call. An id
// that doesn't come back (moved/deleted) keeps its plain "@acct" row, cached so it isn't asked about again. The batch
// endpoint is Mastodon 4.3+; on an older server it 404s — caught below, and nothing is cached on failure, so a
// transient hiccup retries on the next call. Best-effort: suggest() must never throw.
async function hydrateAccounts(rows, idByValue) {
    const pending = rows.filter(row => idByValue.has(row.value.toLowerCase()) && !profileCache.has(row.value.toLowerCase())).slice(0, HISTORY_SHOW);
    if (pending.length === 0) { return; }
    try {
        const params = pending.map(row => "id[]=" + encodeURIComponent(idByValue.get(row.value.toLowerCase()))).join("&");
        const byId = new Map(((await fetch(`${site}/api/v1/accounts?${params}`).json()) ?? []).map(account => [account.id, account]));
        for (const row of pending) {
            const account = byId.get(idByValue.get(row.value.toLowerCase()));
            if (account?.acct != null) { row.description = account.display_name || account.username; row.image = account.avatar; }
            profileCache.set(row.value.toLowerCase(), { description: row.description, image: row.image });
        }
    } catch (error) {
        // Pre-4.3 instance (no batch endpoint) or a transient failure — leave the plain rows as-is.
    }
}

// Hashtag autocomplete via /api/v2/search?type=hashtags (authenticated). Hashtags carry no image (the composer falls
// back to a symbol). The server's `tag.name` is often LOWERCASED (mastodon.social returns "tapestryapp" for what its
// own web UI shows as "TapestryApp") — because that mixed casing comes from each user's LOCAL tag history, not the
// API. So we do the same: a most-recent-first history of tags YOU'VE posted (with your casing) is merged ahead of the
// server results and deduped case-insensitively, so a tag you use shows with your casing. See learnFromPost.
// The API's tag.history gives recent-usage counts, surfaced as each row's description line (keyed by lowercased name,
// so a history-cased tag still picks up the server's count); history-only tags with no API match show no count. A bare
// "#" has nothing to search, so it offers your recent tags alone.
async function suggestHashtags(query) {
    if (query.length === 0) { return recent("tagHistory", "").map(entry => ({ value: "#" + entry.value })); }
    const results = await fetch(`${site}/api/v2/search?q=${encodeURIComponent(query)}&type=hashtags`).json();
    const history = recent("tagHistory", query).map(entry => entry.value);
    const seen = new Set(history.map(tag => tag.toLowerCase()));
    const names = [...history];
    const descriptions = new Map();
    for (const tag of (results.hashtags ?? [])) {
        descriptions.set(tag.name.toLowerCase(), usageDescription(tag));
        if (!seen.has(tag.name.toLowerCase())) { seen.add(tag.name.toLowerCase()); names.push(tag.name); }
    }
    return names.map(name => {
        const description = descriptions.get(name.toLowerCase());
        return description ? { value: "#" + name, description } : { value: "#" + name };
    });
}

// A hashtag's recent activity as a short row description — the exact total posts across the ~7 daily buckets in
// tag.history (uses arrives as a string), digit-grouped for the user's locale via toLocaleString (JSC's Intl gives
// 1,234,567 / 1.234.567 / 12,34,567 as appropriate). Undefined when the API reports no activity, so the row omits the line.
function usageDescription(tag) {
    const total = (tag.history ?? []).reduce((sum, day) => sum + (Number(day.uses) || 0), 0);
    if (total === 0) { return undefined; }
    return `${total.toLocaleString()} recent ${total === 1 ? "post" : "posts"}`;
}

// The bare hashtag names in some text, preserving the author's casing. The lookbehind keeps a "#" that begins a word
// (matching the composer's own tokenizing) while skipping a "#" mid-URL like example.com/#frag.
function hashtagsIn(text) {
    return [...(text ?? "").matchAll(/(?<![^\s])[#＃]([\p{L}\p{N}_]+)/gu)].map(match => match[1]);
}

// Learn the mentions and hashtags in one of YOUR OWN posts (the caller gates on authorship), dated by the post —
// edited_at when present, so an edit counts as a fresh use (which also dates the send/saveEdit feeders correctly:
// the status they pass was just created or edited, so its date IS "now"). Mentions come from the structured
// `mentions` list because its `acct` carries the full user@domain a remote handle needs and its `id` lets the
// bare-"@" popup batch-hydrate the avatar; hashtags are read from the rendered text with tags stripped, so they keep
// the casing you typed rather than the API's lowercased `tags[].name`.
function learnFromPost(status) {
    const date = new Date(status.edited_at ?? status.created_at ?? 0).getTime() || 0;
    remember("mentionHistory", (status.mentions ?? []).map(mention => ({ value: mention.acct, id: mention.id, date })));
    remember("tagHistory", hashtagsIn((status.content ?? "").replace(/<[^>]+>/g, "")).map(tag => ({ value: tag, date })));
}

// Fit + upload one attachment's bytes to /v2/media, returning its { id }. POST /v2/media returns 200 for images
// (synchronous) or 202 for video/gifv/audio still processing — then GET /v1/media/:id returns 206 while processing,
// 200 when ready, so poll() waits for the 200. Alt text / focus are NOT set here (they stay editable until posting);
// `send` applies them at submit.
async function uploadMedia(file, kind) {
    const fitted = await fitMedia(file, kind);
    const media = await fetch.post(`${site}/api/v2/media`, { multipart: [{ name: "file", file: fitted }] }).json();
    await poll(async () => (await fetch(`${site}/api/v1/media/${media.id}`).response()).status === 200);
    return { id: media.id, file: fitted };
}

// Fit picked bytes to what Mastodon accepts for their kind. Limits come from the instance's reported configuration
// where present, falling back to Mastodon's own source-code defaults (media_attachment.rb) as the floor when it
// didn't report them. Video and animation both go up as MP4 — an animation is a SILENT MP4, which Mastodon serves
// back as a looping gifv.
async function fitMedia(file, kind) {
    const m = (await getInstance())?.configuration?.media_attachments ?? {};
    if (kind == "image") { return imageTransform(file, ["jpeg", "png"], { maxBytes: m.image_size_limit ?? 16777216, maxPixels: 4096 }); }
    if (kind == "audio") { return audioTransform(file, ["m4a"], { maxBytes: m.video_size_limit ?? 103809024 }); }
    // Mastodon REJECTS a video that exceeds its pixel-matrix (DimensionsValidationError — it does NOT downscale), so we
    // must cap dimensions, not just size: hand the transform the byte budget (video_size_limit) and the longest-edge cap
    // for the matrix (video_matrix_limit is a width×height total, so √ it to stay under for any aspect ratio) and resize.
    const maxBytes = m.video_size_limit ?? 103809024;                           // 99 MiB (media_attachment.rb VIDEO_LIMIT)
    const maxPixels = Math.floor(Math.sqrt(m.video_matrix_limit ?? 8294400));   // matrix (w×h, 4K default) → longest edge
    if (kind == "video") { return videoTransform(file, ["mp4"], { maxBytes, maxPixels }); }
    // Animation → always mp4 (a silent H.264 that Mastodon serves back as a looping gifv), never gif. Mastodon transcodes
    // every uploaded gif to gifv anyway, so keeping it a gif gains the viewer nothing — and a gif is bigger on the wire
    // AND, as image/gif, bounded by the tighter IMAGE limit, where an mp4 (video) gets the full video_size_limit. So mp4
    // is the smaller, faster upload with the larger byte budget. A source that's already a silent mp4 is preserved as-is.
    if (kind == "animation") { return animationTransform(file, ["mp4"], { maxBytes, maxPixels }); }
    throw new Error(`Can't upload media of kind "${kind}"`);
}

// Pre-upload one attachment during compose; return its server ref. `attachedAs` is the media kind — `fitMedia`
// dispatches on it.
async function uploadAttachment(file, attachedAs) {
    const uploaded = await uploadMedia(file, attachedAs);
    return UploadedAsset.create(uploaded.file, { id: uploaded.id });
}

// Apply alt text + focal point at submit, from the final edited values. Mastodon has no media_attributes on status
// CREATE (edit-only), so it's a PUT /v1/media/:id on the uploaded media.
async function updateMediaMetadata(id, description, focus) {
    await fetch(`${site}/api/v1/media/${id}`, { method: "PUT", json: { description: description, focus: focus } });
}

// The `poll` parameter both status verbs send, or undefined when the draft carries no poll. A poll rides in the draft
// attachments as the same {kind:"poll"} object the read side emits, carrying the length the user chose as `duration`
// in seconds — which is `expires_in` directly. Options are the non-empty titles in order (blank/duplicate options are
// the server's to reject, not ours to strip beyond emptiness).
function pollParamsForDraft(draft) {
    const attachment = (draft.attachments ?? []).find(a => a.kind == "poll");
    if (attachment == null) { return undefined; }
    return {
        options: attachment.options.map(option => option.title).filter(title => title.length > 0),
        expires_in: attachment.duration,
        multiple: attachment.multipleChoice === true,
    };
}

async function performAction(actionId, target, actionValue) {
    // Status id lives on item.metadata; older items stored it as the action value — fall back for those.
    // `target` is null for a feed-targeted action (newPost) — the `?.` keeps that from throwing here.
    const id = target?.metadata?.id ?? actionValue;

    // A fast unboost -> boost can 422 with "Reblog of post already exists": the unreblog's removal is processed
    // asynchronously server-side, and the re-reblog trips the uniqueness check against the not-yet-deleted row.
    // Deliberately NOT handled: treating it as success would disagree with the server's final (unboosted) state,
    // and there's no timer surface to retry with. Surfacing the error is honest; a human retry succeeds.
    if (actionId == "favorite") {
        await fetch.post(`${site}/api/v1/statuses/${id}/favourite`);
        target.actions.delete("favorite");
        target.actions.add("unfavorite");
        return target;
    }
    else if (actionId == "unfavorite") {
        await fetch.post(`${site}/api/v1/statuses/${id}/unfavourite`);
        target.actions.delete("unfavorite");
        target.actions.add("favorite");
        return target;
    }
    else if (actionId == "boost") {
        await fetch.post(`${site}/api/v1/statuses/${id}/reblog`);
        target.actions.delete("boost");
        target.actions.add("unboost");
        return target;
    }
    else if (actionId == "unboost") {
        await fetch.post(`${site}/api/v1/statuses/${id}/unreblog`);
        target.actions.delete("unboost");
        target.actions.add("boost");
        return target;
    }
    else if (actionId == "bookmark") {
        await fetch.post(`${site}/api/v1/statuses/${id}/bookmark`);
        target.actions.delete("bookmark");
        target.actions.add("unbookmark");
        return target;
    }
    else if (actionId == "unbookmark") {
        await fetch.post(`${site}/api/v1/statuses/${id}/unbookmark`);
        target.actions.delete("unbookmark");
        target.actions.add("bookmark");
        return target;
    }
    else if (actionId == "thread" || actionId == "replies") {
        // Thread posts are quotable too — resolve the capability here so quote appears in a thread view even if this
        // context hasn't run load() (postForItem reads `quoteCapable`). getInstance() is cached, so this is cheap.
        quoteCapable = supportsQuotePosts(await getInstance());
        const context = await fetch(`${site}/api/v1/statuses/${id}/context`).json();
        let results = [];
        // `item` here is a raw Mastodon status from the API (as postForItem expects); `target` is our Item.
        for (const item of context["ancestors"]) {
            results.push(postForItem(item));
        }
        // Fetch the target fresh rather than echoing `target` back: the echo is frozen at tap time, so a
        // vote or state change made while the thread is open would revert when the thread reloads. The
        // /context endpoint doesn't include the status itself, hence the extra request.
        const status = await fetch(`${site}/api/v1/statuses/${id}`).json();
        results.push(postForItem(status));
        for (const item of context["descendants"]) {
            results.push(postForItem(item));
        }
        return results;
    }
    else if (actionId == "delete") {
        await fetch.delete(`${site}/api/v1/statuses/${id}`);
        return [Item.delete(target.uri)];
    }
    else if (actionId == "refresh") {
        // Reload this item in place (currently surfaced on open polls to refresh results). `id` is the status id.
        return refreshItem(id);
    }
    else if (actionId == "vote") {
        // `target` is the item; the poll rides in its attachments and `actionValue` is the chosen option index
        // (or comma-joined indices for a multiple-choice poll) the app collected. Mastodon votes by zero-based
        // choice index and returns the updated poll, which we reflect back onto the attachment before returning.
        const poll = (target.attachments ?? []).find(a => a.kind == "poll");
        if (poll == null) {
            throw new Error("There is no poll to vote in.");
        }
        const choices = actionValue.split(",").filter(s => s.length > 0).map(s => parseInt(s, 10));
        const updated = await fetch.post(`${site}/api/v1/polls/${poll.metadata.id}/votes`, { json: { choices: choices } }).json();
        // notOwnPoll:true (you just voted, so it isn't yours). The response has voted:true, so fillPollAttachment
        // clears the vote action and populates `value` — the app shows the voted confirmation from `value` alone.
        fillPollAttachment(poll, updated, true);
        return target;
    }
    else if (actionId == "reply" || actionId == "newPost" || actionId == "quote" || actionId == "edit") {
        return composeDraft(actionId, target, id);
    }
    else if (actionId == "send") {
        // Here `target` is the draft. Create the status and return the new item.
        const draft = target;
        const attributes = draft.attributeValues ?? {};
        const contentWarning = draft.contentWarning;   // a first-class content field, not an attribute
        const hasContentWarning = contentWarning != null && contentWarning.length > 0;
        const visibility = attributes.visibility;

        // Resolve each attached media to a server id, then reference the ids on the status. A failed upload throws,
        // failing the whole post.
        const mediaAttachments = (draft.attachments ?? []).filter(a => a.kind == "media");
        const mediaIds = [];
        for (const attachment of mediaAttachments) {
            // Reference the ref if the media was pre-uploaded; otherwise upload its bytes now.
            const id = attachment.metadata?.id ?? (await uploadMedia(attachment.file, attachment.mediaType)).id;
            // Apply the FINAL alt text / focal point now, at submit (see updateMediaMetadata).
            const point = attachment.focalPoint;
            const focus = point ? `${point.x},${point.y}` : undefined;
            if (attachment.text || focus) { await updateMediaMetadata(id, attachment.text, focus); }
            mediaIds.push(id);
        }

        // Media + poll coexist only on 4.6+, but the compose rules already gate that pairing.
        const poll = pollParamsForDraft(draft);

        const body = {
            status: draft.body,
            in_reply_to_id: draft.metadata?.replyTo,
            quoted_status_id: draft.metadata?.quotedId,
            visibility: visibility,
            language: attributes.language,
            media_ids: mediaIds.length > 0 ? mediaIds : undefined,
            poll: poll,
            spoiler_text: hasContentWarning ? contentWarning : undefined,
            sensitive: hasContentWarning ? true : undefined,
            // The server ignores the quote policy for followers-only/direct posts, so only send it when it applies.
            quote_approval_policy: (visibility == null || visibility == "public" || visibility == "unlisted") ? attributes.quotePolicy : undefined
        };
        const headers = {
            "Idempotency-Key": draft.metadata?.idempotencyKey ?? crypto.randomUUID(),
        };
        const status = await fetch.post(`${site}/api/v1/statuses`, { json: body, headers: headers }).json();
        learnFromPost(status);   // fold the mentions/tags you just used into the autocomplete history
        return [postForItem(status)];
    }
    else if (actionId == "saveEdit") {
        // Here `target` is the draft `edit` seeded, carrying its target's id in metadata. Mastodon takes the post's
        // COMPLETE final state and works out the mutations itself, so this sends the draft as-is — no diffing.
        const draft = target;
        const attributes = draft.attributeValues ?? {};
        const contentWarning = draft.contentWarning;
        const hasContentWarning = contentWarning != null && contentWarning.length > 0;

        // The final media set in draft order — order IS post order. A seeded attachment already carries its service
        // ref; a freshly picked one was pre-uploaded during compose (uploaded here only if that somehow didn't run).
        // Alt text and focus go in band as media_attributes[] rather than the create path's PUT /v1/media/:id, which
        // 404s for media already attached to a post. The server resolves the final media set FIRST, applies these
        // against it, and only then attaches — so media arriving for the first time in this very request takes its
        // description here too, with no per-attachment branch. Both fields go on every attachment unconditionally:
        // the server updates only the keys it's given, so an omitted description would leave a cleared one standing
        // (and a cleared focal point is dead-center "0,0", which is what unset means anyway).
        const mediaIds = [];
        const mediaAttributes = [];
        for (const attachment of (draft.attachments ?? []).filter(a => a.kind == "media")) {
            const id = attachment.metadata?.id ?? (await uploadMedia(attachment.file, attachment.mediaType)).id;
            const point = attachment.focalPoint;
            mediaIds.push(id);
            mediaAttributes.push({ id: id, description: attachment.text ?? "", focus: point ? `${point.x},${point.y}` : "0,0" });
        }

        // Every key below is sent even when empty, because the server acts on a parameter only when its key is
        // PRESENT: an omitted media_ids/spoiler_text/poll means "leave this alone", not "the user removed it". An
        // explicitly null poll is how a removal reaches the server. `sensitive` tracks the content warning and
        // nothing else — the app has a single concept, and the read side turns a bare flag INTO a warning, so a
        // preserved flag would leave a "Sensitive content" warning the composer never shows and can't clear.
        // Mastodon's own client ties the two the same way whenever a post has media. No Idempotency-Key
        // (create-only), no visibility, and no quoted_status_id: the edit endpoint accepts none of the three.
        const body = {
            status: draft.body,
            language: attributes.language,
            media_ids: mediaIds,
            media_attributes: mediaAttributes,
            poll: pollParamsForDraft(draft) ?? null,
            spoiler_text: hasContentWarning ? contentWarning : "",
            sensitive: hasContentWarning,
            quote_approval_policy: attributes.quotePolicy
        };
        const status = await fetch(`${site}/api/v1/statuses/${draft.metadata?.id}`, { method: "PUT", json: body }).json();
        learnFromPost(status);
        // The edited post is already in the catalog, so this updates it in place rather than adding a new item.
        return [postForItem(status)];
    }
    else {
        throw new Error(`actionId "${actionId}" not implemented`);
    }
}

