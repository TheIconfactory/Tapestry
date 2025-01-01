
// org.jsonfeed

function verify() {
	sendRequest(site)
	.then((text) => {
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
			lookupIcon(baseUrl).then((icon) => {
				const verification = {
					displayName: displayName,
					icon: icon,
					baseUrl: baseUrl
				};
				processVerification(verification);
			});
		}

	})
	.catch((requestError) => {
		processError(requestError);
	});
}

function load() {
	sendRequest(site)
	.then((text) => {
		const jsonObject = JSON.parse(text);
		//console.log(JSON.stringify(jsonObject, null, "  "));
		
		const feedUrl = jsonObject["home_page_url"];
		
		const items = jsonObject["items"];
		var results = [];
		for (const item of items) {
			const url = item["url"];
			const date = new Date(item["date_published"]); // could also be "date_modified"
			const title = item['title'];
			let content = ""
			if (item['content_html'] != null) {
				content = item['content_html'];
			}
			else if (item['content_text'] != null) {
				content = item['content_text'].replaceAll("\n", "<br/>")
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
			resultItem.title = title;
			resultItem.body = content;
			resultItem.author = identity;
			if (linkAttachment != null) {
				resultItem.attachments = [linkAttachment];
			}
			
			results.push(resultItem);
		}

		processResults(results);
	})
	.catch((requestError) => {
		processError(requestError);
	});	
}
