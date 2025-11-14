
// com.tumblr - shared

async function performAction(actionId, actionValue, item) {
	let actions = item.actions;
	let actionValues = JSON.parse(actionValue);

	try {
		let blogName = getItem("blogName");
		if (blogName == null) {
			blogName = getBlogName(await getUserInfo());
			setItem("blogName", blogName);
		}

		let date = new Date().toISOString();
		if (actionId == "like") {
			const url = `${site}/v2/user/like`;
			const jsonObject = await sendAction(url, actionValue);
			if (jsonObject != null) {
				if (jsonObject?.meta?.status == 200) {			
					delete actions["like"];
					actions["unlike"] = actionValue;
					item.actions = actions;
					actionComplete(item, null);
				}
				else {
					let error = new Error(`Like failed with ${jsonObject?.meta?.status}`);
					actionComplete(null, error);
				}
			}
		}
		else if (actionId == "unlike") {
			const url = `${site}/v2/user/unlike`;
			const jsonObject = await sendAction(url, actionValue);
			if (jsonObject != null) {
				if (jsonObject?.meta?.status == 200) {			
					delete actions["unlike"];
					actions["like"] = actionValue;
					item.actions = actions;
					actionComplete(item, null);
				}
				else {
					let error = new Error(`Unlike failed with ${jsonObject?.meta?.status}`);
					actionComplete(null, error);
				}
			}
		}
		else if (actionId == "reblog") {
			const url = `${site}/v2/blog/${blogName}/post/reblog`;
			const jsonObject = await sendAction(url, actionValue);
			if (jsonObject != null) {
				if (jsonObject?.meta?.status == 201) {
					delete actions["reblog"];
					actions["unreblog"] = actionValue;
					item.actions = actions;
					actionComplete(item, null);
				}
				else {
					let error = new Error(`Reblog failed with ${jsonObject?.meta?.status}`);
					actionComplete(null, error);
				}
			}
		}
 		else if (actionId == "unreblog") {
 			// the unreblog action is ignored (the post needs to be removed on the Tumblr site)
			actionComplete(null, null);
 		}
 		else if (actionId == "notes" || actionId == "trail") {
			const postUrl = `${site}/v2/blog/${actionValues["blog_name"]}/posts/${actionValues["id"]}`;
			const notesUrl = `${site}/v2/blog/${actionValues["blog_name"]}/notes?id=${actionValues["id"]}&mode=all`;
			const originalPostUrl = `${site}/v2/blog/${actionValues["original_blog_name"]}/posts/${actionValues["original_id"]}`;

			const extraHeaders = { "content-type": "application/json; charset=utf8", "accept": "application/json" };

			// try to get the original post to replace the reblogged post			
			let originalPost = null;
			try {
				const originalPostResponse = await sendRequest(originalPostUrl, "GET", null, extraHeaders);
				const originalPostJson = JSON.parse(originalPostResponse);
				const originalPostItem = originalPostJson.response;
				originalPost = postForItem(originalPostItem);
			}
			catch (error) {
				console.log(`notes: original error = ${error}`);
			}

			let trailPosts = [];
			try {
				const postResponse = await sendRequest(postUrl, "GET", null, extraHeaders);
				const postJson = JSON.parse(postResponse);
				const postItem = postJson.response;
				if (originalPost == null) {
					originalPost = postForItem(postItem);
				}
				if (postItem.trail != null && postItem.trail.length > 1) {
					let trails = postItem.trail.slice(1);
					for (const trail of trails) {
						const post = await postForTrail(trail, originalPost.date);
						if (post != null) {
							trailPosts.push(post);
						}
					}
				}
			}
			catch (error) {
				console.log(`notes: post error = ${error}`);
			}

			let notePosts = [];
			try {
				const notesResponse = await sendRequest(notesUrl, "GET", null, extraHeaders);
				const notesJson = JSON.parse(notesResponse);
				const notes = notesJson?.response.notes;
				for (const note of notes) {
					const post = postForNote(note);
					if (post != null) {
						notePosts.push(post);
					}
				}
			}
			catch (error) {
				console.log(`notes: notes error = ${error}`);
			}

			let results = [];

			if (originalPost != null) {
				results.push(originalPost);
			}
			else {
				results.push(item);
			}
			results.push(...trailPosts);
			results.push(...notePosts);

			
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

function test(item)
{
	console.log(`item = ${item}`);
}

async function sendAction(url, parameters) {
	const extraHeaders = { "content-type": "application/json; charset=utf8", "accept": "application/json" };
	const text = await sendRequest(url, "POST", parameters, extraHeaders, true);
	const response = JSON.parse(text);
	if (response.status == 401) {
		raiseAuthorizationUpdate();
		const authorizationError = new Error("Tumblr authorization is invalid");
		actionComplete(null, authorizationError);
		return null;
	}
	else {
		return JSON.parse(response.body);
	}
}

function raiseAuthorizationUpdate() {
	const blogName = getItem("blogName");
	raiseCondition("authorize", "Authorization needs update", `Tumblr feed **${blogName}** needs to be reauthorized to use actions.`)
}

async function getUserInfo() {
	const text = await sendRequest(site + "/v2/user/info");
	const jsonObject = JSON.parse(text);
	return jsonObject.response.user;
}

function getBlogName(user) {
	const blogs = user.blogs;
	const blog = blogs[0];
	return blog.name;
}

function postForNote(note) {
	let identity = Identity.createWithName(note.blog_name);
	identity.uri = note.blog_url;
	if (note.avatar_url != null) {
		if (note.avatar_url["64"] != null) {
			identity.avatar = note.avatar_url["64"];
		}
		else if (note.avatar_url["128"] != null) {
			identity.avatar = note.avatar_url["128"];
		}
	}
	
	let text = null;
	switch (note.type) {
		case "like":
			if (includeAllNotes == "on") {
				text = "Liked post";
			}
			break;
		case "reblog":
			if (includeAllNotes == "on") {
				text = `Reblogged from <em>${note.reblog_parent_blog_name}</em>`;
			}
			break;
		case "reply":
			if (note.reply_text != null) {
				text = note.reply_text;
				let textFormats = note.formatting;
				if (textFormats != null && textFormats.length > 0) {
					let formattedText = formatText(text, textFormats);
					//console.log(`    formattedText = ${formattedText}`);
					text = formattedText;
				}
			}
			else {
				text = "Replied";
			}
			break;
		case "posted":
			if (includeAllNotes == "on") {
				text = "Posted";
			}
			break;
		default:
			if (includeAllNotes == "on") {
				text = `Unknown type: ${note.type}`;
			}
			break;
	}
	
	if (text != null) {
		const uniqueBlogUrl = `${note.blog_url}?${note.timestamp}`;
		const date = new Date(note.timestamp * 1000); // timestamp is seconds since the epoch, convert to milliseconds

		const annotation = Annotation.createWithText("NOTE");

		const post = Item.createWithUriDate(uniqueBlogUrl, date);
		post.body = text;
		if (identity != null) {
			post.author = identity;
		}
		post.annotations = [annotation];
		
		return post;
	}
	
	return null;
}

async function postForTrail(trail, fallbackDate) {
	if (trail.blog != null) {
		// try to get the post for the trail item and record its date	
		let trailDate = null;
		try {
			const postUrl = `${site}/v2/blog/${trail.blog.name}/posts/${trail.post.id}`;
			const extraHeaders = { "content-type": "application/json; charset=utf8", "accept": "application/json" };
			const response = await sendRequest(postUrl, "GET", null, extraHeaders);
			const json = JSON.parse(response);
			if (json.response.timestamp != null) {
				trailDate = new Date(json.response.timestamp * 1000);
			}
		}
		catch (error) {
			console.log(`postForTrail: error = ${error}`);
		}

		const blog = trail.blog;
		let identity = Identity.createWithName(blog.name);
		identity.uri = blog.url;
		identity.username = blog.title;
		if (blog.avatar != null && blog.avatar.length > 0) {
			identity.avatar = blog.avatar[0].url;
		}
		else {
			identity.avatar = "https://api.tumblr.com/v2/blog/" + blog.name + "/avatar/96";
		}

		
		let contentResults = processContentBlocks(trail.content, trail.layout);
		let body = contentResults[0];
		let attachments = contentResults[1];
	
		const trailUrl = `${trail.blog.url}/post/${trail.post.id}`;

		const post = Item.createWithUriDate(trailUrl, trailDate ?? fallbackDate);
		post.body = body;
		post.author = identity;
		if (attachments.length != 0) {
			post.attachments = attachments;
		}
		
		return post;
	}
	else if (trail.broken_blog_name != null) {
		let identity = Identity.createWithName(trail.broken_blog_name);
		identity.avatar = "https://api.tumblr.com/v2/blog/" + trail.broken_blog_name + "/avatar/96";
		
		let contentResults = processContentBlocks(trail.content, trail.layout);
		let body = contentResults[0];
		let attachments = contentResults[1];
	
		const trailUrl = `https://www.tumblr.com/blog/${trail.broken_blog_name}`;

		const post = Item.createWithUriDate(trailUrl, fallbackDate);
		post.body = body;
		post.author = identity;
		if (attachments.length != 0) {
			post.attachments = attachments;
		}
		
		return post;
	}
		
	return null;
}

async function postForElement(element) {
	try {
		const blogName = element.blog.name;
		const postId = element.id_string;
		
		const postUrl = `${site}/v2/blog/${blogName}/posts/${postId}`;
		const extraHeaders = { "content-type": "application/json; charset=utf8", "accept": "application/json" };
		const response = await sendRequest(postUrl, "GET", null, extraHeaders);
		const json = JSON.parse(response);
		const item = json.response;
		let post = postForItem(item);
		
		return post;
	}
	catch (error) {
		console.log(`postForElement: error = ${error}`);
		if (! element.community.is_member) {
			throw new Error("You are no longer a member of this community. Join it on Tumblr.");
		}
	}

	return null;
}

function postForItem(item) {
	if (item.type != "blocks") {
		return null;
	}
	
	let isReblog = false;
	if (item.parent_post_url != null) {
		isReblog = true;
	}
	if (isReblog && includeReblogs != "on") {
		return null;
	}
	
	const blogName = getItem("blogName");

	const date = new Date(item.timestamp * 1000); // timestamp is seconds since the epoch, convert to milliseconds

	let contentUrl = item.post_url;
	let contentItem = item;
	let contentBlocks = contentItem.content;
	let contentLayouts = contentItem.layout;
	
	let isReblogged = false;
	let isLiked = item.liked;
	
	let originalId = item.id_string;
	let originalBlogName = item.blog_name;
	
	let annotation = null;
	if (isReblog) {
		if (item.trail != null && item.trail.length > 0) {
			let trailOrigin = item.trail[0];
			
			if (trailOrigin.post != null) { // not a broken blog
				originalId = trailOrigin.post.id;
				originalBlogName = trailOrigin.blog.name;
			}
			
			const itemBlog = item.blog;
			const itemBlogName = itemBlog.name;

			if (itemBlogName == blogName) {
				const text = "Reblogged by you";
				annotation = Annotation.createWithText(text);
				annotation.icon = "https://api.tumblr.com/v2/blog/" + blogName + "/avatar/96";

				isReblogged = true;
			}
			else {
				if (itemBlogName.startsWith("@@")) {
					const authorBlog = item.author_blog;
					const communityTitle = item.community.title;

					const text = `${authorBlog.name} reblogged to ${communityTitle}`;
					annotation = Annotation.createWithText(text);
					annotation.icon = "https://api.tumblr.com/v2/blog/" + authorBlog.name + "/avatar/96";
					annotation.uri = authorBlog.url;
				}
				else {
					const text = "Reblogged by " + itemBlogName;
					annotation = Annotation.createWithText(text);
					annotation.icon = "https://api.tumblr.com/v2/blog/" + itemBlog.name + "/avatar/96";
					annotation.uri = item.post_url;
				}
			}
			
			contentItem = trailOrigin;
			contentBlocks = contentItem.content;
			contentLayouts = contentItem.layout;
			
			if (itemBlog.name == blogName) {
				isReblog = true;
			}
			
// 			if (contentItem.blog.url != null && contentItem.post.id != null) {
// 				contentUrl = contentItem.blog.url + "/" + contentItem.post.id;
// 			}
		}
	}
	
	let identity = null;
	if (contentItem.blog != null) {
		const blog = contentItem.blog;
		if (blog.name.startsWith("@@")) {
			// community post
			const blogName = item.author;
			const communityTitle = item.community.title;
// 			let postId = element.reblogged_from_id ?? element.id_string;
// 			if (element.trail != null && element.trail.length > 0) {
// 				let trailOrigin = element.trail[0];
// 				if (trailOrigin.blog.active) {
// 					postId = trailOrigin.post.id;
// 					blogName = trailOrigin.blog.name;
// 				}
// 			}
// 			const text = `${blogName} posted in ${communityTitle}`;
// 			annotation = Annotation.createWithText(text);
// 			annotation.icon = "https://api.tumblr.com/v2/blog/" + blogName + "/avatar/96";
// 			annotation.uri = item.author_blog.url;

			const text = `Posted in ${communityTitle}`;
			annotation = Annotation.createWithText(text);
			//annotation.icon = "https://api.tumblr.com/v2/blog/" + blogName + "/avatar/96";
			//annotation.uri = item.author_blog.url;

            const blog = item.author_blog;
			identity = Identity.createWithName(blog.name);
			identity.uri = blog.url;
			identity.username = blog.title;
			if (blog.avatar != null && blog.avatar.length > 0) {
				identity.avatar = blog.avatar[0].url;
			}
			else {
				identity.avatar = "https://api.tumblr.com/v2/blog/" + blog.name + "/avatar/96";
			}
		}
		else {
			// blog post
			identity = Identity.createWithName(blog.name);
			identity.uri = blog.url;
			identity.username = blog.title;
			if (blog.avatar != null && blog.avatar.length > 0) {
				identity.avatar = blog.avatar[0].url;
			}
			else {
				identity.avatar = "https://api.tumblr.com/v2/blog/" + blog.name + "/avatar/96";
			}
		}
	}
	else {
		if (contentItem.broken_blog_name != null) {
			identity = Identity.createWithName(contentItem.broken_blog_name);
			identity.avatar = "https://api.tumblr.com/v2/blog/" + contentItem.broken_blog_name + "/avatar/96";
		}
		else {
			console.log(`**** no blog for '${item.summary}' ${item.post_url}`);
		}
	}
	
	let contentResults = processContentBlocks(contentBlocks, contentLayouts);
	let body = contentResults[0];
	let attachments = contentResults[1];
	
	if (includeTags == "on") {
		if (contentItem.tags != null && contentItem.tags.length > 0) {
			body += "<p>";
			for (const tag of contentItem.tags) {
				body += `<a href="https://www.tumblr.com/tagged/${encodeURIComponent(tag)}">#${tag}</a> `;
			}
			body += "</p>";
		}
	}

	const post = Item.createWithUriDate(contentUrl, date);
	post.body = body;
	if (identity != null) {
		post.author = identity;
	}
	if (attachments.length != 0) {
		post.attachments = attachments;
	}
	if (annotation != null) {
		post.annotations = [annotation];
	}
	
	let actionValues = { id: item.id_string, reblog_key: item.reblog_key };

	let actions = {};
    if (item.community == null) { // community posts can't be liked or reblogged
		if (!isReblogged) {
			actions["reblog"] = JSON.stringify(actionValues);
		}
		if (isLiked) {
			actions["unlike"] = JSON.stringify(actionValues);
		}
		else {
			actions["like"] = JSON.stringify(actionValues);
		}
	}
	// item.note_count is available, but doesn't reflect what the API will return
	{
		let noteActionValues = { id: item.id_string, blog_name: item.blog_name, original_id: originalId, original_blog_name: originalBlogName };
		if (isReblog && item.trail != null && item.trail.length > 1) {
			actions["trail"] = JSON.stringify(noteActionValues);
		}
		else {
			actions["notes"] = JSON.stringify(noteActionValues);
		}
	}
	post.actions = actions;

	return post;
}

function processContentBlocks(contentBlocks, contentLayouts) {
	let body = "";
	let attachments = [];

	let blockIndex = 0;
	for (const contentBlock of contentBlocks) {
		//console.log(`  [${blockIndex}] contentBlock.type = ${contentBlock.type}`);
		switch (contentBlock.type) {
		case "text":
			let text = contentBlock.text;
			let textFormats = contentBlock.formatting;
			if (textFormats != null && textFormats.length > 0) {
				let formattedText = formatText(text, textFormats);
				//console.log(`    formattedText = ${formattedText}`);
				text = formattedText;
			}
			
			let askLayout = contentLayouts.find(({ type }) => type === "ask");
			if (askLayout != null && askLayout.blocks.indexOf(blockIndex) != -1) {
				// text is an ask, style it with a blockquote
				let asker = "Anonymous";
				if (askLayout?.attribution?.blog?.name != null) {
					asker = askLayout.attribution.blog.name;
				}
				body += `<blockquote><p><strong>${asker}</strong> asked:</p><p>${text}</p></blockquote>`;
			}
			else {
				body += `<p>${text}</p>`;
			}
			break;
		case "image":
			if (contentBlock.media != null && contentBlock.media.length > 0) {
				const mediaProperties = contentBlock.media[0];
				const posterProperties = mediaProperties.poster;

				const attachment = MediaAttachment.createWithUrl(mediaProperties.url);
				if (contentBlock.alt_text != null) {
					attachment.text = contentBlock.alt_text;
				}
				attachment.mimeType = mediaProperties.type;
				attachment.aspectSize = {width: mediaProperties.width, height: mediaProperties.height};
				if (posterProperties != null) {
					attachment.thumbnail = posterProperties.url;
				}
				attachments.push(attachment);
			}
			break;
		case "link":
			if (contentBlock.url != null) {
				let attachment = LinkAttachment.createWithUrl(contentBlock.url);
				if (contentBlock.title != null && contentBlock.title.length > 0) {
					attachment.title = contentBlock.title;
				}
				if (contentBlock.description != null && contentBlock.description.length > 0) {
					attachment.subtitle = contentBlock.description;
				}
				if (contentBlock.author != null && contentBlock.author.length > 0) {
					attachment.authorName = contentBlock.author;
				}
				if (contentBlock.poster != null && contentBlock.poster.length > 0) {
					let poster = contentBlock.poster[0];
					if (poster.url != null) {
						attachment.image = poster.url;
					}
					if (poster.width != null && poster.height != null) {
						attachment.aspectSize = {width : poster.width, height: poster.height};
					}
				}
				attachments.push(attachment);
			}
			break;
		case "audio":
			if (contentBlock.media != null) {
				const mediaProperties = contentBlock.media;
				const posterProperties = contentBlock.poster;
				
				const attachment = MediaAttachment.createWithUrl(mediaProperties.url);
				if (contentBlock.title != null) {
					attachment.text = contentBlock.title;
				}
				attachment.mimeType = mediaProperties.type;
				attachment.aspectSize = {width: mediaProperties.width, height: mediaProperties.height};
				if (posterProperties != null && posterProperties.length > 0) {
					attachment.thumbnail = posterProperties[0].url;
				}
				attachments.push(attachment);
			}
			else if (contentBlock.embed_html != null) {
				body += `<p>${contentBlock.embed_html}</p>`;
			}
			else if (contentBlock.url != null) {
				body += `<p><a href="${contentBlock.url}">${contentBlock.url}</a>`;
			}
			break;
		case "video":
			if (contentBlock.media != null) {
				const mediaProperties = contentBlock.media;
				const posterProperties = contentBlock.poster;
				
				const attachment = MediaAttachment.createWithUrl(mediaProperties.url);
				attachment.mimeType = mediaProperties.type;
				attachment.aspectSize = {width: mediaProperties.width, height: mediaProperties.height};
				if (posterProperties != null && posterProperties.length > 0) {
					attachment.thumbnail = posterProperties[0].url;
				}
				attachments.push(attachment);
			}
			else if (contentBlock.embed_html != null) {
				if (contentBlock.provider == "youtube" && contentBlock.url != null) {
					let attachment = LinkAttachment.createWithUrl(contentBlock.url);
					attachments.push(attachment);
				}
				body += `<p>${contentBlock.embed_html}</p>`;
			}
			else if (contentBlock.url != null) {
				body += `<p><a href="${contentBlock.url}">${contentBlock.url}</a>`;
			}
			break;
		case "poll":
			body += `<p>${contentBlock.question}</p>`;
			body += "<p>";
			body += "<ul>";
			for (const answer of contentBlock.answers) {
				body += `<li>${answer.answer_text}</li>`;
			}
			body += "</ul>";
			body += "</p>";
			break;
// 		case "paywall":
// 			break;
		default:
			body += `<p>Cannot display ${contentBlock.type} content.</p>`;
		}
		
		blockIndex += 1;
	}
	
	return [body, attachments];
}

function formatText(text, textFormats) {
	let index = -1;
	let codeUnits = Array.from(text);
	let codePoints = codeUnits.map((codeUnit) => codeUnit.codePointAt());

	textFormats.sort((a, b) => a.start - b.start); // items are captured in start order, but are not guaranteed to be from API

	let range = [0, text.length];
	let result = breakText(range);
	applyItems(result.items, 0, codePoints);
	let formattedText = String.fromCodePoint(...codePoints)
	//console.log(`test: formattedText = ${formattedText}`);
	return formattedText;
	
	function breakText(range) {
		index += 1;

		let remainderRange = null;
		let remainderIndex = null;

		let items = [];

		let done = false;
		while (! done) {
			let intersectionRange = intersect(range, formatRange(index));

			if (intersectionRange == null) {
				// no more intersections at this level, send items and remainder up a level
				done = true;
			}
			else {
				// if there is a partial intersection, the remainder is handled in the previous level
				remainderRange = difference(formatRange(index), range);
				if (remainderRange != null) {
					remainderIndex = index;
				}

				let captureIndex = index; // the index is global and will advance when calling breakText()
				let result = breakText(intersectionRange);

				let intersectionStart = intersectionRange[0];
				let intersectionEnd = intersectionRange[1];

				// get the original code points and apply item results from breakText()
				let original = codePoints.slice(intersectionStart, intersectionEnd);
				applyItems(result.items, intersectionStart, original);

				let captureRange = formatRange(captureIndex);
				let capturePrefix = formatPrefix(captureIndex);
				let captureSuffix = formatSuffix(captureIndex);

				let replacement = [...capturePrefix, ...original, ...captureSuffix];

				//console.log(`capture ${captureIndex} = ${String.fromCodePoint(...replacement)}`);
				item = { start: captureRange[0], length: captureRange[1] - captureRange[0], replacement: replacement};
				items.push(item);

				if (result.remainderRange != null) {
					let remainderRange = result.remainderRange;
					let remainderIndex = result.remainderIndex;
					let type = formatType(remainderIndex);
					let prefix = formatPrefix(remainderIndex);
					let suffix = formatSuffix(remainderIndex);
					let slice = codePoints.slice(remainderRange[0], remainderRange[1]);
					let replacement = [...prefix, ...slice, ...suffix];
					//console.log(`capture remainder ${index} = ${String.fromCodePoint(...replacement)} (${type}) range = ${remainderRange}`);
					item = { start: remainderRange[0], length: remainderRange[1] - remainderRange[0], replacement: replacement};
					items.push(item);
				}
			}
		}

		return {items: items, remainderRange: remainderRange, remainderIndex: remainderIndex}
	}

	function applyItems(items, offset, string) {
		if (items.length > 0) {
			let substitutions = items.reverse();
			for (const substitution of substitutions) {
				let start = substitution.start;
				let length = substitution.length;
				string.splice(start - offset, length, ...substitution.replacement)
			}
		}
		return string;
	}
	
	function formatRange(index) {
		if (index < textFormats.length) {
			//console.log(`formatRange index = ${index}`);
			return [textFormats[index].start, textFormats[index].end];
		}
		return null;
	}
	
	function formatType(index) {
		if (index < textFormats.length) {
			return textFormats[index].type;
		}
		return null;
	}
	
	/*
		The following format types and parameters are supported:
		
		{type: "bold", start: 22, end: 26}, 
		{type: "italic", start: 28, end: 34},
		{type: "link", start: 79, end: 83, url: "https://example.com/"}
		{type: "small", start: 95, end: 100},
		{type: "strikethrough", start: 112, end: 119}
		{type: "mention", start: 22, end: 36, blog: {name: "flork-of-cows", url: "https://flork-of-cows.tumblr.com/", uuid: "t:jfn3ONc8OeKjq8QfLYcR3A"}}
		
		Code points are precomputed with: Array.from("</b>").map((codeUnit) => codeUnit.codePointAt())
	*/
	
	function formatPrefix(index) {
		if (index < textFormats.length) {
			switch (textFormats[index].type) {
				case "bold":
					return [60,98,62]; // <b>;
					break;
				case "italic":
					return [60,105,62]; // <i>;
					break;
				case "link":
					if (textFormats[index].url != null) {
						let start = [60,97,32,104,114,101,102,61,34]; // <a href="
						let urlCodePoints = Array.from(textFormats[index].url).map((codeUnit) => codeUnit.codePointAt());
						let end = [34,62]; // ">
						return [...start, ...urlCodePoints, ...end];
					}
					return [];
					break;
				case "small":
					return [60,115,109,97,108,108,62]; // <small>;
					break;
				case "strikethrough":
					return [60,115,62]; // <s>;
					break;
				case "mention":
					if (textFormats[index].blog != null && textFormats[index].blog.url != null) {
						let start = [60,97,32,104,114,101,102,61,34]; // <a href="
						let urlCodePoints = Array.from(textFormats[index].blog.url).map((codeUnit) => codeUnit.codePointAt());
						let end = [34,62]; // ">
						return [...start, ...urlCodePoints, ...end];
					}
					return [];
					break;
				default:
					return [];
					break;
			}
		}
		return null;
	}
	
	function formatSuffix(index) {
		if (index < textFormats.length) {
			switch (textFormats[index].type) {
				case "bold":
					return [60,47,98,62]; // </b>
					break;
				case "italic":
					return [60,47,105,62]; // </i>
					break;
				case "link":
					if (textFormats[index].url != null) {
						return [60,47,97,62]; // </a>
					}
					return [];
					break;
					break;
				case "small":
					return [60,47,115,109,97,108,108,62]; // </small>;
				case "strikethrough":
					return [60,47,115,62]; // </s>;
				case "mention":
					if (textFormats[index].blog != null && textFormats[index].blog.url != null) {
						return [60,47,97,62]; // </a>
					}
					return [];
					break;
				default:
					return [];
					break;
			}
		}
		return null;
	}
} // test()

// derived from: https://scicomp.stackexchange.com/a/26260
function intersect(a, b) {
	if (a == null || b == null) {
		return null;
	}

	aStart = a[0];
	aEnd = a[1];
	bStart = b[0];
	bEnd = b[1];

	if (bStart > aEnd || aStart > bEnd) {
		return null;
	}
	let oStart = Math.max(aStart, bStart);
	let oEnd = Math.min(aEnd, bEnd);
	if (oStart == oEnd) {
		return null;
	}
	return [oStart, oEnd]
}

// derived from: https://stackoverflow.com/a/26342664/132867
function difference(a, b) {
	if (a == null || b == null) {
		return null;
	}

	aStart = a[0];
	aEnd = a[1];
	bStart = b[0];
	bEnd = b[1];

	if (aStart < bStart) {
		let oStart = aStart;
		let oEnd = Math.min(aEnd, bStart);
		return [oStart, oEnd];
	}
	if (aEnd > bEnd || aStart > bEnd) {
		let oStart = Math.max(aStart, bEnd);
		let oEnd = aEnd;
		return [oStart, oEnd];
	}
	return null;
}
