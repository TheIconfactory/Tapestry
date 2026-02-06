
// xml.feed

// people who sniff user agents are dumb and their rules are even dumber, because of course we are:
//   a Macintosh
//   with an Intel processor
//   running Mac OS X 10.6.3
//   in Germany
//   using WebKit
//   in an awesome RSS reader
const userAgent = "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_3; de-de) AppleWebKit/531.22.7 (KHTML, like Gecko) NetNewsWire/3.2.7 Tapestry/1.3";

async function verify() {
    let xml = await sendRequest(site, "GET", null, {"user-agent": userAgent})
    let jsonObject = await xmlParse(xml);
    
    if (jsonObject.feed != null) {
        // Atom 1.0
        const feedAttributes = jsonObject.feed.link$attrs;
        let baseUrl = null;
        if (feedAttributes instanceof Array) {
            for (const feedAttribute of feedAttributes) {
                if (feedAttribute?.rel == "alternate") {
                    baseUrl = feedAttribute.href;
                    break;
                }
            }
        }
        else {
            if (feedAttributes?.rel == "alternate") {
                baseUrl = feedAttributes.href;
            }
        }
        const displayName = jsonObject.feed.title?.trim();
        let icon = null;
        if (jsonObject.feed.icon != null) {
            icon = jsonObject.feed.icon;
            const verification = {
                displayName: displayName,
                icon: icon,
                baseUrl: baseUrl
            };
            processVerification(verification);
        }
        if (baseUrl != null && icon === null) {
            let siteUrl = baseUrl.split("/").splice(0,3).join("/");
            let icon = await lookupIcon(siteUrl);
            const verification = {
                displayName: displayName,
                icon: icon,
                baseUrl: baseUrl
            };
            processVerification(verification);
        }
        else {
            // try to get icon from the feed
            let feedUrl = null;
            if (feedAttributes instanceof Array) {
                for (const feedAttribute of feedAttributes) {
                    if (feedAttribute?.rel == "self") {
                        feedUrl = feedAttribute.href;
                        break;
                    }
                }
            }
            else {
                if (feedAttributes?.rel == "self") {
                    feedUrl = feedAttributes.href;
                }
            }
            if (feedUrl != null) {
                let siteUrl = feedUrl.split("/").splice(0,3).join("/");
                let icon = await lookupIcon(siteUrl);
                const verification = {
                    displayName: displayName,
                    icon: icon,
                    baseUrl: baseUrl
                };
                processVerification(verification);
            }
            else {
                const verification = {
                    displayName: displayName,
                    icon: null,
                    baseUrl: baseUrl
                };
                processVerification(verification);
            }
        }
        
    }
    else if (jsonObject.rss != null && jsonObject.rss.channel != null) {
        // RSS 2.0
// TODO: Check that XML is good:
// if (jsonObject.rss instanceof Object	&& jsonObject.rss.channel instanceof Object) { ... }

        const baseUrl = jsonObject.rss.channel?.link;
        const displayName = jsonObject.rss.channel?.title?.trim();

// NOTE: In theory, the channel image could be used to get an icon for the feed. But some
// use non-square images that look bad when squished. For example, the New York Times feed
// uses a 240x40 image.
//			if (jsonObject.rss.channel.image != null) {
//				icon = jsonObject.rss.channel.image.url;
//				const verification = {
//					displayName: displayName,
//					icon: icon,
//					baseUrl: baseUrl
//				};
//				processVerification(verification);
//			}
        if (baseUrl != null) {
            let feedUrl = baseUrl.split("/").splice(0,3).join("/");
            let icon = await lookupIcon(feedUrl);
            const verification = {
                displayName: displayName,
                icon: icon,
                baseUrl: baseUrl
            };
            processVerification(verification);
        }
        else {
            const verification = {
                displayName: displayName,
                icon: null,
                baseUrl: null
            };
            processVerification(verification);
        }
    }
    else if (jsonObject["rdf:RDF"] != null) {
        // RSS 1.0
        const baseUrl = jsonObject["rdf:RDF"].channel.link;
        const displayName = jsonObject["rdf:RDF"].channel.title?.trim();

// NOTE: In theory, you can get the icon from the RDF channel. In practice, places like
// Slashdot haven't updated this image since the beginning of this century.
// 			if (jsonObject["rdf:RDF"].channel.image$attrs != null) {
// 				icon = jsonObject["rdf:RDF"].channel.image$attrs["rdf:resource"];
// 				const verification = {
// 					displayName: displayName,
// 					icon: icon,
// 					baseUrl: baseUrl
// 				};
// 				processVerification(verification);
// 			}
        let feedUrl = baseUrl.split("/").splice(0,3).join("/");
        let icon = await lookupIcon(feedUrl);
        const verification = {
            displayName: displayName,
            icon: icon,
            baseUrl: baseUrl
        };
        processVerification(verification);
    }
    else {
        // Unknown
        processError(Error("Unknown feed format"));
    }
}


