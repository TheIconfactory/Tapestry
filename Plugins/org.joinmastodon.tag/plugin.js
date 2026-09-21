
// org.joinmastodon.tag

if (require('mastodon-shared.js') === false) {
    throw new Error("Failed to load mastodon-shared.js");
}

async function verify() {
    const verifyTag = normalizeTag(tag);
    const url = `${site}/api/v1/timelines/tag/${verifyTag}`;
    const jsonObject = await fetch(url).json();

    if (jsonObject.length > 0) {
        return "#" + verifyTag;
    }
    else {
        throw new Error("No items for tag.");
    }
}

async function load() {
    const loadTag = normalizeTag(tag);
    return await queryStatusesForTag(loadTag);
}

function queryStatusesForTag(tag) {

    return new Promise((resolve, reject) => {
        const url = `${site}/api/v1/timelines/tag/${tag}`;
        fetch(url).json()
        .then((jsonObject) => {
            let results = [];
            for (const item of jsonObject) {
                if (item.quote != null && includeQuotes != "on") {
                    continue;
                }
                let post = postForItem(item);
                if (post != null) {
                    let annotation = Annotation.createWithText(`#${tag.toUpperCase()}`);
                    annotation.uri = `${site}/tags/${tag}`;
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
