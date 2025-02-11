
async function load() {
	//let query = "https://www.mtgpics.com/art"
	//let url = "https://sixcolors.com/feed/json/"
	console.log(`site = ${site}`)
	
	let extraHeaders = [];	
	let lastModified = getItem("lastModified");
	if (lastModified != null) {
		console.log(`lastModified = ${lastModified}`);
		extraHeaders["if-modified-since"] = lastModified;
	}
	let eTag = getItem("eTag");
	if (eTag != null) {
		console.log(`eTag = ${eTag}`);
		extraHeaders["if-none-match"] = eTag;
	}
	extraHeaders["accept-encoding"] = "gzip,deflate";
	
	try {
		const text = await sendRequest(site, "GET", null, extraHeaders, true);
		const response = JSON.parse(text);
		console.log(`response.status = ${response.status}`);
		//console.log(`response.headers = ${JSON.stringify(response.headers)}`);

		const title = String(response.status);
		let body = "";
		
		const headers = response.headers;
		
		if (response.status == 200) {
			if (headers["last-modified"] != null) {
				console.log(`headers["last-modified"] = ${headers["last-modified"]}`);
				setItem("lastModified", headers["last-modified"]);
				body += `last-modified = ${headers["last-modified"]}<br/>`;
			}
			if (headers["etag"] != null) {
				console.log(`headers["etag"] = ${headers["etag"]}`);
				body += `etag = ${headers["etag"]}<br/>`;
				let eTag = headers["etag"];
// 				if (eTag.startsWith("W/")) {
// 					body += `stripped W/<br/>`;
// 					eTag = eTag.substring(2);
// 					//eTag = eTag.slice(3, -1);
// 				}
				if (eTag.endsWith("-gzip\"")) {
					eTag = eTag.slice(0, -6) + "\"";
					body += `stripped -gzip<br/>`;
				}
				setItem("eTag", eTag);
			}
			
			try {
				const jsonObject = JSON.parse(response.body);				
				const items = jsonObject["items"];
				console.log(`items.length = ${items.length}`);
				body += `items.length = ${items.length}`;
			}
			catch (error) {
				console.log(`body.length = ${response.body.length}`);
				body += `body.length = ${response.body.length}`;
			}
		}
		else if (response.status == 304) {
			console.log(`not modified`);
			body += `not modified`;
		}
		else {
			//throw new Error(`Unexpected response status = ${response.status}`);
			console.log(`bad response status = ${response.status}`);
			//setItem("lastModified", null);
			//setItem("eTag", null);
			body += `bad response status = ${response.status}`;
			//console.log(response.body);
		}

		if (headers["content-encoding"] != null) {
			body += `<br/>encoding = ${headers["content-encoding"]}<br/>`;
		}
		if (headers["content-type"] != null) {
			body += `<br/>type = ${headers["content-type"]}<br/>`;
		}

		let nowDate = new Date();
		let nowTimestamp = nowDate.getTime();

		let uri = `${site}?timestamp=${nowTimestamp}`;
	
		let item = Item.createWithUriDate(uri, nowDate);
		item.title = title;
		item.body = `<p>${body}</p>`;
		
		processResults([item]);
	}
	catch (error) {
		console.log(`error = ${error}`);
		processError(error);
	}
}