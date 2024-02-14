// org.nginx

/*
	Add something like this to your NGINX server config:
	
	location /status {
		stub_status	on;
		access_log	off;
		allow 192.168.0.0/24;
		deny all;
	}
*/

function toPercentage(value) {
	return (value * 100.0).toFixed(1) + "%"
}

function identify() {
	setIdentifier(site.substring(0, site.lastIndexOf("/")));
}

function load() {
	const date = new Date();

	let endpoint = site;
	sendRequest(endpoint)
	.then((text) => {
		const lines = text.split("\n");
		
		const currentConnections = parseInt(lines[0].split(":")[1]);
		const counters = lines[2].split(" ").filter((element) => element.length > 0);
		const states = lines[3].split(" ");

		const acceptedConnections = parseInt(counters[0]);
		const handledConnections = parseInt(counters[1]);
		const requests = parseInt(counters[2]);
		
		const readingConnections = parseInt(states[1]);
		const writingConnections = parseInt(states[3]);
		const waitingConnections = parseInt(states[5]);
		
		const creatorUrl = site;
		const creatorName = "NGINX – " + site.substring(0, site.lastIndexOf("/"));
		var creator = Creator.createWithUriName(creatorUrl, creatorName);
		const avatar = "https://nginx.org/favicon.ico";
		creator.avatar = avatar;

		var content = "";
		content += "<p>Connections: " + currentConnections + "</p>";
		content += "<p>";
		content += 		"Reading: <strong>" + readingConnections + "</strong> (" + toPercentage(readingConnections / currentConnections) + ")" + "<br/>";
		content += 		"Writing: <strong>" + writingConnections + "</strong> (" + toPercentage(writingConnections / currentConnections) + ")" + "<br/>";
		content += 		"Waiting: <strong>" + waitingConnections + "</strong> (" + toPercentage(waitingConnections / currentConnections) + ")";
		content += "</p>";
		content += "<p>";
		content += 		"Total Accepted: <strong>" + acceptedConnections + "</strong><br/>";
		content += 		"Total Handled: <strong>" + handledConnections + "</strong> (" + toPercentage(handledConnections / acceptedConnections) + ")" + "<br/>";
		content += 		"Requests per Connection: <strong>" + (requests / handledConnections).toFixed(2) + "</strong>";
		content += "</p>";

		const url = site + "?date=" + date.valueOf();
		
		const post = Post.createWithUriDateContent(url, date, content);
		post.creator = creator;

		processResults([post]);
	})
	.catch((requestError) => {
		processError(requestError);
	});

}
