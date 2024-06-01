
// variables.test

function verify() {
	const verification = {
		displayName: title,
		icon: "https://iconfactory.com/favicon.ico"
	};
	processVerification(verification)
}

function load() {
	let uri = "custom://variables.test";
	let date = new Date();
	let status = ""
	if (reticulate_splines == "on") {
		status = "Splines are being reticulated";
	}
	if (turbo == "on") {
		if (status.length > 0) {
			status += " and ";
		}
		status += "TURBO is engaged";
	}
	status += ` at level ${value}`;
	
	let content = `<p>Test content for ${site} & ${title}</p><p>${status}</p><blockquote><p>For dessert, you'll be having ${dessert_choice}. Enjoy!</p></blockquote><p><a href="https://streamer.iconfactory.net">Check user agent in logs</a></p>`
	
	const post = Post.createWithUriDateContent(uri, date, content);

	processResults([post]);
}
