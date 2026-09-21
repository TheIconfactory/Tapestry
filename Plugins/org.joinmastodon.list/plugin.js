
// org.joinmastodon.list

if (require('mastodon-shared.js') === false) {
    throw new Error("Failed to load mastodon-shared.js");
}

async function verify() {
    const credentials = await fetch(site + "/api/v1/accounts/verify_credentials").json();

    const userName = "@" + credentials["username"];
    const icon = credentials["avatar"];

    const userId = credentials["id"];
    setItem("userId", userId);

    const lists = await fetch(site + "/api/v1/lists").json();

    const verifyList = normalizeList(list);
    let found = false;
    let displayName = userName;
    for (const listItem of lists) {
        if (listItem.id == verifyList || listItem.title == verifyList) {
            setItem("listId", listItem.id);
            displayName = `${listItem.title} - ${userName}`;
            found = true;
        }
    }

    if (!found) {
        throw new Error("Invalid List Identifier");
    }

    return {
        displayName: displayName,
        icon: icon
    };
}

async function load() {
    var listId = getItem("listId");

    if (listId == null) {
        const jsonObject = await fetch(site + "/api/v1/lists").json();

        const loadList = normalizeList(list);
        for (const listItem of jsonObject) {
            if (listItem.id == loadList || listItem.title == loadList) {
                setItem("listId", listItem.id);
                listId = listItem.id;
            }
        }

        if (listId == null) {
            throw new Error("Invalid List Identifier");
        }
    }

    return await queryStatusesForList(listId);
}

function queryStatusesForList(listId) {

    return new Promise((resolve, reject) => {
        fetch(site + "/api/v1/timelines/list/" + listId + "?limit=40").json()
        .then((jsonObject) => {
            let results = [];
			
            let annotation = Annotation.createWithText(`Posted in ${list}`);

            for (const item of jsonObject) {
                if (item.reblog != null && includeBoosts != "on") {
                    continue;
                }
                if (item.quote != null && includeQuotes != "on") {
                    continue;
                }
                let post = postForItem(item);
                if (post != null) {
                    post.annotations = [annotation].concat(post.annotations ?? []);
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
