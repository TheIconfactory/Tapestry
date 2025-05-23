
// blog.micro

async function verify() {
	try {
		const text = await sendRequest(`${site}/account/verify`, "POST", "token=__ACCESS_TOKEN__")
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
	}
	catch (error) {
		processError(error);
	}
}

async function load() {
	const filterMentions = includeMentions != "on";
	
	try {
		const text = await sendRequest(`${site}/posts/timeline?count=200`);
		const jsonObject = JSON.parse(text);
		const items = jsonObject["items"];
		var results = [];
		for (const item of items) {
			if (filterMentions) {
				if (item["_microblog"].is_mention) {
					continue;
				}
			}
			
			let actions = {};
			let actionValue = item.id;
			if (item["_microblog"].is_bookmark) {
				actions["unbookmark"] = actionValue;
			}
			else {
				actions["bookmark"] = actionValue;
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
			resultItem.actions = actions;
			
			results.push(resultItem);
		}
		processResults(results);
	}
	catch (error) {
		processError(error);
	}
}

async function performAction(actionId, actionValue, item) {
	let actions = item.actions;
	
	try {	
		if (actionId == "bookmark") {
			const text = await sendRequest(`${site}/posts/favorites`, "POST", `id=${actionValue}`)
	
			delete actions["bookmark"];
			actions["unbookmark"] = actionValue;
			item.actions = actions;
			actionComplete(item, null);
		}
		else if (actionId == "unbookmark") {
			const text = await sendRequest(`${site}/posts/favorites/${actionValue}`, "DELETE")

			delete actions["unbookmark"];
			actions["bookmark"] = actionValue;
			item.actions = actions;
			actionComplete(item, null);
		}
		else {
			let error = new Error(`actionId "${actionId}" not implemented`);
			actionComplete(null, error);
		}
	}
	catch (error) {
		actionComplete(null, error);
	}
}
