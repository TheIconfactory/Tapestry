
// org.jsonfeed

// people who sniff user agents are dumb and their rules are even dumber, because of course we are:
//   a Macintosh
//   with an Intel processor
//   running Mac OS X 10.6.3
//   in Germany
//   using WebKit
//   in an awesome RSS reader
const userAgent = "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_3; de-de) AppleWebKit/531.22.7 (KHTML, like Gecko) NetNewsWire/3.2.7 Tapestry/1.3";

async function verify() {
    let text = await sendRequest(site, "GET", null, {"user-agent": userAgent});
    const jsonObject = JSON.parse(text);
    
    const displayName = jsonObject["title"];
    const baseUrl = jsonObject["home_page_url"];
    
    var icon = null;
    if (jsonObject["icon"] != null) {
        icon = jsonObject["icon"];
        const verification = {
            displayName: displayName,
            icon: icon,
            baseUrl: baseUrl
        };
        processVerification(verification);
    }
    else {
        let icon = await lookupIcon(baseUrl);
        const verification = {
            displayName: displayName,
            icon: icon,
            baseUrl: baseUrl
        };
        processVerification(verification);
    }
}

async function load() {
    const response = await sendConditionalRequest(site, "GET", null, {"user-agent": userAgent});

    if (!response) {
        // null response means 304 Not Modified
        processResults([]);
        return;
    }
    
    const jsonObject = JSON.parse(response);
    
    const feedUrl = jsonObject["home_page_url"];
    
    const items = jsonObject["items"];
    var results = [];
    for (const item of items) {
        let url = item["url"];
        if (true) { // NOTE: If this causes problems, we can put it behind a setting.
            const urlClean = url.split("?").splice(0,1).join();
            const urlParameters = url.split("?").splice(1).join("?");
            if (urlParameters.includes("utm_id") || urlParameters.includes("utm_source") || urlParameters.includes("utm_medium") || urlParameters.includes("utm_campaign")) {
                console.log(`removed parameters: ${urlParameters}`);
                url = urlClean;
            }
        }

        const date = new Date(item["date_published"]); // could also be "date_modified"
        const title = item['title'];
        let content = ""
        if (item['content_html'] != null) {
            content = item['content_html'];
        }
        else if (item['content_text'] != null) {
            content = item['content_text'].replaceAll("\n", "<br/>")
        }
        
        if (includeTags == "on") {
            if (item['tags'] != null) {
                let tags = item['tags'];
                const tagsContent = tags.map(t=>`Tag: "${t}"`).join(', ')
                content = `${content}<p>${tagsContent}</p>`
            }
        }

        const authors = item["authors"];
        
        let linkAttachment = null;
        if (item["external_url"] != null) {
            linkAttachment = LinkAttachment.createWithUrl(item["external_url"]);
        }
        
        let identity = null;
        if (authors != null && authors.length > 0) {
            const authorName = authors[0].name;
            identity = Identity.createWithName(authorName);
            if (authors[0].url != null) {
                identity.uri = authors[0].url;
            }
            if (authors[0].avatar != null) {
                identity.avatar = authors[0].avatar;
            }
        }
        
        const resultItem = Item.createWithUriDate(url, date);
        if (title != null) {
            resultItem.title = title;
        }
        resultItem.body = content;
        resultItem.author = identity;
        if (linkAttachment != null) {
            resultItem.attachments = [linkAttachment];
        }
        
        results.push(resultItem);
    }

    processResults(results);
}
