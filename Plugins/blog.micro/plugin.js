
// blog.micro

function verify() {
	//sendRequest(site + "/account/verify", "POST", "token=__bearerToken__");
	const url = site + "/account/verify";
	sendRequest(url, "POST", "token=__ACCESS_TOKEN__")
	.then((text) => {
		const jsonObject = JSON.parse(text);
		
		if (jsonObject["username"] != null) {
			displayName = "@" + jsonObject["username"];

			var icon = null;
			if (jsonObject["avatar"] != null) {
				icon = jsonObject["avatar"];
			}
			else {
				icon = "https://cdn.micro.blog/images/icons/favicon_192.png";
			}
			
			const verification = {
				displayName: displayName,
				icon: icon
			};
			processVerification(verification);
		}
		else {
			const message = jsonObject["error"] ?? "Invalid response";
			processError(Error(message));
		}
	})
	.catch((requestError) => {
		processError(requestError);
	});
}

function load() {
	const filterMentions = includeMentions != "on";
	
	sendRequest(site + "/posts/timeline?count=200", "GET")
	.then((text) => {
		const jsonObject = JSON.parse(text);
		const items = jsonObject["items"];
		var results = [];
		for (const item of items) {
			if (filterMentions) {
				if (item["_microblog"].is_mention) {
					continue;
				}
			}
			
			const author = item.author; 
			const identity = Identity.createWithName(author.name);
			identity.uri = author.url;
			identity.avatar = author.avatar;
			identity.username = "@" + author._microblog.username
			
			const url = item.url;
			const date = new Date(item.date_published);
			const content = item.content_html;
			const resultItem = Item.createWithUriDate(url, date);
			resultItem.body = content;
			resultItem.author = identity;
			
			results.push(resultItem);
		}
		processResults(results);
	})
	.catch((requestError) => {
		processError(requestError);
	});	
}
