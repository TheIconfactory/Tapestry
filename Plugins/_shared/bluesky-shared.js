
// social.bsky - shared

// The synced @/# usage history (remember/recent/HISTORY_*) lives in its own shared resource.
if (require('suggest-history.js') === false) {
    throw new Error("Failed to load suggest-history.js");
}

const uriPrefix = "https://bsky.app";
const uriPrefixContent = "https://cdn.bsky.app";
const uriPrefixVideo = "https://video.bsky.app";
const videoServiceDid = "did:web:video.bsky.app";

async function getSessionDid() {
    const jsonObject = await fetch(site + "/xrpc/com.atproto.server.getSession").json();
    const did = jsonObject.did;
    return did;
}

async function getAccountDid(account) {
    const jsonObject = await fetch(`${site}/xrpc/app.bsky.actor.getProfile?actor=${account}`).json();
    const did = jsonObject.did;
    return did;
}

async function getFeedInfo(did, feedId) {
    const jsonObject = await fetch(`${site}/xrpc/app.bsky.feed.getFeedGenerator?feed=at://${did}/app.bsky.feed.generator/${feedId}`).json();
    const feedName = jsonObject.view.displayName;
    const avatar = jsonObject.view.avatar;
    return [feedName, avatar];
}

// Hydrates posts to full views (viewer state, counts, resolved embeds), keyed by uri. `getPosts` takes at most
// 25 uris per call, and the AppView silently drops any it can't serve (deleted, blocked, taken down), so a uri
// may have no entry. This is the same batch the official client runs behind its notifications tab: a
// notification carries only the bare record, so anything that needs viewer state — the like/repost toggles,
// the reply count — has to come from here.
async function postViewsForUris(uris) {
    const unique = [...new Set(uris)];
    const chunks = [];
    for (let i = 0; i < unique.length; i += 25) { chunks.push(unique.slice(i, i + 25)); }
    const pages = await Promise.all(chunks.map((chunk) => fetch(`${site}/xrpc/app.bsky.feed.getPosts?uris=${chunk.map(encodeURIComponent).join("&uris=")}`).json()));
    const views = new Map();
    for (const page of pages) {
        for (const view of page.posts ?? []) { views.set(view.uri, view); }
    }
    return views;
}

function normalizeAccount(account) {
    let result = account.trim();
    if (result.length > 1 && result.startsWith("@")) {
        result = result.slice(1);
    }
    return result;
}

// Bluesky handles are domains, so we can only shorten the default "*.bsky.social" ones by dropping that
// suffix. Custom-domain handles (e.g. "sean.foo") are left whole. Used for feed names; the full handle is
// kept elsewhere (e.g. accountIdentity) when disambiguation still matters.
function shortHandle(handle) {
    return handle.replace(/\.bsky\.social$/, "");
}

function parentsForItem(item, includeActions) {
    let results = [];
    if (item.parent != null) {
        parentPostForItem(item.parent, includeActions, results);
    }
    return results;
}

function parentPostForItem(item, includeActions, results) {
    if (item.parent != null) {
        parentPostForItem(item.parent, includeActions, results);
    }

    // A thread node is a union: only `#threadViewPost` has a `post`; `#notFoundPost` / `#blockedPost` carry a bare uri.
    if (item.post == null) {
        return;
    }

    const post = postForItem(item, includeActions);
    if (post != null) {
        results.push(post);
    }
}

function postForItem(item, includeActions = false, dateOverride = null, allowRepliesFromOthers = true) {
    // Bluesky places a post at the EARLIER of when the server indexed it and the `createdAt` its author claims —
    // its own `sortAt` rule, reproduced here rather than taking `indexedAt` alone. Editing a post re-creates the
    // record (see `saveEdit`), so `indexedAt` would drag an edited post to the top of the timeline while the
    // network itself leaves it exactly where it was; `createdAt` alone would let a future-dated post pin itself
    // there forever.
    const indexedAt = new Date(item.post.indexedAt);
    const createdAt = new Date(item.post.record?.createdAt ?? item.post.indexedAt);
    let date = dateOverride ?? (createdAt < indexedAt ? createdAt : indexedAt);

    const author = item.post.author;
    
    const identity = identityForAccount(author);
    
    const inReplyToRecord = item.reply && item.reply.record
    const reason = item.reason
    const record = item.post.record;
    
    if (item.reply != null) {
        if (! allowRepliesFromOthers) {
            // `reply.parent` is the same post/notFound/blocked union, and a blocked author carries no `viewer`.
            if (item.reply.parent?.author?.viewer?.following == null) {
                return null;
            }
        }
    }
            
    let content = contentForRecord(item.post.record);
        
    let metadata = { uri: item.post.uri, cid: item.post.cid };
    // Capture the thread root so a reply can set both `parent` (this post) and `root`. A top-level post is its own
    // root; a reply's root comes from the feed item's reply ref (fall back to this post if it's missing/blocked).
    // Posts built from a thread response have no feed-level reply ref at all, so fall back to the post record's own
    // reply ref — without it every post in a thread would claim to be its own root and mis-thread a reply.
    const replyRoot = item.reply?.root ?? item.post.record?.reply?.root;
    if (replyRoot?.uri != null && replyRoot?.cid != null) {
        metadata.rootUri = replyRoot.uri;
        metadata.rootCid = replyRoot.cid;
    } else {
        metadata.rootUri = item.post.uri;
        metadata.rootCid = item.post.cid;
    }
    // Carry the post's primary language so a reply can prefill it (the server won't inherit it).
    if (item.post.record?.langs?.[0] != null) { metadata.language = item.post.record.langs[0]; }
    let actions = [];
    if (includeActions) {
        actions.push("reply");
        if (item.post.viewer?.like != null) {
            metadata.likeRkey = item.post.viewer.like.split("/").pop();
            actions.push("unlike");
        }
        else {
            actions.push("like");
        }
        if (item.post.viewer?.repost != null) {
            metadata.repostRkey = item.post.viewer.repost.split("/").pop();
            actions.push("unrepost");
        }
        else {
            actions.push("repost");
        }
        // Bluesky always supports quoting (the target post's own postgate may still reject it — the server enforces
        // that at send, surfaced as an error). Grouped with repost/unrepost so they share one cell button.
        actions.push("quote");
        // A null `bookmarked` means the viewer state simply isn't loaded (a fresh post, or an eventually-consistent
        // first fetch right after posting), NOT that bookmarking is forbidden — there's no bookmark-disabled signal in
        // the lexicon, and the only thing that can't be bookmarked is a non-post record, which a timeline item never is.
        // So treat unknown as "not bookmarked" and offer to save, the way Mastodon does.
        actions.push(item.post.viewer?.bookmarked === true ? "unsave" : "save");
        // Only your own posts can be edited or deleted. "didSelf" is the authenticated account's DID, stored at login.
        const didSelf = getItem("didSelf");
        if (didSelf != null && author.did == didSelf) {
            actions.push("edit");
            actions.push("delete");
            // Your own post: fold its mentions/tags into the autocomplete history, dated by the post (remember keeps
            // each value's newest use). This is what seeds the picker from posts you made before this existed or on
            // another client.
            learnFromText(item.post.record?.text ?? "", new Date(item.post.indexedAt ?? 0).getTime() || 0);
        }
    }
    actions.push(item.post?.replyCount > 0 ? "replies" : "thread");

    let contentWarning = null;
    if (item.post.labels != null && item.post.labels.length > 0) {
        const labels = item.post.labels.map((label) => { return label?.val ?? "" }).join(", ");
        contentWarning = `Labeled: ${labels}`;
    }
    
    let annotations = [];

    if (item.reply != null) {
        const replyAnnotation = annotationForReply(item);
        if (replyAnnotation != null) {
            annotations.push(replyAnnotation);
        }
    }

    // A reply for filtering purposes has a parent by a DIFFERENT author — a self-thread continuation doesn't count.
    const isReply = item.reply?.parent != null && item.post.author.handle != item.reply.parent?.author?.handle;
    const isRepost = item.reason != null && item.reason.$type == "app.bsky.feed.defs#reasonRepost";

    if (isRepost) {
        if (item.reason.indexedAt != null) {
            date = new Date(item.reason.indexedAt);
        }
        // The repost annotation leads: it explains why the post is in the timeline at all. The reply annotation
        // (linking the parent's author) is the only remaining reply context — the parent's text is deliberately
        // NOT blockquoted into the body anymore, because body must be identical however the post is fetched
        // (timeline, thread, action echo) or reimports rewrite it; the thread itself is one tap away.
        const repostAnnotation = annotationForRepost(item.reason);
        if (repostAnnotation != null) {
            annotations.unshift(repostAnnotation);
        }
    }

    let showItem = true;
    if (includeReposts != "on") {
        if (isRepost) {
            showItem = false;
        }
    }
    if (includeReplies != "on") {
        if (isReply && !isRepost) { // show replies only if they are not reposted
            showItem = false;
        }
    }
    if (includeQuotes != "on") {
        if (item.post.embed?.$type?.startsWith("app.bsky.embed.record")) {
            showItem = false;
        }
    }

    if (showItem) {
        let attachments = attachmentsForEmbed(item.post.embed);
                
        const itemIdentifier = item.post.uri.split("/").pop();
        const postUri = uriPrefix + "/profile/" + author.handle + "/post/" + itemIdentifier;
        
        const post = Item.createWithUriDate(postUri, date);
        post.body = content;
        post.author = identity;
        post.metadata = metadata;
        for (const action of actions) {
            post.actions.add(action);
        }
        if (attachments != null) {
            post.attachments = attachments
        }
        if (annotations.length > 0) {
            post.annotations = annotations;
        }
        if (contentWarning != null) {
            post.contentWarning = contentWarning;
        }
        
        return post;
    }
    
    return null;
}

