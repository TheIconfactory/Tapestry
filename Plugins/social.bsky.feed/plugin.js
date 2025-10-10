
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
			const feedName = jsonObject.view.displayName;
			const displayName = `${feedName} by ${profileHandle}`;
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

function load() {
	var did = getItem("did");

	if (did != null) {
		queryFeedForGenerator(did, feedId)
		.then((results) =>  {
			console.log(`finished (cached) feed`);
			processResults(results, true);
		})
		.catch((requestError) => {
			console.log(`error (cached) feed`);
			processError(requestError);
		});	
	}
	else {
		sendRequest(`${site}/xrpc/app.bsky.actor.getProfile?actor=${account}`)
		.then((text) => {
			const jsonObject = JSON.parse(text);
		
			did = jsonObject.did;
			setItem("did", did);
		
			queryFeedForGenerator(did, feedId)
			.then((results) =>  {
				console.log(`finished feed`);
				processResults(results, true);
			})
			.catch((requestError) => {
				console.log(`error feed`);
				processError(requestError);
			});	
		})
		.catch((requestError) => {
			processError(requestError);
		});
	}
}

function queryFeedForGenerator(did, feedId) {
	return new Promise((resolve, reject) => {
		sendRequest(`${site}/xrpc/app.bsky.feed.getFeed?feed=at://${did}/app.bsky.feed.generator/${feedId}`)
		.then((text) => {
			const jsonObject = JSON.parse(text);
			
			// NOTE: The feed generator returns items that are not ordered by time, and we need time. So we
			// generate a timestamp for this moment in time, and subtract a second from it as we go through
			// the list of items. Yuck.
			let lastTimestamp = (new Date()).getTime();

			let results = [];
			for (const item of jsonObject.feed) { 
				let post = postForItem(item, false, new Date(lastTimestamp));
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
