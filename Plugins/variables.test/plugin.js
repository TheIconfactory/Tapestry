
// variables.test

function identify() {
	setIdentifier(title)
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
	
	let content = `<p>Test content for ${site} & ${title}</p><p>${status}</p><p>For dessert, you'll be having ${dessert_choice}. Enjoy!</p><p><a href="https://streamer.iconfactory.net">Check user agent in logs</a></p>`
	
	const post = Post.createWithUriDateContent(uri, date, content);

	processResults([post]);
}