async function load() {
    const response = await sendConditionalRequest(site, "GET", null, {"user-agent": userAgent})

    if (!response) {
        // null response means 304 Not Modified
        processResults([]);
        return;
    }
    
    let jsonObject = await xmlParse(response);
            
    if (jsonObject.feed != null) {
        // Atom 1.0
        const feedAttributes = jsonObject.feed.link$attrs;
        let feedUrl = null;
        if (feedAttributes instanceof Array) {
            for (const feedAttribute of feedAttributes) {
                if (feedAttribute?.rel == "alternate") {
                    feedUrl = feedAttribute.href;
                    break;
                }
            }
        }
        else if (feedAttributes?.rel == "alternate") {
            feedUrl = feedAttributes.href;
        } else if (
            jsonObject.feed.id.startsWith("http://") ||
            jsonObject.feed.id.startsWith("https://")
        ) {
            feedUrl = jsonObject.feed.id
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
                // Posts need to have a link and if we didn't find one
                // with rel == "alternate" then we'll use the first link.
                if (!entryUrl && entryAttributes.length > 0) {
                    entryUrl = entryAttributes[0].href;
                }
            }
            else {
                if (entryAttributes.rel == "alternate" || entryAttributes.rel == null) {
                    entryUrl = entryAttributes.href;
                }
            }

            let url = entryUrl;
            if (true) { // NOTE: If this causes problems, we can put it behind a setting.
                const urlClean = url.split("?").splice(0,1).join();
                const urlParameters = url.split("?").splice(1).join("?");
                if (urlParameters.includes("utm_id") || urlParameters.includes("utm_source") || urlParameters.includes("utm_medium") || urlParameters.includes("utm_campaign")) {
                    console.log(`removed parameters: ${urlParameters}`);
                    url = urlClean;
                }
            }

            let date = null;
            if (entry.published) {
                date = new Date(entry.published);
            }
            else if (entry.updated) {
                date = new Date(entry.updated);
            }
            else {
                date = new Date();
            }
            const title = extractString(entry.title);
            
            let content = ""
            if (entry.content$attrs != null && entry.content$attrs["type"] == "xhtml") {
                content = entry.content$xhtml;
            }
            else {
                content = extractString((entry.content ?? entry.summary), true);
            }

            if (includeCategories == "on") {
                if (entry.category$attrs != null) {
                    let categories = null;
                    if (Array.isArray(entry.category$attrs)) {
                        categories = entry.category$attrs;
                    }
                    else {
                        categories = [entry.category$attrs];
                    }
                    const categoriesContent = categories.map(c=>`Category: "${c["term"]}"`).join(', ')
                    content = `${content}<p>${categoriesContent}</p>`
                }
            }
            
            var identity = null;
            if (entry.author != null) {
                let authorName = entry.author.name;
                if (authorName != null) {
                    if (authorName instanceof Array) {
                        authorName = authorName.join(", ");
                    }
                    else {
                        authorName = authorName.trim();
                    }
                    identity = Identity.createWithName(authorName);
                    if (entry.author.uri != null) {
                        identity.uri = entry.author.uri;
                    }
                }
            }
            
            const resultItem = Item.createWithUriDate(url, date);
            if (title != null) {
                resultItem.title = title;
            }
            if (content != null) {
                resultItem.body = content;
            }
            if (identity != null) {
                resultItem.author = identity;
            }
            if (entryAttributes instanceof Array) {
                const attachments = entryAttributes
                .filter(e => {
                    if (e.type) {
                        // Check for a MIME type that suggests this is an image, e.g. image/jpeg.
                        return e.type.startsWith("image/");
                    } else {
                        return false;
                    }
                })
                .map(link => {
                    const attachment = MediaAttachment.createWithUrl(link.href);
                    attachment.text = link.title || link.text;
                    return attachment;
                })
                if (attachments.length > 0) {
                    resultItem.attachments = attachments;
                }
            }
            else {
                // extract any media from RSS: https://www.rssboard.org/media-rss
                if (entry["media:group"] != null) {
                    const mediaGroup = entry["media:group"];

                    const mediaAttributes = mediaGroup["media:thumbnail$attrs"];
                    let attachment = attachmentForAttributes(mediaAttributes);
                    if (attachment != null) {
                        resultItem.attachments = [attachment];
                    }
                }
                else if (entry["media:thumbnail$attrs"] != null) {
                    const mediaAttributes = entry["media:thumbnail$attrs"];
                    let attachment = attachmentForAttributes(mediaAttributes);
                    if (attachment != null) {
                        resultItem.attachments = [attachment];
                    }
                }
                else if (entry["media:content$attrs"] != null) {
                    const mediaAttributes = entry["media:content$attrs"];
                    let attachment = attachmentForAttributes(mediaAttributes);
                    if (attachment != null) {
                        resultItem.attachments = [attachment];
                    }
                }
            }

            results.push(resultItem);
        }

        processResults(results);
    }
    else if (jsonObject.rss != null && jsonObject.rss.channel != null) {
        // RSS 2.0
        const feedUrl = jsonObject.rss.channel?.link;

        let items = [];
        if (jsonObject.rss.channel.item != null) {
            const item = jsonObject.rss.channel.item;
            if (item instanceof Array) {
                items = item;
            }
            else {
                items = [item];
            }
        }

        let results = [];
        for (const item of items) {
            if (item.link == null) {
                continue;
            }

            let itemDate = item["pubDate"] ?? item["dc:date"] ?? item["a10:updated"];
            if (itemDate?.endsWith(" Z")) { // the Date parser is pretty dumb
                itemDate = itemDate.slice(0, -2) + "GMT";
            }
            const date = (itemDate == null ? new Date() : new Date(itemDate));
            
            let url = item.link;
            if (true) { // NOTE: If this causes problems, we can put it behind a setting.
                const urlClean = url.split("?").splice(0,1).join();
                const urlParameters = url.split("?").splice(1).join("?");
                if (urlParameters.includes("utm_id") || urlParameters.includes("utm_source") || urlParameters.includes("utm_medium") || urlParameters.includes("utm_campaign")) {
                    console.log(`removed parameters: ${urlParameters}`);
                    url = urlClean;
                }
            }
            
            let title = extractString(item.title);
            let content = extractString((item["content:encoded"] ?? item.description), true);
            
            if (includeCategories == "on" && item.category != null) {
                let categories = null;
                if (Array.isArray(item.category)){
                    categories = item.category
                }
                else {
                    categories = [item.category]
                }
                const categoriesContent = categories.map(c=>`Category: "${c}"`).join(', ')
                content = `${content}<p>${categoriesContent}</p>`
            }

            let identity = null;
            let authorName = item["dc:creator"] ?? item["author"];
            if (authorName != null) {
                if (authorName instanceof Array) {
                    authorName = authorName.join(", ");
                }
                else {
                    authorName = authorName.trim();
                }
                identity = Identity.createWithName(authorName);
                identity.uri = feedUrl;
            }
            
            const resultItem = Item.createWithUriDate(url, date);
            if (title != null) {
                resultItem.title = title;
            }
            if (content != null) {
                resultItem.body = content;
            }
            if (identity != null) {
                resultItem.author = identity;
            }
        
            let attachments = []
            
            // extract any media from RSS: https://www.rssboard.org/media-rss
            if (item["media:group"] != null) {
                const mediaGroup = item["media:group"];

                const mediaAttributes = mediaGroup["media:thumbnail$attrs"];
                let attachment = attachmentForAttributes(mediaAttributes);
                if (attachment != null) {
                    attachments.push(attachment);
                }
            }
            else if (item["media:thumbnail$attrs"] != null) {
                const mediaAttributes = item["media:thumbnail$attrs"];
                let attachment = attachmentForAttributes(mediaAttributes);
                if (attachment != null) {
                    attachments.push(attachment);
                }
            }
            else if (item["media:content$attrs"] != null) {
                const mediaAttributes = item["media:content$attrs"];
                let attachment = attachmentForAttributes(mediaAttributes);
                if (attachment != null) {
                    attachments.push(attachment);
                }
            }
            else if (item["enclosure$attrs"] != null) {
                let enclosure = item["enclosure$attrs"];
                if (enclosure.url != null) {
                    let attachment = MediaAttachment.createWithUrl(enclosure.url);
                    attachments.push(attachment);
                }
            }
            
            // add link attachment for link that isn't on this site (e.g. a link blog)
            // but only if there isn't media already attached
            if (attachments.length == 0 && feedUrl != null) {
                let linkPrefix = url.split("/").splice(0,3).join("/");
                let feedPrefix = feedUrl.split("/").splice(0,3).join("/");
                if (linkPrefix != feedPrefix) {
                    let attachment = LinkAttachment.createWithUrl(item["link"]);
                    attachments.push(attachment);
                }
            }
            
            if (attachments.length > 0) {
                resultItem.attachments = attachments;
            }
            
            results.push(resultItem);
        }

        processResults(results);
    }
    else if (jsonObject["rdf:RDF"] != null) {
        // RSS 1.0
        const feedUrl = jsonObject["rdf:RDF"].channel.link;
        const feedName = jsonObject["rdf:RDF"].channel.title;

        const item = jsonObject["rdf:RDF"].item;
        let items = null;
        if (item instanceof Array) {
            items = item;
        }
        else {
            items = [item];
        }
        var results = [];
        for (const item of items) {
            if (item["dc:date"] == null) {
                continue;
            }
            
            let url = item.link;
            if (true) { // NOTE: If this causes problems, we can put it behind a setting.
                const urlClean = url.split("?").splice(0,1).join();
                const urlParameters = url.split("?").splice(1).join("?");
                if (urlParameters.includes("utm_id") || urlParameters.includes("utm_source") || urlParameters.includes("utm_medium") || urlParameters.includes("utm_campaign")) {
                    console.log(`removed parameters: ${urlParameters}`);
                    url = urlClean;
                }
            }

            const date = new Date(item["dc:date"]);
            let title = extractString(item.title);
            let content = extractString(item.description, true);

            let identity = null;
            let authorName = item["dc:creator"];
            if (authorName != null) {
                if (authorName instanceof Array) {
                    authorName = authorName.join(", ");
                }
                else {
                    authorName = authorName.trim();
                }
                identity = Identity.createWithName(authorName);
                identity.uri = feedUrl;
            }
            
            const resultItem = Item.createWithUriDate(url, date);
            if (title != null) {
                resultItem.title = title;
            }
            if (content != null) {
                resultItem.body = content;
            }
            if (identity != null) {
                resultItem.author = identity;
            }
                
            results.push(resultItem);
        }

        processResults(results);
    }
    else {
        // Unknown
        processResults([]);
    }
}

