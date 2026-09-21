
// social.bsky.list

if (require('bluesky-shared.js') === false) {
    throw new Error("Failed to load bluesky-shared.js");
}

// Copy link to list:
// https://bsky.app/profile/did:plc:7foutw3hvd7nqwwng5gsmuez/lists/3lml2frpysk2j
// https://bsky.app/profile/gnitsetgnitset.bsky.social/lists/3lml2frpysk2j
//
// ->
//
// API request:
// https://api.bsky.app/xrpc/app.bsky.feed.getListFeed?list=at%3A%2F%2Fdid%3Aplc%3A7foutw3hvd7nqwwng5gsmuez%2Fapp.bsky.graph.list%2F3lml2frpysk2j

async function verify() {
    const profile = await fetch(`${site}/xrpc/app.bsky.actor.getProfile?actor=${account}`).json();

    const did = profile.did;
    setItem("did", did);

    const profileHandle = "@" + shortHandle(profile.handle);

    const listObject = await fetch(`${site}/xrpc/app.bsky.graph.getList?list=at://${did}/app.bsky.graph.list/${listId}`).json();

    const avatar = listObject?.list?.avatar ?? listObject?.list?.creator?.avatar;
    const listName = listObject.list.name;
    const displayName = `${listName} by ${profileHandle}`;
    if (avatar != null) {
        return {
            displayName: displayName,
            icon: avatar
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

    return await queryList(did, listId);
}

function queryList(did, listId) {
    return new Promise((resolve, reject) => {
        fetch(`${site}/xrpc/app.bsky.feed.getListFeed?list=at://${did}/app.bsky.graph.list/${listId}`).json()
        .then((jsonObject) => {
			
            let results = [];
            for (const item of jsonObject.feed) { 
                let post = postForItem(item, false);
                if (post != null) {
                    results.push(post);
                }
            }
            resolve(results);
        })
        .catch((error) => {
            reject(error);
        });
    });
}
