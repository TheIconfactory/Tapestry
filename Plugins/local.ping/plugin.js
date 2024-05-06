
// local.ping

function identify() {
	if (typeof site !== 'undefined') {
		sendRequest(site, "HEAD")
		.then((dictionary) => {
			const jsonObject = JSON.parse(dictionary);
	
			const responseStatus = jsonObject["status"];
			if (responseStatus == 200) {
				// NOTE: The responseUrl may not be the same as the original url if there was a redirect.
				const responseUrl = jsonObject["url"];
				
				let identifier = responseUrl;
				if (identifier.startsWith("https://")) {
					identifier = identifier.replace("https://", "");
				}
				else if (identifier.startsWith("http://")) {
					identifier = identifier.replace("http://", "");
				}
				if (identifier.endsWith("/")) {
					identifier = identifier.substring(0, identifier.length - 1);
				}
				
				setIdentifier(identifier);
			}
			else {
				setIdentifier(null);
			}
		})
		.catch((requestError) => {
			setIdentifier(null);
		});
	}
}

function load() {
	sendRequest(site, "HEAD")
	.then((dictionary) => {
		const jsonObject = JSON.parse(dictionary);

		const responseStatus = jsonObject["status"];
		if (responseStatus != 200) {
			let date = new Date();
			let uri = `${site}?{date.valueOf()}`;
			let content = `<p>Response from ${site} failed with HTTP ${responseStatus} response.`;
			const post = Post.createWithUriDateContent(uri, date, content);
			processResults([post]);
		}
	})
	.catch((requestError) => {
		let date = new Date();
		let uri = `${site}?timestamp=${date.valueOf()}`;
		let content = `<p>Request to ${site} failed with <strong>${requestError}</strong></p>`;
		const post = Post.createWithUriDateContent(uri, date, content);
		processResults([post]);
	});
}
