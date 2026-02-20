
// org.joinmastodon.account

if (require('mastodon-shared.js') === false) {
	throw new Error("Failed to load mastodon-shared.js");
}

function verify() {
	const verifyAccount = normalizeAccount(account);
	const url = `${site}/api/v1/accounts/lookup?acct=${verifyAccount}`
	sendRequest(url)
	.then((text) => {
		const jsonObject = JSON.parse(text);
		
		let displayName = "";
		if (jsonObject.display_name != null && jsonObject.display_name.length > 0) {
			displayName = jsonObject.display_name;
		}
		else {
			displayName = "@" + jsonObject.username;
		}

		const id = jsonObject.id;
		setItem("id", id);
		
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
	var id = getItem("id");

	if (id != null) {
		queryStatusesForUser(id)
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
		const loadAccount = normalizeAccount(account);
		const url = `${site}/api/v1/accounts/lookup?acct=${loadAccount}`
		sendRequest(url)
		.then((text) => {
			const jsonObject = JSON.parse(text);
		
			const id = jsonObject.id;
			setItem("id", id);
		
			queryStatusesForUser(id)
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

function queryStatusesForUser(id) {

	return new Promise((resolve, reject) => {
		sendRequest(site + "/api/v1/accounts/" + id + "/statuses?limit=40")
		.then((text) => {
			const jsonObject = JSON.parse(text);
			let results = [];
			for (const item of jsonObject) {
				let post = null;

				if (item.quote != null && includeQuotes != "on") {
					// skip quotes
				}
				else if (item.reblog != null) {
					if (includeBoosts == "on") {
						post = postForItem(item);
					}
				}
				else if (item.in_reply_to_account_id != null && item.in_reply_to_account_id != id) {
					if (includeReplies == "on") {
						post = postForItem(item);
					}
				}
				else {
					post = postForItem(item);
				}

				if (post != null) {
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
