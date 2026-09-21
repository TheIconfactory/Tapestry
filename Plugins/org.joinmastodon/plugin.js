
// org.joinmastodon

if (require('mastodon-shared.js') === false) {
    throw new Error("Failed to load mastodon-shared.js");
}

async function verify() {
    const jsonObject = await fetch(site + "/api/v1/accounts/verify_credentials").json();

    const instance = site.split("/")[2] ?? "";
    const accountName = jsonObject["display_name"];
    const username = "@" + jsonObject["username"];
    // The instance-qualified handle is kept for accountIdentity so the timeline's "via" label can still
    // tell apart two accounts with the same username on different instances. The feed name itself uses the
    // short form, since that disambiguation is only needed in that one spot.
    const fullUsername = username + "@" + instance;
    const icon = jsonObject["avatar"];

    const userId = jsonObject["id"];
    setItem("userId", userId);

    return {
        displayName: username,
        accountIdentity: Identity.create(accountName, fullUsername, icon)
    };
}

var userId = getItem("userId");

async function fetchFollowedTags() {
    try {
        const jsonArray = await fetch(`${site}/api/v1/followed_tags?limit=400`).json();
        return jsonArray.map(tag => tag.name.toLowerCase());
    }
    catch (error) {
        console.log(`fetchFollowedTags failed: ${error}`);
        return [];
    }
}

async function load() {
    // Resolve once, up front: whether this (authenticated) instance supports authoring quote posts (Mastodon 4.5+ /
    // API v7), into the module-level `quoteCapable` that postForItem reads. getInstance() is cached for a week, so
    // this is a no-op fetch after the first.
    quoteCapable = supportsQuotePosts(await getInstance());

    // Ensure userId BEFORE any section builds items, not lazily in the statuses section: postForItem gates the
    // own-post actions (edit/delete) on it, and the sections run concurrently — home items built while a wiped
    // userId was still being re-fetched would import without those actions. Storage is wiped by the app's
    // Clear Cache (it removes the feed's whole key/value domain), so this isn't a once-ever situation — and the
    // clear can happen under a RUNNING context, so re-read storage here rather than trusting the module var
    // (postForItem reads storage fresh; a stale var would skip the ensure and strand every item without the
    // own-post actions until relaunch).
    userId = getItem("userId");
    if (userId == null) {
        userId = (await fetch(site + "/api/v1/accounts/verify_credentials").json())["id"];
        setItem("userId", userId);
    }

    // NOTE: The home timeline will be filled up to the endDate, if possible.
    let endDate = null;
    let endDateTimestamp = getItem("endDateTimestamp");
    if (endDateTimestamp != null) {
        endDate = new Date(parseInt(endDateTimestamp));
    }

    // The three sections are independent, so run them concurrently — each delivers its items via
    // processResults() as it finishes. (Within a section, ordering-dependent work — followed tags before the
    // home query, home pagination — stays sequential.)
    const tasks = [];

    if (includeHome == "on") {
        tasks.push((async () => {
            console.log(`==== HOME START`);
            const followedTagNames = await fetchFollowedTags();
            const parameters = await queryHomeTimeline(endDate, followedTagNames);
            const results = parameters[0];
            const newestItemDate = parameters[1];
            processResults(results);
            if (newestItemDate) {
                setItem("endDateTimestamp", String(newestItemDate.getTime()));
            }
            console.log(`==== HOME END`);
        })());
    }

    if (includeMentions == "on") {
        tasks.push((async () => {
            console.log(`==== MENTIONS START`);
            const results = await queryMentions();
            console.log(`==== MENTIONS END results = ${results.length}`);
            processResults(results);
        })());
    }

    if (includeStatuses == "on") {
        tasks.push((async () => {
            console.log(`==== STATUSES START`);
            const results = await queryStatusesForUser(userId);
            console.log(`==== STATUSES END results = ${results.length}`);
            processResults(results);
            console.log(`==== STATUSES DONE`);
        })());
    }

    await Promise.all(tasks);

    // All done — returning from load() ends the load (items were delivered incrementally above).
    console.log(`==== LOAD COMPLETE`);
}

