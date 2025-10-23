
// social.bsky.feed

if (require('bluesky-shared.js') === false) {
    throw new Error("Failed to load bluesky-shared.js");
}

function verify() {
	sendRequest(`${site}/xrpc/app.bsky.actor.getProfile?actor=${account}`)
	.then((text) => {
		const jsonObject = JSON.parse(text);
		
		const did = jsonObject.did;
		setItem("did", did);
		
		const profileHandle = "@" + jsonObject.handle;

		sendRequest(`${site}/xrpc/app.bsky.feed.getFeedGenerator?feed=at://${did}/app.bsky.feed.generator/${feedId}`)
		.then((text) => {
			const jsonObject = JSON.parse(text);
		
			const avatar = jsonObject.view.avatar;
			const feedAvatar = jsonObject.view.displayName;
			const feedUrl = uriPrefix + "/profile/" + profileHandle + "/feed/" + feedId;
			const displayName = `${feedName} by ${profileHandle}`;

			setItem("feedName", feedName);
			setItem("feedAvatar", feedAvatar);
			setItem("feedUrl", feedUrl);

			if (avatar != null) {
				const verification = {
					displayName: displayName,
					icon: avatar
				};
				processVerification(verification);
			}
			else {
				processVerification(displayName);
			}
		})
		.catch((requestError) => {
			processError(requestError);
		});
	})
	.catch((requestError) => {
		processError(requestError);
	});
}

async function load() {
	var did = getItem("did");
	if (did == null) {
		did = await getAccountDid(account);
		setItem("did", did);
	}

	var feedName = getItem("feedName");
	var feedAvatar = getItem("feedAvatar");
	if (feedName == null || feedAvatar == null) {
		const results = await getFeedInfo(did, feedId);
		setItem("feedName", results[0]);
		setItem("feedAvatar", results[1]);
	}

	queryFeedForGenerator(did, feedId, feedName, feedAvatar)
	.then((results) =>  {
		console.log(`finished did ${did}, feed ${feedId}`);
		processResults(results, true);
	})
	.catch((requestError) => {
		console.log(`error did ${did}, feed ${feedId}`);
		processError(requestError);
	});	
}

function queryFeedForGenerator(did, feedId, feedName, feedAvatar) {
	return new Promise((resolve, reject) => {
		sendRequest(`${site}/xrpc/app.bsky.feed.getFeed?feed=at://${did}/app.bsky.feed.generator/${feedId}`)
		.then((text) => {
			const jsonObject = JSON.parse(text);
			
			// NOTE: The feed generator returns items that are not ordered by time, and we need time. So we
			// generate a timestamp for this moment in time, and subtract a second from it as we go through
			// the list of items. Yuck.
			let lastTimestamp = (new Date()).getTime();

			let annotation = Annotation.createWithText(`Posted in ${feedName}`);
			annotation.icon = feedAvatar;

			let results = [];
			for (const item of jsonObject.feed) { 
				let post = postForItem(item, false, new Date(lastTimestamp));
				post.annotations = [annotation];
				results.push(post);
				lastTimestamp -= 1000;
			}
			resolve(results);
		})
		.catch((error) => {
			reject(error);
		});
	});
}
