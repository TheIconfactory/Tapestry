
// com.tumblr

function verify() {
	sendRequest(site + "/v2/user/info")
	.then((text) => {
		const jsonObject = JSON.parse(text);
		
		const blogs = jsonObject.response.user.blogs;
		const blog = blogs[0];
		
		const displayName = blog.name;
		const icon = "https://api.tumblr.com/v2/blog/" + blog.name + "/avatar/96";

		const verification = {
			displayName: displayName,
			icon: icon
		};
		processVerification(verification);
	})
	.catch((requestError) => {
		processError(requestError);
	});
}

async function load() {
	let nowTimestamp = (new Date()).getTime();

	try {
		let blogName = getItem("blogName");
		if (blogName == null) {
			blogName = await getBlogName();
			setItem("blogName", blogName);
		}
	
		// NOTE: The dashboard will be filled up to the endDate, if possible.
		let endDate = null;
		let endDateTimestamp = getItem("endDateTimestamp");
		if (endDateTimestamp != null) {
			endDate = new Date(parseInt(endDateTimestamp));
		}
	
		let startTimestamp = (new Date()).getTime();
		
		queryDashboard(endDate)
		.then((parameters) =>  {
			results = parameters[0];
			newestItemDate = parameters[1];
			processResults(results, true);
			setItem("endDateTimestamp", String(newestItemDate.getTime()));
			let endTimestamp = (new Date()).getTime();
			console.log(`finished dashboard: ${results.length} items in ${(endTimestamp - startTimestamp) / 1000} seconds`);
		})
	}
	catch (error) {
		console.log(`error dashboard`);
		processError(requestError);
	}
}

function performAction(actionId, actionValue, item) {
	let error = new Error(`actionId "${actionId}" not implemented`);
	actionComplete(null, error);
}

async function getBlogName() {
	const text = await sendRequest(site + "/v2/user/info");
	const jsonObject = JSON.parse(text);
	const blogs = jsonObject.response.user.blogs;
	const blog = blogs[0];
		
	return blog.name;
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
	
	let annotation = null;
	if (isReblog) {
		if (item.trail != null && item.trail.length > 0) {
			let trailOrigin = item.trail[0];
			
			const itemBlog = item.blog;
			const itemBlogName = itemBlog.name;

			if (itemBlogName == blogName) {
				isReblogged = true;
			}
			else {
				const text = "Reblogged by " + itemBlogName;
				annotation = Annotation.createWithText(text);
				annotation.icon = "https://api.tumblr.com/v2/blog/" + itemBlog.name + "/avatar/96";
				annotation.uri = item.post_url;
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
	
	if (contentItem.blog != null) {
		const blog = contentItem.blog;
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
		if (contentItem.broken_blog_name != null) {
			identity = Identity.createWithName(contentItem.broken_blog_name);
		}
		else {
			console.log(`**** no blog for '${item.summary}' ${item.post_url}`);
		}
	}
	
	let body = "";
	let attachments = [];
	//console.log(`contentBlocks.length = ${contentBlocks.length}`);
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
		post.attachments = attachments
	}
	if (annotation != null) {
		post.annotations = [annotation];
	}
	
	
	values = JSON.stringify({ id: item.id_string, reblog_key: item.reblog_key });

	let actions = {};
	if (isReblogged) {
		actions["unreblog"] = values;
	}
	else {
		actions["reblog"] = values;
	}
	if (isLiked) {
		actions["unlike"] = values;
	}
	else {
		actions["like"] = values;
	}
	post.actions = actions;

	return post;
}

function queryDashboard(endDate) {

	// NOTE: These constants are related to the feed limits within Tapestry - it doesn't store more than
	// 3,000 items or things older than 30 days.
	// In use, the Tumblr API returns a limited number of items (300-ish) over a shorter timespan. Paging back
	// through results (using offset) is fairly slow, and these requests have a 30 second timeout, so the
	// the maxInterval is shorter than on other platforms.
	const maxInterval = 1.5 * 24 * 60 * 60 * 1000; // days in milliseconds (approximately)
	const maxItems = 300;

	let newestItemDate = null;
	let oldestItemDate = null;
	
	return new Promise((resolve, reject) => {

		// this function is called recursively to load & process batches of posts into a single list of results
		function requestBatch(id, endDate, pass, resolve, reject, results = []) {
			let url = null
			if (id == null) {
				//console.log("offset = none");
				url = `${site}/v2/user/dashboard?npf=true&reblog_info=true&notes_info=true&limit=20`;
			}
			else {
				const offset = pass * 20;
				//console.log(`offset = ${offset}`);
				url = `${site}/v2/user/dashboard?npf=true&reblog_info=true&notes_info=true&limit=20&offset=${offset}`;
			}
			
			console.log(`==== REQUEST id = ${id}, pass = ${pass}`);
			
			sendRequest(url, "GET")
			.then((text) => {
				//console.log(text);
				let firstId = null;
				let firstDate = null;
				let lastId = null;
				let lastDate = null;
				let endUpdate = false;
				
				const jsonObject = JSON.parse(text);
				const items = jsonObject.response.posts;
				for (const item of items) {
					const post = postForItem(item);
					if (post != null) {
						results.push(post);

						const date = post.date;

						const currentId = item["id"];
						if (firstId == null) {
							firstId = currentId;
							firstDate = date;
						}
						lastId = currentId;						
						lastDate = date;
						
						if (!endUpdate && date < endDate) {
							console.log(`>>>> END date = ${date}`);
							endUpdate = true;
						}
						if (date > newestItemDate) {
							console.log(`>>>> NEW date = ${date}`);
							newestItemDate = date;
						}
						if (date < oldestItemDate) {
							console.log(`>>>> OLD date = ${date}`);
							endUpdate = true;
						}
					}
				}
				
				if (id == lastId) {
					console.log(`>>>> ID MATCH`);
					endUpdate = true;
				}
				if (pass >= 20) {
					console.log(`>>>> PASS OVERFLOW`);
					endUpdate = true;
				}
				if (results.length > maxItems) {
					console.log(`>>>> MAX`);
					endUpdate = true;
				}
				
				console.log(`>>>> BATCH results = ${results.length}, lastId = ${lastId}, endUpdate = ${endUpdate}`);
				console.log(`>>>>       first  = ${firstDate}`);
				console.log(`>>>>       last   = ${lastDate}`);
				console.log(`>>>>       newest = ${newestItemDate}`);
				
				if (!endUpdate && lastId != null) {
					requestBatch(lastId, endDate, pass + 1, resolve, reject, results);
				}
				else {
					resolve([results, newestItemDate]);
				}
			})
			.catch((error) => {
				reject(error);
			});	
		}

		console.log(`>>>> START endDate = ${endDate}`);
		
		let nowTimestamp = (new Date()).getTime();
		let pastTimestamp = (nowTimestamp - maxInterval);
		oldestItemDate = new Date(pastTimestamp);
		console.log(`>>>> OLD date = ${oldestItemDate}`);
			
		requestBatch(null, endDate, 0, resolve, reject);
	});
	
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