function attachmentForAttributes(mediaAttributes) {
	let attachment = null;
	if (mediaAttributes != null && mediaAttributes.url != null) {
		let url = mediaAttributes.url;
		if (url.includes("&amp;")) { // attempt to make an invalid URL into a valid one: looking at you Daily Beast
			url = url.replaceAll("&amp;", "&");
		}
		attachment = MediaAttachment.createWithUrl(url);
		if (mediaAttributes.width != null && mediaAttributes.height != null) {
			let width = mediaAttributes.width;
			let height = mediaAttributes.height;
			attachment.aspectSize = { width: width, height: height };
		}
	}
	return attachment;
}

function extractString(node, allowHTML = false) {
	// people love to put HTML in title & descriptions, where it's not allowed - this is an
	// imperfect attempt to undo that damage
	if (node != null) {
		if (typeof(node) == "string") {
			return node.trim();
		}
		else if (typeof(node) == "object") {
			// do a traversal of the node graph to generate a string representation of <p> and <a> elements
			if (node["p"] != null) {
				if (node["p"] instanceof Array) {
					let value = "";
					for (const childNode of node["p"]) {
						const string = extractString(childNode, allowHTML);
						if (allowHTML) {
							value += `<p>${string}</p>\n`;
						}
						else {
							value += string;
						}
					}
					return value;
				}
				else {
					const string = extractString(node["p"], allowHTML);
					if (allowHTML) {
						return `<p>${string}</p>\n`;
					}
					else {
						return string;
					}
				}
			}
			else if (node["a"] != null) {
				if (node["a"] instanceof Array) {
					let value = "";
					for (const childNode of node["a"]) {
						const string = extractString(childNode, allowHTML);
						if (allowHTML && node["a$attrs"]?.href != null) {
							value += `<a href="${node["a$attrs"]?.href}">${string}</a>`;
						}
						else {
							value += string;
						}
					}
					return value;
				}
				else {
					const string = extractString(node["a"], allowHTML);
					if (allowHTML && node["a$attrs"]?.href != null) {
						return `<a href="${node["a$attrs"]?.href}">${string}</a>`;
					}
					else {
						return string;
					}
				}
			}
		}
		else {
			console.log(node);
		}
	}
	
	return null;
}
