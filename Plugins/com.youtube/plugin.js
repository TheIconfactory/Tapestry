
// com.youtube

const avatarRegex = /<link rel="image_src" href="([^"]*)">/;
const urlRegex = /(https?:[^\s]*)/g;

async function verify() {
	let xml = await sendRequest(site);
    const jsonObject = await xmlParse(xml);
    
    if (jsonObject.feed != null) {
        // Atom 1.0
        const feedAttributes = jsonObject.feed.link$attrs;
        let baseUrl = null;
        if (feedAttributes instanceof Array) {
            for (const feedAttribute of feedAttributes) {
                if (feedAttribute.rel == "alternate") {
                    baseUrl = feedAttribute.href;
                    break;
                }
            }
        }
        else {
            if (feedAttributes.rel == "alternate") {
                baseUrl = feedAttributes.href;
            }
        }
        const feedName = jsonObject.feed.title;
                
        const extraHeaders = {"user-agent": "WhatsApp/2"}; // avoid EU cookie nonsense
        sendRequest(baseUrl, "GET", null, extraHeaders)
        .then((html) => {
            const match = html.match(avatarRegex);
            const icon = match[1];

            const verification = {
                displayName: feedName,
                icon: icon,
                baseUrl: baseUrl
            };
            processVerification(verification);
        })
        .catch((requestError) => {
            const verification = {
                displayName: feedName,
                icon: "https://www.youtube.com/s/desktop/905763c7/img/favicon_144x144.png",
                baseUrl: baseUrl
            };
            processVerification(verification);
            processError(requestError);
        });
    }
    else if (jsonObject.rss != null) {
        // RSS 2.0
        processError(Error("Invalid feed format"));
    }
    else {
        processError(Error("Unknown feed format"));
    }
}


async function load() {
	let xml = await sendRequest(site);
    let jsonObject = await xmlParse(xml);
            
    if (jsonObject.feed != null) {
        // Atom 1.0
        const feedAttributes = jsonObject.feed.link$attrs;
        let feedUrl = null;
        if (feedAttributes instanceof Array) {
            for (const feedAttribute of feedAttributes) {
                if (feedAttribute.rel == "alternate") {
                    feedUrl = feedAttribute.href;
                    break;
                }
            }
        }
        else {
            if (feedAttributes.rel == "alternate") {
                feedUrl = feedAttributes.href;
            }
        }
        const feedName = jsonObject.feed.title;
        
        let entries = [];
        if (jsonObject.feed.entry != null) {
            const entry = jsonObject.feed.entry;
            if (entry instanceof Array) {
                entries = entry;
            }
            else {
                entries = [entry];
            }
        }
        var results = [];
        for (const entry of entries) {
            const entryAttributes = entry.link$attrs;
            let entryUrl = null;
            if (entryAttributes instanceof Array) {
                for (const entryAttribute of entryAttributes) {
                if (entryAttribute.rel == "alternate") {
                    entryUrl = entryAttribute.href;
                    break;
                }
            }
            }
            else {
                if (entryAttributes.rel == "alternate") {
                    entryUrl = entryAttributes.href;
                }
            }

            const url = entryUrl;
            const date = new Date(entry.published); // could also be "entry.updated"
        
            const videoId = entry["yt:videoId"];
            const embed = `<iframe id="player" type="text/html" width="640" height="390" src="https://www.youtube.com/embed/${videoId}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`
            
            const linkUrl = `https://www.youtube.com/watch?v=${videoId}`;
            const linkAttachment = LinkAttachment.createWithUrl(linkUrl);
            
            const mediaGroup = entry["media:group"];
        
            const title = mediaGroup["media:title"];
            let description = null;
            if (includeDescription == "on") {
                if (mediaGroup["media:description"] != null) {
                    // NOTE: YouTube shorts do not have a description.
                    let rawDescription = mediaGroup["media:description"];
                    let linkedDescription = rawDescription.replace(urlRegex, "<a href=\"$1\">$1</a>");
                    let paragraphs = linkedDescription.split("\n\n");
                    description = paragraphs.map((paragraph) => {
                        let lines = paragraph.split("\n");
                        let breakLines = lines.join("<br/>");
                        return `<p>${breakLines}</p>`
                    }).join("\n")
                }
            }
            const resultItem = Item.createWithUriDate(url, date);
            resultItem.title = title;
            if (description != null) {
                resultItem.body = embed + description;
            }
            else {
                resultItem.body = embed;
            }
            resultItem.attachments = [linkAttachment];
        
            results.push(resultItem);
        }

        processResults(results);
    }
    else if (jsonObject.rss != null) {
        // RSS 2.0
        processError(Error("Invalid feed format"));
    }
    else {
        // Unknown
        processResults([]);
    }
}
