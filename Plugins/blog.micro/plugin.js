
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
			const post = postForItem(item, filterMentions);
			if (post != null) {
				results.push(post);
			}
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
		else if (actionId == "replies" || actionId == "thread") {
			const response = await sendRequest(`${site}/posts/conversation?id=${actionValue}`)
			const json = JSON.parse(response);
			
			let results = [];
			let replies = json.items;
			replies.reverse(); // the Micro.blog API returns most recent reply first, Tapestry needs opposite order
			for (const reply of replies) {
				results.push(postForItem(reply, false));
			}
			actionComplete(results);
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

function postForItem(item, filterMentions) {
	if (filterMentions) {
		if (item["_microblog"].is_mention) {
			return null;
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
	if (item["_microblog"].is_conversation) {
		actions["replies"] = actionValue;
	}
	else {
		actions["thread"] = actionValue;
	}

	const author = item.author; 
	const identity = Identity.createWithName(author.name);
	identity.uri = author.url;
	identity.avatar = author.avatar;
	identity.username = "@" + author._microblog.username
	
	const url = item.url;
	const date = new Date(item.date_published);
	const content = item.content_html;
	const post = Item.createWithUriDate(url, date);
	post.body = content;
	post.author = identity;
	post.actions = actions;
	
	return post;
}