function postForEmbeddedRecord(record) {
    if (record == null || record.author?.handle == null) {
        return null;
    }

    const date = new Date(record.indexedAt);
    const identity = identityForAccount(record.author);
    const content = contentForRecord(record.value);
    const attachments = attachmentsForEmbed(record.embeds?.[0]);

    const itemIdentifier = record.uri.split("/").pop();
    const postUri = uriPrefix + "/profile/" + record.author.handle + "/post/" + itemIdentifier;

    const post = Item.createWithUriDate(postUri, date);
    post.body = content;
    post.author = identity;
    if (attachments != null) {
        post.attachments = attachments;
    }
    if (record.labels != null && record.labels.length > 0) {
        const labels = record.labels.map((label) => { return label?.val ?? "" }).join(", ");
        post.contentWarning = `Labeled: ${labels}`;
    }
    // A quoted post is a `viewRecord`, which carries counts but no `viewer` state — so there's no way to tell whether
    // you've already liked or reposted it, nor to undo either without the record keys that state supplies. Give it
    // only what opening its thread needs; `performAction` rebuilds the post from the thread response, where the
    // viewer state is authoritative, so the full action set arrives there rather than being guessed at here.
    post.metadata = { uri: record.uri, cid: record.cid };
    post.actions.add(record.replyCount > 0 ? "replies" : "thread");

    return post;
}

function identityForAccount(account) {
    const name = displayNameForAccount(account);
    if (name == null) {
        return null;
    }
    
    const authorUri = uriPrefix + "/profile/" + account.handle;
    const identity = Identity.createWithName(name);
    identity.username = "@" + account.handle;
    identity.uri = authorUri;
    if (account.avatar != null) {
        identity.avatar = account.avatar;
    }
    
    return identity;
}

function contentForAccount(account, prefix = "") {
    const name = nameForAccount(account);
    if (name == null) {
        return "";
    }

    const authorUri = uriPrefix + "/profile/" + account.handle;
    
    return `<p>${prefix}<a href="${authorUri}">${name}</a></p>`;
}

// Contextual name for annotations ("Reposted by you", "In reply to you") — reads as "you" when the account is the
// authenticated user, like Mastodon's "Boosted by you". The author byline uses displayNameForAccount instead, so your
// own posts are still bylined with your real name.
function nameForAccount(account) {
    const did = getItem("didSelf");
    if (account?.did != null && did != null && did == account.did) {
        return "you";
    }

    return displayNameForAccount(account);
}

function displayNameForAccount(account) {
    if (account == null || account.handle == null) {
        return null;
    }

    if (account.displayName != null && account.displayName.length > 0) {
        return account.displayName;
    }
    else {
        return account.handle;
    }
}

function handleForAccount(account) {
    if (account == null || account.handle == null) {
        return null;
    }

    return "@" + account.handle;
}

function uriForAccount(account) {
    if (account == null || account.handle == null) {
        return null;
    }

    return uriPrefix + "/profile/" + account.handle;

}

function annotationForRepost(reason) {
    let annotation = null;

    if (reason != null && reason.$type == "app.bsky.feed.defs#reasonRepost") {
        let name = nameForAccount(reason.by);
        if (name != null) {
            const text = `Reposted by ${name}`;
            annotation = Annotation.createWithText(text);
            annotation.uri = uriForAccount(reason.by);
        }
    }
    
    return annotation;
}

function annotationForReply(item) {
    let annotation = null;

    if (item.reply != null && item.reply.parent != null) {
        if (item.post.author.handle == item.reply.parent.author?.handle) {
            const text = "Replying to self";
            annotation = Annotation.createWithText(text);
            annotation.uri = uriForAccount(item.post.author);
        }
        else {
            let name = nameForAccount(item.reply.parent.author);
            if (name != null) {
                const text = `In reply to ${name}`;
                annotation = Annotation.createWithText(text);
                annotation.uri = uriForAccount(item.reply.parent.author);
            }
        }
    }
    
    return annotation;
}

