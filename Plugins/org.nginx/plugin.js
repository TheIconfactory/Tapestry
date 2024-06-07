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

function verify() {
	let endpoint = site;
	sendRequest(endpoint)
	.then((text) => {
		if (text.startsWith("Active connections:")) {
			let siteUrl = site.split("/").splice(0,3).join("/");

			let displayName = siteUrl;
			if (displayName.startsWith("https://")) {
				displayName = displayName.replace("https://", "");
			}
			else if (displayName.startsWith("http://")) {
				displayName = displayName.replace("http://", "");
			}

			let icon = null;		
			if (siteUrl.endsWith("/")) {
				icon = siteUrl + "favicon.ico";
			}
			else {
				icon = siteUrl + "/favicon.ico";
			}
			
			const verification = {
				displayName: displayName,
				icon: icon
			};
			processVerification(verification);
		}
		else {
			processError(Error("Invalid status endpoint"));
		}
	})
	.catch((requestError) => {
		processError(requestError);
	});
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
		
// 		var identity = Identity.createWithName("NGINX");
// 		identity.uri = "https://nginx.org";
// 		identity.avatar = "https://nginx.org/favicon.ico";

		var content = "";
		content += "<p>Connections: " + currentConnections + "</p>\n";
		content += "<p>\n";
		content += "	Reading: <strong>" + readingConnections + "</strong> (" + toPercentage(readingConnections / currentConnections) + ")" + "<br/>\n";
		content += "	Writing: <strong>" + writingConnections + "</strong> (" + toPercentage(writingConnections / currentConnections) + ")" + "<br/>\n";
		content += "	Waiting: <strong>" + waitingConnections + "</strong> (" + toPercentage(waitingConnections / currentConnections) + ")\n";
		content += "</p>\n";
		content += "<p>\n";
		content += "	Total Accepted: <strong>" + acceptedConnections + "</strong><br/>\n";
		content += "	Total Handled: <strong>" + handledConnections + "</strong> (" + toPercentage(handledConnections / acceptedConnections) + ")" + "<br/>\n";
		content += "	Requests per Connection: <strong>" + (requests / handledConnections).toFixed(2) + "</strong>\n";
		content += "</p>";

		const url = site + "?date=" + date.valueOf();
		
		const resultItem = Item.createWithUriDate(url, date);
		resultItem.body = content;
//		resultItem.author = identity;

		processResults([resultItem]);
	})
	.catch((requestError) => {
		processError(requestError);
	});
}
