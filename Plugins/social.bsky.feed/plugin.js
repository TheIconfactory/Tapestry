
// social.bsky.feed

if (require('bluesky-shared.js') === false) {
    throw new Error("Failed to load bluesky-shared.js");
}

async function verify() {
    const profile = await fetch(`${site}/xrpc/app.bsky.actor.getProfile?actor=${account}`).json();

    const did = profile.did;
    setItem("did", did);

    const profileHandle = "@" + shortHandle(profile.handle);

    const feed = await fetch(`${site}/xrpc/app.bsky.feed.getFeedGenerator?feed=at://${did}/app.bsky.feed.generator/${feedId}`).json();

    const feedName = feed.view.displayName;
    const feedAvatar = feed.view.avatar;
    const displayName = `${feedName} by ${profileHandle}`;

    setItem("feedName", feedName);
    setItem("feedAvatar", feedAvatar);

    if (feedAvatar != null) {
        return {
            displayName: displayName,
            icon: feedAvatar
        };
    }
    else {
        return displayName;
    }
}

async function load() {
    var did = getItem("did");
    if (did == null) {
        did = await getAccountDid(account);
        setItem("did", did);
    }

    var feedName = getItem("feedName");
    var feedAvatar = getItem("feedAvatar");
    if (feedName == null || feedAvatar == null) {
        const results = await getFeedInfo(did, feedId);
        setItem("feedName", results[0]);
        setItem("feedAvatar", results[1]);
    }

    return await queryFeedForGenerator(did, feedId, feedName, feedAvatar);
}

function queryFeedForGenerator(did, feedId, feedName, feedAvatar) {
    return new Promise((resolve, reject) => {
        fetch(`${site}/xrpc/app.bsky.feed.getFeed?feed=at://${did}/app.bsky.feed.generator/${feedId}`).json()
        .then((jsonObject) => {
			
            // NOTE: The feed generator returns items that are not ordered by time, and we need time. So we
            // generate a timestamp for this moment in time, and subtract a second from it as we go through
            // the list of items. Yuck.
            let lastTimestamp = (new Date()).getTime();

            let annotation = Annotation.createWithText(`Posted in ${feedName}`);
            annotation.icon = feedAvatar;

            let results = [];
            for (const item of jsonObject.feed) { 
                let post = postForItem(item, false, new Date(lastTimestamp));
                if (post != null) {
                    post.annotations = [annotation].concat(post.annotations ?? []);
                    results.push(post);
                    lastTimestamp -= 1000;
                }
            }
            resolve(results);
        })
        .catch((error) => {
            reject(error);
        });
    });
}
