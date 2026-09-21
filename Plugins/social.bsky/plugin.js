
// social.bsky

if (require('bluesky-shared.js') === false) {
    throw new Error("Failed to load bluesky-shared.js");
}

async function verify() {
    const session = await fetch(site + "/xrpc/com.atproto.server.getSession").json();
    // The full handle is kept for accountIdentity so the timeline's "via" label can still disambiguate
    // accounts when needed; the feed name uses the shortened form.
    const fullUsername = "@" + session.handle;
    const username = "@" + shortHandle(session.handle);
    const did = session.did;

    setItem("did", did);
    setItem("didSelf", did);

    const profile = await fetch(site + `/xrpc/app.bsky.actor.getProfile?actor=${did}`).json();
    return {
        displayName: username,
        accountIdentity: Identity.create(profile.displayName, fullUsername, profile.avatar)
    };
}

async function load() {
    // NOTE: The timeline will be filled up to the endDate, if possible.
    let endDate = null;
    let endDateTimestamp = getItem("endDateTimestamp");
    if (endDateTimestamp != null) {
        endDate = new Date(parseInt(endDateTimestamp));
    }

    let didSelf = getItem("didSelf");
    if (didSelf == null) {
        didSelf = await getSessionDid();
        setItem("didSelf", didSelf);
    }

    // The timeline and mentions sections are independent, so run them concurrently — each delivers its items
    // via processResults() as it finishes. (The session DID lookup above is a shared prerequisite, and the
    // timeline's cursor pagination chains — both stay sequential.)
    const tasks = [];

    if (includeHome == "on") {
        tasks.push((async () => {
            const parameters = await queryTimeline(endDate);
            const results = parameters[0];
            const newestItemDate = parameters[1];
            processResults(results);
            if (newestItemDate != null) {
                setItem("endDateTimestamp", String(newestItemDate.getTime()));
            }
        })());
    }

    if (includeMentions == "on" || includeReplies == "on") {
        tasks.push((async () => {
            const results = await queryMentions();
            processResults(results);
        })());
    }

    await Promise.all(tasks);

    // All done — returning from load() ends the load (items were delivered incrementally above).
}

function queryTimeline(endDate) {

    // NOTE: These constants are related to the feed limits within Tapestry - it doesn't store more than
    // 3,000 items or things older than 30 days.
    // The Bluesky API is fast and can return the maximum number of items with 30 seconds, but a week's
    // worth of content feels like a good amount to backfill.
    const maxInterval = 7 * 24 * 60 * 60 * 1000; // days in milliseconds (approximately)
    const maxItems = 1000;

    let newestItemDate = null;
    let oldestItemDate = null;

    return new Promise((resolve, reject) => {

        // this function is called recursively to load & process batches of posts into a single list of results
        function requestToCursor(cursor, endDate, resolve, reject, results = []) {
            let url = null
            if (cursor == null) {
                //console.log("cursor = none");
                url = `${site}/xrpc/app.bsky.feed.getTimeline?algorithm=reverse-chronological&limit=50`;
            }
            else {
                //console.log(`cursor = ${cursor}`);
                url = `${site}/xrpc/app.bsky.feed.getTimeline?algorithm=reverse-chronological&limit=50&cursor=${cursor}`;
            }
			
            console.log(`==== REQUEST cursor = ${cursor}`);
			
            fetch(url).json()
            .then((jsonObject) => {
                let firstId = null;
                let firstDate = null;
                let lastId = null;
                let lastDate = null;
                let endUpdate = false;

                const items = jsonObject.feed
                for (const item of items) {
                    const post = postForItem(item, true, null, false);
                    if (post != null) {
                        results.push(post);
						
                        let date = new Date(item.post.indexedAt); // date of the post
                        if (item.reason != null && item.reason.$type == "app.bsky.feed.defs#reasonRepost") {
                            date = new Date(item.reason.indexedAt); // date of the repost
                        }

                        const currentId = item.post.uri.split("/").pop();

                        if (firstId == null) {
                            firstId = currentId;
                            firstDate = date;
                        }
                        lastId = currentId;						
                        lastDate = date;
						
                        if (!endUpdate && date < endDate) {
                            console.log(`>>>> END date = ${date}`);
                            endUpdate = true;
                        }
                        if (date > newestItemDate) {
                            console.log(`>>>> NEW date = ${date}`);
                            newestItemDate = date;
                        }
                        if (date < oldestItemDate) {
                            console.log(`>>>> OLD date = ${date}`);
                            endUpdate = true;
                        }

                    }
                }
                if (results.length > maxItems) {
                    console.log(`>>>> MAX`);
                    endUpdate = true;
                }
				
                console.log(`>>>> BATCH results = ${results.length}, lastId = ${lastId}, endUpdate = ${endUpdate}`);
                console.log(`>>>>       first  = ${firstDate}`);
                console.log(`>>>>       last   = ${lastDate}`);
                console.log(`>>>>       newest = ${newestItemDate}`);
				
                const cursor = jsonObject.cursor;			

                if (!endUpdate && cursor != null) {
                    requestToCursor(cursor, endDate, resolve, reject, results);
                }
                else {
                    resolve([results, newestItemDate]);
                }
            })
            .catch((error) => {
                reject(error);
            });	
        }

        console.log(`>>>> START endDate = ${endDate}`);
		
        let nowTimestamp = (new Date()).getTime();
        let pastTimestamp = (nowTimestamp - maxInterval);
        oldestItemDate = new Date(pastTimestamp);
        console.log(`>>>> OLD date = ${oldestItemDate}`);

        requestToCursor(null, endDate, resolve, reject);
    });
	
}

async function queryMentions() {
    // `reasons` filters server-side, so the page holds only posts we'd hydrate anyway instead of mostly likes/follows.
    const reasons = [];
    if (includeMentions == "on") { reasons.push("mention"); }
    if (includeReplies == "on") { reasons.push("reply"); }
    const url = `${site}/xrpc/app.bsky.notification.listNotifications?limit=100&` + reasons.map((reason) => `reasons=${reason}`).join("&");
    const notifications = (await fetch(url).json()).notifications ?? [];

    // A notification carries only the bare record — no viewer state, no counts — so the item's actions can't be built
    // from it. Hydrate the posts and build them exactly like timeline items; the notification only supplies the label.
    const views = await postViewsForUris(notifications.map((notification) => notification.uri));

    let results = [];
    for (const notification of notifications) {
        const view = views.get(notification.uri);
        if (view == null) { continue; }   // gone since the notification fired
        const post = postForItem({ post: view }, true);
        if (post != null) {
            post.annotations = [Annotation.createWithText(notification.reason == "mention" ? "MENTION" : "REPLY")];
            results.push(post);
        }
    }
    return results;
}