function queryHomeTimeline(endDate, followedTagNames) {

    // NOTE: These constants are related to the feed limits within Tapestry - it doesn't store more than
    // 3,000 items or things older than 30 days.
    // In use, the Mastodon API returns a limited number of items (800-ish) over a shorter timespan.
    const maxInterval = 3 * 24 * 60 * 60 * 1000; // days in milliseconds (approximately)
    const maxItems = 800;

    let newestItemDate = null;
    let oldestItemDate = null;
	
    return new Promise((resolve, reject) => {

        // this function is called recursively to load & process batches of posts into a single list of results
        function requestToId(id, endDate, resolve, reject, results = []) {
            let url = null
            if (id == null) {
                url = `${site}/api/v1/timelines/home?limit=40`;
            }
            else {
                url = `${site}/api/v1/timelines/home?limit=40&since_id=1&max_id=${id}`;
            }
			
            console.log(`==== REQUEST id = ${id}`);
			
            fetch(url).json()
            .then((jsonObject) => {
                let lastId = null;
                let lastDate = null;
                let endUpdate = false;
                for (const item of jsonObject) {
                    const date = new Date(item["created_at"]);

                    let post = null;
                    if (item.reblog != null && includeBoosts != "on") {
                        // skip boosts
                    }
                    else if (item.quote != null && includeQuotes != "on") {
                        // skip quotes
                    }
                    else {
                        post = postForItem(item);
                    }

                    // Annotate or filter posts from followed hashtags
                    if (post != null && item.reblog == null && followedTagNames.length > 0) {
                        const itemTags = item.tags;
                        if (itemTags != null && itemTags.length > 0) {
                            const matchedTag = itemTags.find(t => followedTagNames.includes(t.name.toLowerCase()));
                            if (matchedTag != null) {
                                if (includeFollowedHashtags != "on") {
                                    post = null;
                                }
                                else {
                                    let annotation = Annotation.createWithText(`#${matchedTag.name.toUpperCase()}`);
                                    annotation.uri = `${site}/tags/${matchedTag.name.toLowerCase()}`;
                                    post.annotations = [annotation].concat(post.annotations ?? []);
                                }
                            }
                        }
                    }

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
					
                    if (post != null) {
                        results.push(post);
                    }
		
                    lastId = item["id"];
                    lastDate = date;
                }

                if (results.length > maxItems) {
                    console.log(`>>>> MAX`);
                    endUpdate = true;
                }
				
                console.log(`>>>> BATCH results = ${results.length}, lastId = ${lastId}, endUpdate = ${endUpdate}`);
                console.log(`>>>>       last   = ${lastDate}`);
                console.log(`>>>>       newest = ${newestItemDate}`);
				
                // NOTE: endUpdate signifies a date or count threshold has been reached, lastId indicates the API returned no items.
                if (!endUpdate && lastId != null) {
                    requestToId(lastId, endDate, resolve, reject, results);
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
			
        requestToId(null, endDate, resolve, reject);

    });
	
}

async function queryMentions() {
    const jsonObject = await fetch(site + "/api/v1/notifications", { params: { "types[]": "mention", limit: 80 } }).json();
    let results = [];
    for (const item of jsonObject) {
        const postItem = item["status"];
        // NOTE: Not sure why this happens, but sometimes a mention payload doesn't have a status. If that happens, we just skip it.
        if (postItem != null) {
            results.push(postForItem(postItem));
        }
    }
    return results;
}

async function queryStatusesForUser(id) {
    const jsonObject = await fetch(site + "/api/v1/accounts/" + id + "/statuses?limit=40").json();
    let results = [];
    for (const item of jsonObject) {
        if (item.reblog != null && includeBoosts != "on") {
            continue;
        }
        if (item.quote != null && includeQuotes != "on") {
            continue;
        }
        results.push(postForItem(item));
    }
    return results;
}