// Bluesky has no GIF embed type — the GIF picker posts an external link card pointing at the GIF host, and clients
// that want inline playback sniff the URL. As crazy as that sounds, it's the authoritative mechanism: the official
// client does exactly this in bluesky-social/social-app src/lib/strings/embed-player.ts, and everything here
// (the host list, the hh/ww gate, the CDN rewrites) mirrors that file. Recognize the hosts it special-cases
// (Tenor and Klipy) by the picker's hh/ww dimension params and rewrite to the silent mp4 rendition on Bluesky's
// gifs.bsky.app CDN, which is ~10x smaller than the GIF. If the rewrite ingredients are missing (their URL format
// drifted), fall back to the raw GIF so the post still shows media at GIF bandwidth. Returns null for anything
// else → link card.
function animationForGifExternal(external) {
    // Parsed by hand — connector JS runs in bare JavaScriptCore, which has no WHATWG URL/URLSearchParams.
    const urlMatch = /^https:\/\/([^/?#]+)([^?#]*)(?:\?([^#]*))?/.exec(external.uri ?? "");
    if (urlMatch == null) {
        return null;
    }
    const hostname = urlMatch[1];
    const pathname = urlMatch[2];
    const params = {};
    for (const pair of (urlMatch[3] ?? "").split("&")) {
        const eq = pair.indexOf("=");
        if (eq > 0) {
            params[pair.slice(0, eq)] = pair.slice(eq + 1);
        }
    }

    const isTenor = (hostname == "media.tenor.com");
    const isKlipy = (hostname == "static.klipy.com" && pathname.startsWith("/ii/"));
    if (!isTenor && !isKlipy) {
        return null;
    }

    const width = Number(params.ww);
    const height = Number(params.hh);
    if (!(width > 0) || !(height > 0)) {
        return null;
    }

    let media = null;
    if (isTenor) {
        // Tenor encodes the rendition in the ID path segment: AAAAC = gif, AAAP1 = mp4.
        const [, id, filename] = pathname.split("/");
        if (id != null && id.includes("AAAAC") && filename != null && filename.endsWith(".gif")) {
            media = `https://t.gifs.bsky.app/${id.replace("AAAAC", "AAAP1")}/${filename.replace(".gif", ".mp4")}`;
        }
    }
    else {
        // Klipy embeds a per-format filename slug as an mp4 query param at compose time.
        const slug = params.mp4;
        if (slug != null && slug.length > 0) {
            const parts = pathname.split("/");
            parts[parts.length - 1] = `${slug}.mp4`;
            media = `https://k.gifs.bsky.app${parts.join("/")}`;
        }
    }

    if (media == null) {
        if (!pathname.endsWith(".gif")) {
            return null;
        }
        console.log(`GIF embed mp4 rewrite failed, falling back to raw GIF: ${external.uri}`);
        media = external.uri;
    }

    const attachment = MediaAttachment.createWithUrl(media);
    attachment.aspectSize = { width: width, height: height };
    // The picker prefixes the user's alt text onto the card description.
    if (external.description != null && external.description.startsWith("Alt: ")) {
        attachment.text = external.description.slice(5);
    }
    attachment.mediaType = "animation";
    return attachment;
}

function attachmentsForEmbed(embed, did = null) {
    let attachments = null;
    
    if (embed != null) {
        if (embed.$type.startsWith("app.bsky.embed.images") || embed.$type.startsWith("app.bsky.embed.gallery")) {
            const images = embed.images ?? embed.items;   // `images` embed (<=4) and `gallery` (5-20) share the item shape
            if (images != null) {
                attachments = []
                let count = images.length;
                for (let index = 0; index < count; index++) {
                    let image = images[index];
                    const isBlob = (image.image?.$type == "blob");
                    let media = null;
                    if (isBlob) {
                        if (did != null && image.image?.ref?.$link != null) {
                            const ref = image.image.ref.$link;
                            const suffix = image.image.mimeType?.split("/")[1] ?? "";
                            media = `${uriPrefixContent}/img/feed_fullsize/plain/${did}/${ref}@${suffix}`;
                        }
                    }
                    else {
                        media = image.fullsize;
                    }
                    if (media != null) {
                        const attachment = MediaAttachment.createWithUrl(media);
                        if (image.aspectRatio != null) {
                            attachment.aspectSize = image.aspectRatio;
                        }
                        if (image.alt != null && image.alt.length != 0) {
                            attachment.text = image.alt;
                        }
                        if (isBlob) {
                            if (did != null && image.image?.ref?.$link != null) {
                                const ref = image.image.ref.$link;
                                const suffix = image.image.mimeType?.split("/")[1] ?? "";
                                attachment.thumbnail = `${uriPrefixContent}/img/feed_thumbnail/plain/${did}/${ref}@${suffix}`;
                            }
                        }
                        else {
                            const thumb = image.thumb ?? image.thumbnail;   // images view uses `thumb`; gallery view uses `thumbnail`
                            if (thumb) {
                                attachment.thumbnail = thumb;
                            }
                        }
                        attachment.mediaType = "image";
                        attachments.push(attachment);
                    }
                }
            }
        }
        else if (embed.$type.startsWith("app.bsky.embed.video")) {
            const isBlob = (embed.video?.$type == "blob");
            if (isBlob) {
                if (did != null && embed.video?.ref?.$link != null) {
                    const ref = embed.video?.ref?.$link;
                    const media = `${uriPrefixVideo}/watch/${did}/${ref}/playlist.m3u8`;
                    const thumbnail = `${uriPrefixVideo}/watch/${did}/${ref}/thumbnail.jpg`;
                    const attachment = MediaAttachment.createWithUrl(media);
                    if (embed.aspectRatio != null) {
                        attachment.aspectSize = embed.aspectRatio;
                    }
                    if (embed.alt != null && embed.alt.length != 0) {
                        attachment.text = embed.alt;
                    }
                    attachment.thumbnail = thumbnail;
                    // The kind, not a mime: playback URLs are .m3u8 playlists whose extension would otherwise classify as audio.
                    attachment.mediaType = "video";
                    attachments = [attachment];
                }
            }
            else {
                if (embed.playlist != null) {
                    const media = embed.playlist;
                    const attachment = MediaAttachment.createWithUrl(media);
                    if (embed.aspectRatio != null) {
                        attachment.aspectSize = embed.aspectRatio;
                    }
                    if (embed.alt != null && embed.alt.length != 0) {
                        attachment.text = embed.alt;
                    }
                    if (embed.thumbnail != null) {
                        attachment.thumbnail = embed.thumbnail;
                    }
                    attachment.mediaType = "video";
                    attachments = [attachment];
                }
            }
        }
        else if (embed.$type.startsWith("app.bsky.embed.external")) {
            if (embed.external != null && embed.external.uri != null) {
                const isBlob = (embed.external?.thumb?.$type == "blob");

                const external = embed.external;
                let thumbnail = null;
                if (isBlob) {
                    if (did != null && embed.external?.thumb?.ref?.$link != null) {
                        const ref = embed.external?.thumb?.ref?.$link;
                        const suffix = embed.external?.thumb?.mimeType.split("/")[1] ?? "";
                        thumbnail = `${uriPrefixContent}/img/feed_thumbnail/plain/${did}/${ref}@${suffix}`;
                    }
                }
                else {
                    if (external.thumb != null && external.thumb.length > 0) {
                        thumbnail = external.thumb;
                    }
                }

                const animation = animationForGifExternal(external);
                if (animation != null) {
                    if (thumbnail != null) {
                        animation.thumbnail = thumbnail;
                    }
                    attachments = [animation];
                }
                else {
                    let attachment = LinkAttachment.createWithUrl(external.uri);
                    if (external.title != null && external.title.length > 0) {
                        attachment.title = external.title;
                    }
                    if (external.description != null && external.description.length > 0) {
                        attachment.subtitle = external.description;
                    }
                    if (thumbnail != null) {
                        attachment.image = thumbnail;
                    }
                    attachments = [attachment];
                }
            }
        }
        else if (embed.$type.startsWith("app.bsky.embed.recordWithMedia")) {
            if (embed.record != null && embed.media != null) {
                attachments = attachmentsForEmbed(embed.media);

                const attachment = postForEmbeddedRecord(embed.record.record);
                if (attachment != null) {
                    if (attachments == null) {
                        attachments = [attachment];
                    }
                    else {
                        attachments.push(attachment);
                    }
                }
            }
        }
        else if (embed.$type.startsWith("app.bsky.embed.record")) { // NOTE: This one needs to be after app.bsky.embed.recordWithMedia because of the lazy match
            const attachment = postForEmbeddedRecord(embed.record);
            if (attachment != null) {
                attachments = [attachment];
            }
        }

    }
    
    return attachments;
}

function contentForRecord(record) {
    if (record == null) {
        return "<p>Deleted post</p>";
    }
    // TODO: This logic is fragile...
    if (record.text == null && record?.value == null) { //record?.value.text == null) {
        return "";
    }
    
    let content = record.text ?? record.value.text;
    
    // NOTE: Facets are a pain in the butt since they use byte positions in UTF-8. The JSON parser generates UTF-16
    // so we have to convert it back to bytes, find what we need, and then make a new UTF-16 string.
    
    try {
        content = content.replaceAll("<", "\x02"); // replace less-than with SOT (Start Of Text) ASCII code
        content = content.replaceAll(">", "\x03"); // replace greater-than with EOT (End Of Text) ASCII code

        if (record.facets != null) {
            // NOTE: Facets are processed in reverse order determined by the starting index. This is because the output string
            // is being modified in place.
            const sortedFacets = record.facets.toSorted((a,b) => {return b?.index?.byteStart - a?.index?.byteStart})
            for (const facet of sortedFacets) {
                if (facet.features.length > 0) {
                    const bytes = new TextEncoder().encode(content);
                    
                    const prefixBytes = bytes.slice(0, facet.index.byteStart);
                    const suffixBytes = bytes.slice(facet.index.byteEnd);
                    const textBytes = bytes.slice(facet.index.byteStart, facet.index.byteEnd);
    
                    const decoder = new TextDecoder();
                    const prefix = decoder.decode(prefixBytes);
                    const suffix = decoder.decode(suffixBytes);
                    const text = decoder.decode(textBytes);
    
                    const feature = facet.features[0];
    
                    if (feature.$type == "app.bsky.richtext.facet#link") {
                        const link = `<a href="${feature.uri}">${text}</a>`;
                        content = prefix + link + suffix;
                    }
                    else if (feature.$type == "app.bsky.richtext.facet#mention") {
                        const link = `<a href="${uriPrefix}/profile/${feature.did}">${text}</a>`;
                        content = prefix + link + suffix;
                    }
                    else if (feature.$type == "app.bsky.richtext.facet#tag") {
                        //console.log(`tag feature = ${JSON.stringify(feature)}`);
                        const link = `<a href="${uriPrefix}/hashtag/${feature.tag}">${text}</a>`;
                        content = prefix + link + suffix;
                    }
                    else {
                        console.log(`skipped feature.$type = ${feature.$type}`);
                    }
                }
            }
        }
    }
    catch (error) {
        console.log(`facet conversion error = ${error}`);
    }

    let finalContent = "";
    const paragraphs = content.split("\n\n")
    for (const paragraph of paragraphs) {
        finalContent += "<p>" + paragraph.replaceAll("\n", "<br/>") + "</p>";
    }
    finalContent = finalContent.replaceAll("\x02", "&lt;"); // replace SOT (Start Of Text) ASCII code with less-than HTML entity
    finalContent = finalContent.replaceAll( "\x03", "&gt;"); // replace EOT (End Of Text) ASCII code with greater-than HTML entity

    return finalContent;
}

// By being in bluesky-shared.js, all of the Bluesky connectors get this.
// However, most actions will not work unless authenticated! So be sure to
// edit the actions.json file for each connector and only include the ones
// that can actually work for the non-authorized connector variants!
// A TID (timestamp identifier) — the AT-Protocol record-key format: a sortable, 13-char base32 encoding of a
// microsecond timestamp (53 bits) plus a random 10-bit clock id. `app.bsky.feed.post` requires the rkey to be a
// TID. We choose it client-side so a resubmit reuses the same rkey and `createRecord` rejects the duplicate
// (Bluesky has no idempotency header).
const _s32 = "234567abcdefghijklmnopqrstuvwxyz";
let _tidLast = 0n;
const _tidClock = BigInt(Math.floor(Math.random() * 1024));
function nextTid() {
    let micros = BigInt(Date.now()) * 1000n;
    if (micros <= _tidLast) { micros = _tidLast + 1n; }
    _tidLast = micros;
    let n = (micros << 10n) | _tidClock;
    let s = "";
    for (let i = 0; i < 13; i++) { s = _s32[Number(n & 31n)] + s; n >>= 5n; }
    return s;
}

// Resolve a handle (e.g. "alice.bsky.social") to its DID, or null if it can't be resolved.
async function resolveHandle(handle) {
    try {
        return (await fetch(`${site}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`).json()).did;
    } catch (error) {
        return null;
    }
}

// Build richtext facets for the @mentions and links in `text`. Offsets are UTF-8 BYTE positions (byteEnd
// exclusive), computed over the exact string sent as record.text. A mention that can't be resolved to a DID is
// left as plain text rather than blocking the post.
async function buildFacets(text) {
    const encoder = new TextEncoder();
    const byteLength = (s) => encoder.encode(s).length;
    const facets = [];

    // Mentions: @handle. atproto handles are a-z 0-9 . - (no underscore); a trailing dot isn't part of the handle.
    for (const match of text.matchAll(/(^|\s|\()@([a-zA-Z0-9.-]+)/g)) {
        const handle = match[2].replace(/\.+$/, "");
        if (handle.length === 0) { continue; }
        const did = await resolveHandle(handle);
        if (did == null) { continue; }
        const start = byteLength(text.slice(0, match.index + match[1].length));
        const end = start + byteLength("@" + handle);
        facets.push({ index: { byteStart: start, byteEnd: end }, features: [{ "$type": "app.bsky.richtext.facet#mention", did: did }] });
    }

    // Links via `extractLinks` (bare domains included, non-web schemes filtered). `start`/`length` are UTF-16 offsets
    // into `text`; convert to the UTF-8 byte offsets facets use.
    for (const link of extractLinks(text)) {
        const byteStart = byteLength(text.slice(0, link.start));
        const byteEnd = byteStart + byteLength(text.substring(link.start, link.start + link.length));
        facets.push({ index: { byteStart: byteStart, byteEnd: byteEnd }, features: [{ "$type": "app.bsky.richtext.facet#link", uri: link.url }] });
    }

    return facets;
}

// Build an `app.bsky.embed.external` (link card) from a resolved link attachment: fetch the link's image, fit it
// under Bluesky's external-thumb ceiling (1 MB / 2000 px — matches the lexicon's thumb `maxSize` and the official
// client), and upload it as a blob. A failure degrades to a card without a thumbnail rather than blocking the post.
async function buildExternalEmbed(link) {
    const external = { uri: link.url, title: link.title ?? link.url, description: link.subtitle ?? "" };

    if (link.image != null) {
        try {
            const original = await fetch(link.image).file();
            const thumb = await imageTransform(original, ["jpeg"], { maxBytes: 1000000, maxPixels: 2000 });
            const uploaded = await fetch.post(`${site}/xrpc/com.atproto.repo.uploadBlob`, { body: thumb }).json();
            if (uploaded.blob != null) { external.thumb = uploaded.blob; }
        } catch (error) {
            console.log(`link card thumbnail failed: ${error}`);   // post the card without a thumbnail
        }
    }

    return { "$type": "app.bsky.embed.external", external: external };
}

// Fit + upload one image to a blob, returning the ref plus its display dimensions — Bluesky positions each embedded
// image by `aspectRatio`, so read the fitted size with `imageInfo`. Fitted under the per-image blob ceiling (2 MB).
// `uploadBlob` is synchronous — the ref comes back immediately (no async transcode poll like a video).
async function uploadImage(file) {
    const fitted = await imageTransform(file, ["jpeg", "png"], { maxBytes: 2000000, maxPixels: 4000 });
    const info = await imageInfo(fitted);
    const uploaded = await fetch.post(`${site}/xrpc/com.atproto.repo.uploadBlob`, { body: fitted }).json();
    return { blob: uploaded.blob, width: info.width, height: info.height, file: fitted };
}

// The account's DID plus its PDS's `did:web:` identifier (the audience a service-auth token is scoped to). Both are
// stable per account, so they're resolved once from the session — which carries the DID document — and cached. The
// PDS host comes from the DID doc's atproto PDS service entry, NOT from `site`: `site` may be the bsky.social
// entryway while the repo actually lives on a `*.host.bsky.network` server, and a service token's audience must be
// the PDS that ultimately stores the blob.
async function accountDids() {
    let did = getItem("did");
    let pdsAud = getItem("pdsAud");
    if (did == null || pdsAud == null) {
        const session = await fetch(`${site}/xrpc/com.atproto.server.getSession`).json();
        did = session.did;
        const service = (session.didDoc?.service ?? []).find(entry => entry.type === "AtprotoPersonalDataServer");
        const host = (service?.serviceEndpoint ?? site).replace(/^https?:\/\//, "").replace(/\/.*$/, "");
        pdsAud = `did:web:${host}`;
        setItem("did", did);
        setItem("pdsAud", pdsAud);
    }
    return { did, pdsAud };
}

// Mint a short-lived service-auth JWT: a token the PDS issues authorizing ONE lexicon method (`lxm`) against ONE
// audience (`aud`). The video service uses one to call `uploadBlob` on the user's own PDS on their behalf, so unlike
// the session credential (which never leaves the host) this token is meant to be handed to the connector. The
// 30-minute expiry mirrors the official client — it must outlive the whole transcode, not just the byte transfer.
async function serviceAuthToken(aud, lxm) {
    const exp = Math.floor(Date.now() / 1000) + 30 * 60;
    const query = `aud=${encodeURIComponent(aud)}&lxm=${encodeURIComponent(lxm)}&exp=${exp}`;
    const result = await fetch(`${site}/xrpc/com.atproto.server.getServiceAuth?${query}`).json();
    return result.token;
}

// video.bsky.app gates video per-account: `canUpload` folds in both the daily quota AND eligibility (an account whose
// PDS the service doesn't serve gets `canUpload: false`), so one check answers "can this account post video at all?".
// Checked when the user picks a video — not at compose-open, so a text post pays nothing — and it throws before the
// transcode, so the refusal lands immediately at pick time rather than after a long upload. Deliberately uncached:
// the quota is dynamic, so a stale "yes"/"no" would lie.
async function ensureCanUploadVideo() {
    const token = await serviceAuthToken(videoServiceDid, "app.bsky.video.getUploadLimits");
    const limits = await fetch(`${uriPrefixVideo}/xrpc/app.bsky.video.getUploadLimits`, { headers: { "Authorization": `Bearer ${token}` } }).json();
    if (!limits.canUpload) { throw new Error(limits.message ?? limits.error ?? "This account can’t upload video right now."); }
}

// Fit + upload one video, returning the processed blob ref plus its display dimensions. A video goes through
// Bluesky's transcoding service at video.bsky.app (into the HLS stream clients play): confirm the account may
// upload, mint a PDS-scoped service token, POST the bytes (the service wants the token as a bearer header — a
// cross-host request), then poll getJobStatus until the transcode finishes and returns the stored blob. getJobStatus
// is unauthenticated.
async function uploadVideo(file) {
    const { did, pdsAud } = await accountDids();
    await ensureCanUploadVideo();
    const fitted = await videoTransform(file, ["mp4"], { maxBytes: 300000000 });
    const token = await serviceAuthToken(pdsAud, "com.atproto.repo.uploadBlob");
    const name = `${nextTid()}.mp4`;
    const started = await fetch.post(`${uriPrefixVideo}/xrpc/app.bsky.video.uploadVideo?did=${encodeURIComponent(did)}&name=${name}`,
        { body: fitted, headers: { "Authorization": `Bearer ${token}`, "Content-Type": "video/mp4" } }).json();
    if (started.jobId == null) { throw new Error(started.message ?? started.error ?? "video upload did not start"); }
    await sleep(1000);   // transcoding is never instant, so skip poll's immediate first check — it's a guaranteed miss
    const finished = await poll(async () => {
        const status = (await fetch(`${uriPrefixVideo}/xrpc/app.bsky.video.getJobStatus?jobId=${encodeURIComponent(started.jobId)}`).json()).jobStatus;
        if (status.state === "JOB_STATE_FAILED") { throw new Error(status.error ?? "video processing failed"); }
        return status.state === "JOB_STATE_COMPLETED" ? status : null;
    });
    const info = await videoInfo(fitted);
    return { blob: finished.blob, width: info.width, height: info.height, file: fitted };
}

// Pre-upload one image or video during compose; return the blob ref (as JSON — a blob ref is structured but draft
// metadata is string-valued) plus its display dimensions. `attachedAs` is "image" or "video" — an animation widened
// to video, since Bluesky has no animation kind.
async function uploadAttachment(file, attachedAs) {
    if (attachedAs == "image" || attachedAs == "video") {
        const uploaded = attachedAs == "image" ? await uploadImage(file) : await uploadVideo(file);
        return UploadedAsset.create(uploaded.file, { blob: JSON.stringify(uploaded.blob), width: `${uploaded.width}`, height: `${uploaded.height}` });
    }
    throw new Error(`Uploading ${attachedAs} isn't supported yet`);
}

// Build the image embed from the draft's image attachments: use each attachment's blob ref if it was pre-uploaded,
// else upload its bytes here. Alt text comes from the final draft and is written on the record. Bluesky has no focal
// point. The item shape is identical for both embeds — up to 4 images uses the classic `app.bsky.embed.images` (widely
// rendered), and 5+ uses `app.bsky.embed.gallery` (soft limit 10), which is the only embed that holds more than four.
async function buildImagesEmbed(attachments) {
    const items = [];
    for (const attachment of attachments) {
        const meta = attachment.metadata;
        const { blob, width, height } = meta != null
            ? { blob: JSON.parse(meta.blob), width: Number(meta.width), height: Number(meta.height) }
            : await uploadImage(attachment.file);
        // aspectRatio is optional in the lexicon, and a post being edited may have been made by a client that left
        // it off — so send it only when it's actually known rather than a meaningless 0×0.
        const item = { image: blob, alt: attachment.text ?? "" };
        if (width > 0 && height > 0) { item.aspectRatio = { width: width, height: height }; }
        items.push(item);
    }
    // gallery `items` is a UNION (of `#image`), so each member needs a `$type` discriminator; the `images`
    // embed's plain-ref array doesn't. The per-item blob/alt/aspectRatio is identical either way.
    return items.length > 4
        ? { "$type": "app.bsky.embed.gallery", items: items.map(i => ({ "$type": "app.bsky.embed.gallery#image", ...i })) }
        : { "$type": "app.bsky.embed.images", images: items };
}

// Build an `app.bsky.embed.video` from the draft's single video attachment: use the blob ref if it was pre-uploaded,
// else upload (transcode + poll) its bytes here. Alt text comes from the final draft and is written on the record.
async function buildVideoEmbed(attachment) {
    const meta = attachment.metadata;
    const { blob, width, height } = meta != null
        ? { blob: JSON.parse(meta.blob), width: Number(meta.width), height: Number(meta.height) }
        : await uploadVideo(attachment.file);
    const embed = { "$type": "app.bsky.embed.video", video: blob };
    if (width > 0 && height > 0) { embed.aspectRatio = { width: width, height: height }; }
    if (attachment.text) { embed.alt = attachment.text; }
    return embed;
}

// Build the `app.bsky.feed.post` record a finished draft describes: text and its facets, language, reply refs, and
// the one embed — a video, image set or link card, a quote, or (as `recordWithMedia`) a quote alongside one of
// those. Shared by `send` and `saveEdit`, because an edit rewrites the record WHOLE: the two must construct it
// identically or an edit would quietly drop whatever they disagreed on. Only `createdAt` differs — an edit passes
// the post's original.
async function buildPostRecord(draft, createdAt) {
    const attributes = draft.attributeValues ?? {};
    const record = {
        "$type": "app.bsky.feed.post",
        text: draft.body,
        createdAt: createdAt,
    };
    if (attributes.language != null) { record.langs = [attributes.language]; }
    if (draft.metadata.parentUri != null) {
        record.reply = {
            root: { uri: draft.metadata.rootUri, cid: draft.metadata.rootCid },
            parent: { uri: draft.metadata.parentUri, cid: draft.metadata.parentCid },
        };
    }
    // The post's ONE media embed is a video, image set, or link card (mutually exclusive); a quote is a `record`
    // embed. Media + quote combine via `recordWithMedia`; either can stand alone. Route by each media's `mediaType`.
    const mediaAttachments = (draft.attachments ?? []).filter(a => a?.kind === "media");
    const videoAttachment = mediaAttachments.find(a => a.mediaType === "video");
    const imageAttachments = mediaAttachments.filter(a => a.mediaType === "image");
    const linkAttachment = (draft.attachments ?? []).find(a => a?.kind === "link");
    let mediaEmbed = null;
    if (videoAttachment != null) {
        mediaEmbed = await buildVideoEmbed(videoAttachment);
    } else if (imageAttachments.length > 0) {
        mediaEmbed = await buildImagesEmbed(imageAttachments);
    } else if (linkAttachment != null) {
        mediaEmbed = await buildExternalEmbed(linkAttachment);
    }
    if (draft.metadata.quoteUri != null) {
        const quoteEmbed = { "$type": "app.bsky.embed.record", record: { uri: draft.metadata.quoteUri, cid: draft.metadata.quoteCid } };
        record.embed = mediaEmbed != null
            ? { "$type": "app.bsky.embed.recordWithMedia", record: quoteEmbed, media: mediaEmbed }
            : quoteEmbed;
    } else if (mediaEmbed != null) {
        record.embed = mediaEmbed;
    }
    const facets = await buildFacets(draft.body);
    if (facets.length > 0) { record.facets = facets; }
    return record;
}

// Build a compose draft. `reply` seeds the reply refs (root + parent) for threading and the post to display; no
// mention prefill — a Bluesky reply notifies the parent via the ref (matching the official client), and any
// @-mention the user types becomes a facet at send. `newPost` starts blank. Both carry a client-chosen `rkey` for
// idempotency and submit through the same `send` verb. `edit` seeds the target post's complete current state and
// submits through `saveEdit` instead — the app never learns it's editing.
async function composeDraft(actionId, target, metadata) {
    const draft = Draft.create();

    // An edit re-reads its target up front: the post RECORD is what gets rewritten, and the timeline item carries
    // rendered HTML rather than the text the user typed. `getPosts` returns both halves in one call — the raw
    // record to seed from, and the hydrated view the composer displays.
    const view = actionId == "edit"
        ? (await fetch(`${site}/xrpc/app.bsky.feed.getPosts?uris=${encodeURIComponent(metadata.uri)}`).json()).posts?.[0]
        : null;
    if (actionId == "edit" && view == null) { throw new Error("This post couldn’t be loaded for editing."); }

    // An edit rewrites the post in place, so it keeps the post's OWN rkey rather than minting one for idempotency.
    draft.metadata = { rkey: actionId == "edit" ? metadata.uri.split("/").pop() : nextTid() };
    draft.actions.add(actionId == "edit" ? "saveEdit" : "send");

    // Bluesky posts are limited to BOTH 300 graphemes and 3000 UTF-8 bytes (the `app.bsky.feed.post` lexicon caps
    // text at maxGraphemes:300 / maxLength:3000). The byte cap can bind first on emoji-heavy text. No weighting:
    // URLs and mentions count as their literal typed length — we post the text verbatim, matching what the server
    // counts (unlike the official app, which shortens URLs in its own counter and so disagrees with the server).
    draft.rules = {
        characterUnit: "graphemes",
        characterCounter: { fields: ["body"], characterLimit: { maxLength: 300, maxBytes: 3000 } },
        fields: { body: { placeholder: actionId == "reply" ? "Write your reply" : "What's up?" } },
        attributes: composeAttributes(actionId),
        // @-mentions autocomplete via the suggest() verb (actor typeahead). Bluesky has no hashtag-suggest API, so `#`
        // is history-only — it offers the tags you've used before rather than searching the network (see suggestHashtags).
        suggestions: ["@", "#"],
        // A post carries ONE embed — a link card, an image set, or a video (mutually exclusive) — and may ALSO quote
        // another post (recordWithMedia combines a quote with one of those). So `media` and `quote` are separate slots
        // that can coexist. Bluesky has no animated-image type, so a picked animation is offered as a video.
        attachments: {
            slots: {
                media: [ { allow: ["link"] }, { allow: ["image"], max: 10 }, { allow: ["video"] } ],   // up to 4 = images embed, 5–10 = gallery (soft limit 10)
                quote: [ { allow: ["item"] } ]
            },
            combinations: [ ["media", "quote"] ]
        },
        // Bluesky has no focal point (it positions with aspectRatio alone); alt text is per-image/video and lives on
        // the post record at send (not on the uploaded blob), so editing it while an eager upload is in flight is
        // race-free. Video is capped at 3 minutes (the official client's constant — Bluesky exposes no limits API, only
        // a per-account daily quota); the 300 MB size cap is fitted by `uploadVideo`'s transform rather than declined.
        // Alt text isn't capped by the protocol at all (the lexicon puts no length on it); 2000 matches the official
        // client's own limit — a courtesy ceiling, not a server rule.
        media: { upload: "eager", supportsAltText: ["image", "video"], supportsFocusPoint: [], altTextCharacterLimit: { maxLength: 2000 }, limits: { video: { seconds: 180 } } }
    };

    if (actionId == "reply") {
        const author = target.author;
        draft.header = "Reply to " + (author?.name ?? author?.username ?? "post");
        draft.context = [target];
        draft.metadata.parentUri = metadata.uri;
        draft.metadata.parentCid = metadata.cid;
        draft.metadata.rootUri = metadata.rootUri ?? metadata.uri;
        draft.metadata.rootCid = metadata.rootCid ?? metadata.cid;
        if (metadata.language != null) { draft.attributeValues.language = metadata.language; }
    } else if (actionId == "quote") {
        // A quote is a top-level post embedding another. The full item rides `attachments` for the composer preview
        // (and to keep it live); the strong ref used to build the embed at send rides `metadata`, like a reply ref.
        const author = target.author;
        draft.header = "Quote " + (author?.name ?? author?.username ?? "post");
        draft.attachments = [target];
        draft.metadata.quoteUri = metadata.uri;
        draft.metadata.quoteCid = metadata.cid;
    } else if (actionId == "edit") {
        const record = view.record;
        draft.header = "Edit Post";
        draft.body = record.text ?? "";
        // `saveEdit` rewrites the record whole, so everything the composer doesn't edit has to ride through the
        // draft or it gets dropped: the original creation time (which keeps the post where it already sits in the
        // timeline), the reply refs that make it a reply at all, and a quote's strong ref. The quote ALSO seeds as
        // an attachment, for display only — there's no way to drop it in the composer, it's simply re-sent.
        // The current cid rides along too, so `saveEdit` can tell the AppView's re-read apart from the old post.
        draft.metadata.createdAt = record.createdAt;
        draft.metadata.cid = view.cid;
        if (record.reply != null) {
            draft.metadata.rootUri = record.reply.root.uri;
            draft.metadata.rootCid = record.reply.root.cid;
            draft.metadata.parentUri = record.reply.parent.uri;
            draft.metadata.parentCid = record.reply.parent.cid;
        }
        const quote = record.embed?.$type == "app.bsky.embed.recordWithMedia" ? record.embed.record?.record
                    : record.embed?.$type == "app.bsky.embed.record" ? record.embed.record : null;
        if (quote != null) {
            draft.metadata.quoteUri = quote.uri;
            draft.metadata.quoteCid = quote.cid;
        }
        if (record.langs?.[0] != null) { draft.attributeValues.language = record.langs[0]; }
        draft.attachments = editAttachments(record, view);
    } else {
        draft.header = "New Post";
    }

    return draft;
}

// Seed an edit's attachments. The composer should show the post the way the timeline does, so this starts from the
// same build and then reconciles the two places where the RENDERED attachment isn't what the record actually holds.
// Each media attachment is stamped with the blob it already has on the service, so saving reuses it instead of
// re-uploading bytes the app never downloaded. And a GIF — which Bluesky stores as an external card and the
// timeline renders as an animation — is put back to the link card it really is: the composer offers no animation
// slot, so seeding the rendered form would leave a draft that could never be saved. A quote comes along untouched.
function editAttachments(record, view) {
    const attachments = attachmentsForEmbed(view.embed) ?? [];
    const embed = record.embed?.$type == "app.bsky.embed.recordWithMedia" ? record.embed.media : record.embed;

    if (embed?.$type == "app.bsky.embed.external") {
        // Rebuilt from the record rather than adjusted in place, so the card carries the title and description the
        // post actually stores (a GIF's alt text lives in that description). Its thumbnail is re-fetched and
        // re-uploaded at save, which is a round trip but keeps this to the fields the record really has.
        const card = LinkAttachment.createWithUrl(embed.external.uri);
        if (embed.external.title) { card.title = embed.external.title; }
        if (embed.external.description) { card.subtitle = embed.external.description; }
        const thumbnail = attachments[0]?.thumbnail ?? attachments[0]?.image;
        if (thumbnail != null) { card.image = thumbnail; }
        attachments[0] = card;
        return attachments;
    }

    const items = embed?.$type == "app.bsky.embed.images" ? (embed.images ?? [])
                : embed?.$type == "app.bsky.embed.gallery" ? (embed.items ?? [])
                : embed?.$type == "app.bsky.embed.video" ? [embed] : [];
    // Media leads the attachments in record order (a quote is appended last), so index pairs the two lists.
    for (let index = 0; index < items.length && index < attachments.length; index++) {
        const item = items[index];
        const size = item.aspectRatio ?? {};
        attachments[index].metadata = { blob: JSON.stringify(item.image ?? item.video), width: `${size.width ?? 0}`, height: `${size.height ?? 0}` };
    }
    return attachments;
}

// Bluesky's composer settings: who may reply (threadgate), whether the post can be quoted (postgate), and the post
// language. Reply audience is one multi-select mirroring Bluesky's own model — "Everybody" (no threadgate) and
// "Nobody" (empty allow list) are mutually exclusive with each other and with the relationship groups, which combine.
// It's written as a threadgate sidecar at `send`. Quotes are allowed by default; turning that off writes a postgate.
//
// A threadgate is structurally root-only in atproto (its rkey must equal the thread root's), so reply audience can't
// be set on a reply — that attribute is offered only on top-level posts.
//
// An edit offers NEITHER gate. Both are separate records alongside the post, not part of it, so `saveEdit` doesn't
// write them and the post's existing reply/quote settings survive an edit untouched — offering controls that were
// never going to be written would lie about what saving does.
function composeAttributes(actionId) {
    const attributes = [];
    if (actionId != "reply" && actionId != "edit") {
        attributes.push({
            name: "replyAudience",
            label: "Who can reply",
            type: "multiple",
            defaultValue: "everybody",
            requireSelection: true,
            icon: "bubble.left.and.bubble.right",
            choices: [
                { value: "everybody", label: "Everybody", exclusive: true },
                { value: "nobody", label: "Nobody", exclusive: true },
                { value: "mentioned", label: "Mentioned users" },
                { value: "following", label: "People you follow" },
                { value: "followers", label: "Your followers" }
            ]
        });
    }
    if (actionId != "edit") {
        attributes.push({
            name: "allowQuotes",
            label: "Who can quote",
            defaultValue: "on",
            choices: [
                { value: "on", label: "Anyone", icon: "quote.bubble" },
                { value: "off", label: "Nobody", icon: "nosign" }
            ]
        });
    }
    attributes.push({ name: "language", type: "language" });
    return attributes;
}

// Build the threadgate/postgate create-ops that ride in the post's atomic `applyWrites` batch (see `send`), sharing
// the post's rkey (a gate gates the `feed.post` at the same rkey). Returns [] when no gate applies — because the
// whole batch is atomic, there is no separate write to fail and nothing partial to surface.
function gateWrites(attributes, postUri, rkey, createdAt, isReply) {
    const writes = [];
    // Threadgate — only on a top-level post (a threadgate's rkey must equal the thread root's, so a reply can't carry
    // one) and only when replies aren't open to everyone. An empty allow list means "nobody", which is exactly what
    // the "nobody" selection (and any selection lacking a relationship rule) produces.
    const audience = new Set((attributes.replyAudience ?? "everybody").split(","));
    if (!isReply && !audience.has("everybody")) {
        const allow = [];
        if (audience.has("following")) { allow.push({ "$type": "app.bsky.feed.threadgate#followingRule" }); }
        if (audience.has("followers")) { allow.push({ "$type": "app.bsky.feed.threadgate#followerRule" }); }
        if (audience.has("mentioned")) { allow.push({ "$type": "app.bsky.feed.threadgate#mentionRule" }); }
        writes.push({ "$type": "com.atproto.repo.applyWrites#create", collection: "app.bsky.feed.threadgate", rkey: rkey,
            value: { "$type": "app.bsky.feed.threadgate", post: postUri, allow: allow, createdAt: createdAt } });
    }

    // Postgate — only when quotes are disallowed.
    if (attributes.allowQuotes === "off") {
        writes.push({ "$type": "com.atproto.repo.applyWrites#create", collection: "app.bsky.feed.postgate", rkey: rkey,
            value: { "$type": "app.bsky.feed.postgate", post: postUri, createdAt: createdAt, embeddingRules: [{ "$type": "app.bsky.feed.postgate#disableRule" }] } });
    }
    return writes;
}

// Learn the @mentions and #hashtags in some post text — the composed body (dated now), or one of your own posts as it
// loads (dated by the post; the caller gates on authorship). Both are pulled by regex from the plain text, so they
// keep the casing you typed. The mention pattern mirrors buildFacets (atproto handles are a-z 0-9 . -, may follow
// "("); a trailing dot is sentence punctuation, not part of the handle.
function learnFromText(text, date) {
    const mentions = [...(text ?? "").matchAll(/(?<![^\s(])@([a-zA-Z0-9.-]+)/gu)].map(match => ({ value: match[1].replace(/\.+$/, ""), date }));
    const hashtags = [...(text ?? "").matchAll(/(?<![^\s])[#＃]([\p{L}\p{N}_]+)/gu)].map(match => ({ value: match[1], date }));
    remember("mentionHistory", mentions);
    remember("tagHistory", hashtags);
}

// Autocomplete for the `@`/`#` markers. A bare marker (no query yet) offers your recent-usage history instead of a
// live search. Bluesky has no hashtag-search API at all, so `#` is history-only — see suggestHashtags.
async function suggest(match) {
    const marker = match[0];
    const query = match.slice(1);   // drop the marker; "" for a bare "@" / "#"
    if (marker === "@") { return await suggestAccounts(query); }
    if (marker === "#") { return suggestHashtags(query); }
    return [];
}

// Profiles already looked up this session — "@handle" (lowercased) -> { description, image }. Nothing here is ever
// stored; it exists so reopening the popup or typing more of a handle doesn't refetch profiles hydrated moments ago
// (and so an already-shown avatar never flickers away mid-word). An entry whose lookup found nothing still counts as
// looked-up, so a renamed/deleted handle isn't re-queried on every keystroke.
const profileCache = new Map();

// @-mention autocomplete, one flow for the bare and typed cases: build the row list — your recent mentions first (all
// of them for a bare "@", the prefix matches for a typed query), then live server results for a typed query, deduped
// (a server hit for a handle already surfaced from history enriches that row's name/avatar rather than duplicating it)
// — then hydrate whatever this session hasn't looked up yet in ONE getProfiles batch. Your recent mentions always lead
// (in recency order); a partial query never lets a coincidental server match jump the queue, so heading for "@gedeonm"
// isn't hijacked by some "@gedeon" — tap down for that. The bare "@" typically pays the one hydrate batch; after that
// the cache means a keystroke costs just its typeahead call.
async function suggestAccounts(query) {
    const rows = [];
    const byValue = new Map();
    const add = row => {
        const key = row.value.toLowerCase();
        const existing = byValue.get(key);
        if (existing == null) { byValue.set(key, row); rows.push(row); }
        else if (existing.image == null && row.image != null) { existing.description = row.description; existing.image = row.image; }
    };

    for (const entry of recent("mentionHistory", query)) { const value = "@" + entry.value; add({ value, ...profileCache.get(value.toLowerCase()) }); }

    if (query.length > 0) {
        const result = await fetch(`${site}/xrpc/app.bsky.actor.searchActorsTypeahead?q=${encodeURIComponent(query)}`).json();
        for (const actor of (result.actors ?? [])) {
            const row = { value: "@" + actor.handle, description: actor.displayName, image: actor.avatar };
            profileCache.set(row.value.toLowerCase(), { description: row.description, image: row.image });
            add(row);
        }
    }

    await hydrateHandles(rows);
    return rows;
}

// Fill the CURRENT name/avatar into any rows this session hasn't looked up yet (your history rows), mutating them in
// place, via one app.bsky.actor.getProfiles batch by handle — so a changed profile always shows and nothing about it
// is stored. The slice keeps the batch within getProfiles' 25-actor limit; if a short prefix matches more history
// than that, the overflow rows just show plain for now and hydrate (via the cache) on a later call. A handle that
// doesn't come back (renamed/deleted) keeps its plain "@handle" row, cached so it isn't asked about again.
// Best-effort: suggest() must never throw at the composing user, so a failed batch simply leaves the plain rows —
// and caches nothing, so a transient failure retries on the next call.
async function hydrateHandles(rows) {
    const pending = rows.filter(row => !profileCache.has(row.value.toLowerCase())).slice(0, HISTORY_SHOW);
    if (pending.length === 0) { return; }
    try {
        const params = pending.map(row => "actors=" + encodeURIComponent(row.value.slice(1))).join("&");
        const profiles = (await fetch(`${site}/xrpc/app.bsky.actor.getProfiles?${params}`).json()).profiles ?? [];
        const byHandle = new Map(profiles.map(profile => ["@" + profile.handle.toLowerCase(), profile]));
        for (const row of pending) {
            const profile = byHandle.get(row.value.toLowerCase());
            if (profile != null) { row.description = profile.displayName; row.image = profile.avatar; }
            profileCache.set(row.value.toLowerCase(), { description: row.description, image: row.image });
        }
    } catch (error) {
        // best-effort: leave the plain rows as-is
    }
}

// Hashtag autocomplete. Bluesky has no hashtag-search API, so this is purely your own recent tags: a bare "#" offers
// the most recent, and typing filters them by prefix, most-recent first. Nothing to show until you've used some.
function suggestHashtags(query) {
    return recent("tagHistory", query).map(entry => ({ value: "#" + entry.value }));
}

async function performAction(actionId, target, actionValue) {
    // Post uri/cid/rkey live in item.metadata; older items stored them as a JSON string under the action value — fall
    // back for those. `target` is null for a feed-targeted action (newPost), so `?.`.
    let metadata = target?.metadata;
    if (metadata == null) {
        const legacy = actionValue;
        if (legacy != null) {
            const values = JSON.parse(legacy);
            metadata = { uri: values.uri, cid: values.cid };
            // The old unlike/unrepost actions carried the record's rkey directly.
            if (actionId == "unlike") { metadata.likeRkey = values.rkey; }
            else if (actionId == "unrepost") { metadata.repostRkey = values.rkey; }
        }
    }

    let did = getItem("did");
    if (did == null) {
        did = await getSessionDid();
        setItem("did", did);
    }

    let date = new Date().toISOString();
    if (actionId == "like") {
        const body = {
            collection: "app.bsky.feed.like",
            repo: did,
            record : {
                "$type": "app.bsky.feed.like",
                subject: {
                    uri: metadata.uri,
                    cid: metadata.cid
                },
                createdAt: date,
            }
        };

        const jsonObject = await fetch.post(`${site}/xrpc/com.atproto.repo.createRecord`, { json: body }).json();
        const rkey = jsonObject.uri.split("/").pop();

        metadata.likeRkey = rkey;
        target.metadata = metadata;
        target.actions.delete("like");
        target.actions.add("unlike");
        return target;
    }
    else if (actionId == "unlike") {
        const body = {
            collection: "app.bsky.feed.like",
            repo: did,
            rkey: metadata.likeRkey
        };

        await fetch.post(`${site}/xrpc/com.atproto.repo.deleteRecord`, { json: body });

        target.actions.delete("unlike");
        target.actions.add("like");
        return target;
    }
    else if (actionId == "repost") {
        const body = {
            collection: "app.bsky.feed.repost",
            repo: did,
            record : {
                "$type": "app.bsky.feed.repost",
                subject: {
                    uri: metadata.uri,
                    cid: metadata.cid
                },
                createdAt: date,
            }
        };

        const jsonObject = await fetch.post(`${site}/xrpc/com.atproto.repo.createRecord`, { json: body }).json();
        const rkey = jsonObject.uri.split("/").pop();

        metadata.repostRkey = rkey;
        target.metadata = metadata;
        target.actions.delete("repost");
        target.actions.add("unrepost");
        return target;
    }
    else if (actionId == "unrepost") {
        const body = {
            collection: "app.bsky.feed.repost",
            repo: did,
            rkey: metadata.repostRkey
        };

        await fetch.post(`${site}/xrpc/com.atproto.repo.deleteRecord`, { json: body });

        target.actions.delete("unrepost");
        target.actions.add("repost");
        return target;
    }
    else if (actionId == "save") {
        const body = {
            uri: metadata.uri,
            cid: metadata.cid
        };

        await fetch.post(`${site}/xrpc/app.bsky.bookmark.createBookmark`, { json: body });

        target.actions.delete("save");
        target.actions.add("unsave");
        return target;
    }
    else if (actionId == "unsave") {
        const body = {
            uri: metadata.uri
        };

        await fetch.post(`${site}/xrpc/app.bsky.bookmark.deleteBookmark`, { json: body });

        target.actions.delete("unsave");
        target.actions.add("save");
        return target;
    }
    else if (actionId == "thread" || actionId == "replies") {
        const uri = metadata.uri;
        const json = await fetch(`${site}/xrpc/app.bsky.feed.getPostThread?uri=${uri}`).json();
        const firstItem = json["thread"];

        let results = [];
        let parents = parentsForItem(firstItem, true);
        results.push(...parents);

        // Rebuild the target from the thread response instead of reusing the item that launched the action: only the
        // thread's own postView carries `viewer`, so this is where a post that arrived without one — a quote embed,
        // say — picks up its real like/repost state and stops being the one actionless post in its own thread. Fall
        // back to the original when the node is blocked or filtered out by the user's settings.
        const rebuiltTarget = firstItem.post != null ? postForItem(firstItem, true) : null;
        results.push(rebuiltTarget ?? target);

        for (const reply of firstItem.replies ?? []) {
            // Same union as `parent`: a deleted or blocked reply has no `post`.
            if (reply.post != null) {
                results.push(postForItem(reply, true));
            }
        }
        return results;
    }
    else if (actionId == "delete") {
        // The post's rkey is the last path component of its at:// uri; the repo is your own DID (you can only
        // delete your own posts).
        const body = {
            collection: "app.bsky.feed.post",
            repo: did,
            rkey: metadata.uri.split("/").pop()
        };
        await fetch.post(`${site}/xrpc/com.atproto.repo.deleteRecord`, { json: body });
        return [Item.delete(target.uri)];
    }
    else if (actionId == "reply" || actionId == "newPost" || actionId == "quote" || actionId == "edit") {
        return composeDraft(actionId, target, metadata);
    }
    else if (actionId == "send") {
        // Here `target` is the draft. Create the post; nothing to return (createRecord only yields {uri, cid}).
        const draft = target;
        const createdAt = new Date().toISOString();
        const record = await buildPostRecord(draft, createdAt);
        const rkey = draft.metadata.rkey;
        // Post + its reply/quote gates go up as ONE atomic `applyWrites` transaction (all commit together or none
        // do), so the post can never appear without its gates and a failure creates nothing — the client-chosen
        // rkey is known ahead, so the gates can reference the post URI in the same batch. We deliberately DON'T pass
        // `validate: true`: with atproto's default optimistic validation, a self-hosted/older PDS that doesn't know
        // a lexicon (a threadgate, or a gallery embed) stores the record fail-open instead of rejecting it — the
        // AppView is the authority on render. Forcing validation would break exactly those arbitrary-PDS setups.
        const postUri = `at://${did}/app.bsky.feed.post/${rkey}`;
        const writes = [
            { "$type": "com.atproto.repo.applyWrites#create", collection: "app.bsky.feed.post", rkey: rkey, value: record },
            ...gateWrites(draft.attributeValues ?? {}, postUri, rkey, createdAt, draft.metadata.parentUri != null),
        ];
        await fetch.post(`${site}/xrpc/com.atproto.repo.applyWrites`, { json: { repo: did, writes: writes } });
        // Bluesky's send returns nothing and a reply never comes back to your timeline, so this is the only place the
        // post is seen: fold its mentions/tags into the autocomplete history here, dated now.
        learnFromText(draft.body, Date.now());
    }
    else if (actionId == "saveEdit") {
        // Here `target` is the draft `edit` seeded. A post is a record in your own repo, so `putRecord` DOES
        // overwrite it — but the AppView deliberately ignores an update to a post, so the edit lands on the PDS and
        // nobody ever sees it (verified against the live network: the PDS served the new text while the AppView
        // went on serving the old one, with `indexedAt` never moving). What the AppView does honour is a delete
        // followed by a create, so that's what an edit is here. Both ride in ONE atomic `applyWrites` commit at the
        // post's own rkey: the PDS emits the two ops literally rather than folding them into the update that would
        // be dropped, there's no moment where the post is missing, and reusing the rkey keeps the post's URI and so
        // its permalink. Re-sending the original `createdAt` keeps it in place chronologically too — the feed sorts
        // by the earlier of that and the new index time. The record is rewritten WHOLE, so anything the draft
        // doesn't carry is gone, which is what `composeDraft` seeds for.
        //
        // The cost is that to the AppView this genuinely IS a new post: its likes and reposts don't come with it,
        // and anyone the post replies to or mentions gets notified again. That's the price of Bluesky not
        // supporting editing, not something the connector can work around.
        const draft = target;
        const rkey = draft.metadata.rkey;
        const record = await buildPostRecord(draft, draft.metadata.createdAt);
        const writes = [
            { "$type": "com.atproto.repo.applyWrites#delete", collection: "app.bsky.feed.post", rkey: rkey },
            { "$type": "com.atproto.repo.applyWrites#create", collection: "app.bsky.feed.post", rkey: rkey, value: record },
        ];
        await fetch.post(`${site}/xrpc/com.atproto.repo.applyWrites`, { json: { repo: did, writes: writes } });
        learnFromText(draft.body, Date.now());   // an edit is a fresh use of its mentions/tags — date them now

        // Read the post back rather than synthesising the result, so what reaches the timeline is what everyone
        // else sees. That means waiting out TWO steps, not one. The cid changing only says the record was indexed;
        // its embed hydrates separately and a little later, so a post read in between comes back with its media
        // missing — and writing THAT over a good item is worse than writing nothing at all, because the bad item
        // then sits there looking like the edit dropped the attachment. So when the record we just wrote has an
        // embed, wait for the AppView to have one too. Give up quietly past a few seconds: hydration lag is
        // unbounded, and returning nothing just leaves the next refresh to place it.
        const uri = `at://${did}/app.bsky.feed.post/${rkey}`;
        const expectsEmbed = record.embed != null;
        try {
            const view = await poll(async () => {
                const found = (await fetch(`${site}/xrpc/app.bsky.feed.getPosts?uris=${encodeURIComponent(uri)}`).json()).posts?.[0];
                if (found == null || found.cid == draft.metadata.cid) { return null; }
                return (!expectsEmbed || found.embed != null) ? found : null;
            }, { interval: 500, max: 1500, timeout: 5000 });
            const post = postForItem({ post: view }, true);
            return post != null ? [post] : [];
        } catch (error) {
            console.log(`edit committed, but the AppView hasn't caught up: ${error}`);
            return [];
        }
    }
    else {
        throw new Error(`actionId "${actionId}" not implemented`);
    }
}
