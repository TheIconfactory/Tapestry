
// blog.micro

async function verify() {
    // micro.blog's /account/verify wants the app token as a `token` FORM FIELD (not the bearer header, which
    // it ignores here). `authorizedField` has the host fill that field — the connector never handles the token.
    const jsonObject = await fetch.post(`${site}/account/verify`, { authorizedField: "token" }).json();

    if (jsonObject["username"] != null) {
        displayName = "@" + jsonObject["username"];

        var icon = null;
        if (jsonObject["avatar"] != null) {
            icon = jsonObject["avatar"];
        }
        else {
            icon = "https://cdn.micro.blog/images/icons/favicon_192.png";
        }

        const verification = {
            displayName: displayName,
            icon: icon
        };
        return verification;
    }
    else {
        const message = jsonObject["error"] ?? "Invalid response";
        throw new Error(message);
    }
}

async function load() {
    const filterMentions = includeMentions != "on";
	
    const jsonObject = await fetch(`${site}/posts/timeline?count=200`).json();
    const items = jsonObject["items"];
    var results = [];
    for (const item of items) {
        const post = postForItem(item, filterMentions);
        if (post != null) {
            results.push(post);
        }
    }
    return results;
}

async function performAction(actionId, item, actionValue) {
    // 2.0 stores the post id in item.metadata; older items stored it as the
    // action's value. Fall back for those. Removable a few months after 2.0
    // ships publicly, once pre-2.0 items have expired out of catalogs.
    const id = item.metadata?.id ?? actionValue;

    if (actionId == "bookmark") {
        await fetch.post(`${site}/posts/favorites`, { body: `id=${id}` });

        item.actions.delete("bookmark");
        item.actions.add("unbookmark");
        return item;
    }
    else if (actionId == "unbookmark") {
        await fetch.delete(`${site}/posts/favorites/${id}`);

        item.actions.delete("unbookmark");
        item.actions.add("bookmark");
        return item;
    }
    else if (actionId == "replies" || actionId == "thread") {
        const json = await fetch(`${site}/posts/conversation?id=${id}`).json();

        let results = [];
        let replies = json.items;
        replies.reverse(); // the Micro.blog API returns most recent reply first, Tapestry needs opposite order
        for (const reply of replies) {
            results.push(postForItem(reply, false));
        }
        return results;
    }
    else {
        throw new Error(`actionId "${actionId}" not implemented`);
    }
}

function postForItem(item, filterMentions) {
    if (filterMentions) {
        if (item["_microblog"].is_mention) {
            return null;
        }
    }
	
    const author = item.author;
    const identity = Identity.createWithName(author.name);
    identity.uri = author.url;
    identity.avatar = author.avatar;
    identity.username = "@" + author._microblog.username
	
    const url = item.url;
    const date = new Date(item.date_published);
    const content = item.content_html;
    const post = Item.createWithUriDate(url, date);
    post.body = content;
    post.author = identity;
    post.metadata = { id: item.id };
    post.actions.add(item["_microblog"].is_bookmark ? "unbookmark" : "bookmark");
    post.actions.add(item["_microblog"].is_conversation ? "replies" : "thread");
	
    return post;
}
