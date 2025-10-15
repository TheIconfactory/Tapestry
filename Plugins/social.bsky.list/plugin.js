
// social.bsky.list

if (require('bluesky-shared.js') === false) {
    throw new Error("Failed to load bluesky-shared.js");
}

// Copy link to list:
// https://bsky.app/profile/did:plc:7foutw3hvd7nqwwng5gsmuez/lists/3lml2frpysk2j
// https://bsky.app/profile/gnitsetgnitset.bsky.social/lists/3lml2frpysk2j
//
// ->
//
// API request:
// https://api.bsky.app/xrpc/app.bsky.feed.getListFeed?list=at%3A%2F%2Fdid%3Aplc%3A7foutw3hvd7nqwwng5gsmuez%2Fapp.bsky.graph.list%2F3lml2frpysk2j

function verify() {
	sendRequest(`${site}/xrpc/app.bsky.actor.getProfile?actor=${account}`)
	.then((text) => {
		const jsonObject = JSON.parse(text);
		
		const did = jsonObject.did;
		setItem("did", did);
		
		const profileHandle = "@" + jsonObject.handle;

		sendRequest(`${site}/xrpc/app.bsky.graph.getList?list=at://${did}/app.bsky.graph.list/${listId}`)
		.then((text) => {
			const jsonObject = JSON.parse(text);
		
			const avatar = jsonObject?.list?.avatar ?? jsonObject?.list?.creator?.avatar;
			const listName = jsonObject.list.name;
			const displayName = `${listName} by ${profileHandle}`;
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
		queryList(did, listId)
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
		
			queryList(did, listId)
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

function queryList(did, listId) {
	return new Promise((resolve, reject) => {
		sendRequest(`${site}/xrpc/app.bsky.feed.getListFeed?list=at://${did}/app.bsky.graph.list/${listId}`)
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
