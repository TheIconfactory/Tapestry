
// social.bsky.account

if (require('bluesky-shared.js') === false) {
    throw new Error("Failed to load bluesky-shared.js");
}

function verify() {
	let verifyAccount = normalizeAccount(account);
	sendRequest(site + `/xrpc/app.bsky.actor.getProfile?actor=${verifyAccount}`)
	.then((text) => {
		const jsonObject = JSON.parse(text);
		
		let displayName = "";
		if (jsonObject.displayName != null && jsonObject.displayName.length > 0) {
			displayName = jsonObject.displayName;
		}
		else {
			displayName = "@" + jsonObject.handle;
		}

		const did = jsonObject.did;
		setItem("did", did);
		
		if (jsonObject.avatar != null) {
			const icon = jsonObject.avatar
			const verification = {
				displayName: displayName,
				icon: icon
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
}

function load() {
	var did = getItem("did");

	if (did != null) {
		queryFeedForUser(did)
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
		let loadAccount = normalizeAccount(account);
		sendRequest(site + `/xrpc/app.bsky.actor.getProfile?actor=${loadAccount}`)
		.then((text) => {
			const jsonObject = JSON.parse(text);
		
			did = jsonObject.did;
			setItem("did", did);
		
			queryFeedForUser(did)
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

function normalizeAccount(account) {
	let result = account.trim();
	if (result.length > 1 && result.startsWith("@")) {
		result = result.slice(1);
	}
	return result;
}

function queryFeedForUser(did) {

	return new Promise((resolve, reject) => {
		const url = `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${did}`;
		sendRequest(url)
		.then((text) => {
			const jsonObject = JSON.parse(text);
			let results = [];
			for (const item of jsonObject.feed) {
				let post = postForItem(item, false);
				results.push(post);
			}
			resolve(results);
		})
		.catch((error) => {
			reject(error);
		});
	});
	
}

