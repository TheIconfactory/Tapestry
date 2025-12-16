
// org.joinmastodon.list

if (require('mastodon-shared.js') === false) {
	throw new Error("Failed to load mastodon-shared.js");
}

function verify() {
	sendRequest(site + "/api/v1/accounts/verify_credentials")
	.then((text) => {
		const jsonObject = JSON.parse(text);
		
		const userName = "@" + jsonObject["username"];
		const icon = jsonObject["avatar"];

		const userId = jsonObject["id"];
		setItem("userId", userId);

		sendRequest(site + "/api/v1/lists")
		.then((text) => {
			const jsonObject = JSON.parse(text);
		
			const verifyList = normalizeList(list)
			let found = false;
			let displayName = userName;
			for (const listItem of jsonObject) {
				if (listItem.id == verifyList || listItem.title == verifyList) {
					setItem("listId", listItem.id);
					displayName = `${listItem.title} - ${userName}`;
					found = true;
				}
			}
			
			if (found) {
				const verification = {
					displayName: displayName,
					icon: icon
				};
				processVerification(verification);
			}
			else {
				processError(Error("Invalid List Identifier"));
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
	var listId = getItem("listId");

	if (listId != null) {
		queryStatusesForList(listId)
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
		sendRequest(site + "/api/v1/lists")
		.then((text) => {
			const jsonObject = JSON.parse(text);
		
			const loadList = normalizeList(list)
			let found = false;
			for (const listItem of jsonObject) {
				if (listItem.id == loadList || listItem.title == loadList) {
					setItem("listId", listItem.id);
					listId = listItem.id;
					found = true;
				}
			}
			
			if (found) {
				queryStatusesForList(listId)
				.then((results) =>  {
					console.log(`finished feed`);
					processResults(results, true);
				})
				.catch((requestError) => {
					console.log(`error feed`);
					processError(requestError);
				});	
			}
			else {
				processError(Error("Invalid List Identifier"));
			}
		})
		.catch((requestError) => {
			processError(requestError);
		});
	}
}

function queryStatusesForList(listId) {

	return new Promise((resolve, reject) => {
		sendRequest(site + "/api/v1/timelines/list/" + listId + "?limit=40")
		.then((text) => {
			const jsonObject = JSON.parse(text);
			let results = [];
			
			let annotation = Annotation.createWithText(`Posted in ${list}`);

			for (const item of jsonObject) {
				let post = postForItem(item);
				if (post != null) {
					post.annotations = [annotation];
					results.push(post);
				}
			}
			resolve(results);
		})
		.catch((error) => {
			reject(error);
		});
	});
	
}
