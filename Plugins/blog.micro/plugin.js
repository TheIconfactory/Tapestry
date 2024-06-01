
// blog.micro

function verify() {
	sendRequest(site + "/account/verify", "POST", "token=__bearerToken__")
	.then((text) => {
		const jsonObject = JSON.parse(text);
		
		const displayName = "@" + jsonObject["username"];
		const icon = jsonObject["avatar"];
		
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

function load() {
	const filterMentions = includeMentions != "on";
	
	sendRequest(site + "/posts/timeline", "GET")
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
			
			const author = item["author"]; 
			const creator = Creator.createWithUriName(author["url"], author["name"]);
			creator.avatar = author["avatar"];
			
			const uri = item["url"];
			const date = new Date(item["date_published"]);
			const content = item['content_html'];
			const post = Post.createWithUriDateContent(uri, date, content);
			post.creator = creator;
			
			results.push(post);
		}
		processResults(results);
	})
	.catch((requestError) => {
		processError(requestError);
	});	
}

function sendPost(parameters) {
	sendRequest(site + "/micropub", "POST", parameters)
	.then((text) => {
		const jsonObject = JSON.parse(text);
		processResults([jsonObject], true);
	})
	.catch((requestError) => {
		processError(requestError);
	});
}

function sendAttachments(post) {
	sendRequest(site + "/micropub?q=config")
	.then((text) => {
		const jsonObject = JSON.parse(text);
		const mediaEndpoint = jsonObject["media-endpoint"];
		
		if (mediaEndpoint != null) {
			const file = post.attachments[0].media;
			uploadFile(file, mediaEndpoint)
			.then((text) => {
				const jsonObject = JSON.parse(text);

				// {"url":"https://chockenberry.micro.blog/uploads/2023/bac6e514ee.png","poster":""}

				const photo = jsonObject["url"];
				
				const status = post.content;
				const dictionary = {
					type: [ "h-entry" ],
					properties: {
						content: [ status ],
						photo: [ photo ]
					}
				};
				const parameters = JSON.stringify(dictionary);

				sendPost(parameters);
			})
			.catch((requestError) => {
				processError(requestError);
			});

		}
	})
	.catch((requestError) => {
		processError(requestError);
	});
}

function send(post) {
	if (post.attachments != null && post.attachments.length > 0) {
		sendAttachments(post);
	}
	else {
		const status = post.content;
		const dictionary = {
			type: [ "h-entry" ],
			properties: {
				content: [ status ]
			}
		};
		const parameters = JSON.stringify(dictionary);
		sendPost(parameters);
	}
}
