
// org.joinmastodon.account

if (require('mastodon-shared.js') === false) {
    throw new Error("Failed to load mastodon-shared.js");
}

async function verify() {
    const verifyAccount = normalizeAccount(account);
    const url = `${site}/api/v1/accounts/lookup?acct=${verifyAccount}`;
    const jsonObject = await fetch(url).json();

    let displayName = "";
    if (jsonObject.display_name != null && jsonObject.display_name.length > 0) {
        displayName = jsonObject.display_name;
    }
    else {
        displayName = "@" + jsonObject.username;
    }

    const id = jsonObject.id;
    setItem("id", id);

    if (jsonObject.avatar != null) {
        return {
            displayName: displayName,
            icon: jsonObject.avatar
        };
    }
    else {
        return displayName;
    }
}

async function load() {
    var id = getItem("id");

    if (id == null) {
        const loadAccount = normalizeAccount(account);
        const url = `${site}/api/v1/accounts/lookup?acct=${loadAccount}`;
        id = (await fetch(url).json()).id;
        setItem("id", id);
    }

    return await queryStatusesForUser(id);
}

function queryStatusesForUser(id) {

    return new Promise((resolve, reject) => {
        fetch(site + "/api/v1/accounts/" + id + "/statuses?limit=40").json()
        .then((jsonObject) => {
            let results = [];
            for (const item of jsonObject) {
                let post = null;

                if (item.quote != null && includeQuotes != "on") {
                    // skip quotes
                }
                else if (item.reblog != null) {
                    if (includeBoosts == "on") {
                        post = postForItem(item);
                    }
                }
                else if (item.in_reply_to_account_id != null && item.in_reply_to_account_id != id) {
                    if (includeReplies == "on") {
                        post = postForItem(item);
                    }
                }
                else {
                    post = postForItem(item);
                }

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
