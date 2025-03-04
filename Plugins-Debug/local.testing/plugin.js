
async function load() {
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
				if (eTag.startsWith("W/")) {
					body += `stripped W/<br/>`;
					eTag = eTag.substring(2);
					//eTag = eTag.slice(3, -1);
				}
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

		// testing that URLSession provides CachedAsyncImage with valid image data
		let base64Image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAApgAAAKYB3X3/OAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAANCSURBVEiJtZZPbBtFFMZ/M7ubXdtdb1xSFyeilBapySVU8h8OoFaooFSqiihIVIpQBKci6KEg9Q6H9kovIHoCIVQJJCKE1ENFjnAgcaSGC6rEnxBwA04Tx43t2FnvDAfjkNibxgHxnWb2e/u992bee7tCa00YFsffekFY+nUzFtjW0LrvjRXrCDIAaPLlW0nHL0SsZtVoaF98mLrx3pdhOqLtYPHChahZcYYO7KvPFxvRl5XPp1sN3adWiD1ZAqD6XYK1b/dvE5IWryTt2udLFedwc1+9kLp+vbbpoDh+6TklxBeAi9TL0taeWpdmZzQDry0AcO+jQ12RyohqqoYoo8RDwJrU+qXkjWtfi8Xxt58BdQuwQs9qC/afLwCw8tnQbqYAPsgxE1S6F3EAIXux2oQFKm0ihMsOF71dHYx+f3NND68ghCu1YIoePPQN1pGRABkJ6Bus96CutRZMydTl+TvuiRW1m3n0eDl0vRPcEysqdXn+jsQPsrHMquGeXEaY4Yk4wxWcY5V/9scqOMOVUFthatyTy8QyqwZ+kDURKoMWxNKr2EeqVKcTNOajqKoBgOE28U4tdQl5p5bwCw7BWquaZSzAPlwjlithJtp3pTImSqQRrb2Z8PHGigD4RZuNX6JYj6wj7O4TFLbCO/Mn/m8R+h6rYSUb3ekokRY6f/YukArN979jcW+V/S8g0eT/N3VN3kTqWbQ428m9/8k0P/1aIhF36PccEl6EhOcAUCrXKZXXWS3XKd2vc/TRBG9O5ELC17MmWubD2nKhUKZa26Ba2+D3P+4/MNCFwg59oWVeYhkzgN/JDR8deKBoD7Y+ljEjGZ0sosXVTvbc6RHirr2reNy1OXd6pJsQ+gqjk8VWFYmHrwBzW/n+uMPFiRwHB2I7ih8ciHFxIkd/3Omk5tCDV1t+2nNu5sxxpDFNx+huNhVT3/zMDz8usXC3ddaHBj1GHj/As08fwTS7Kt1HBTmyN29vdwAw+/wbwLVOJ3uAD1wi/dUH7Qei66PfyuRj4Ik9is+hglfbkbfR3cnZm7chlUWLdwmprtCohX4HUtlOcQjLYCu+fzGJH2QRKvP3UNz8bWk1qMxjGTOMThZ3kvgLI5AzFfo379UAAAAASUVORK5CYII=";
		
		let identity = Identity.createWithName("Testing");
		if (Math.random() > 0.5) {
			// sometimes you get an avatar, sometimes you don't
			identity.avatar = base64Image;
		}
		
		let uri = `${site}?timestamp=${nowTimestamp}`;
	
		let item = Item.createWithUriDate(uri, nowDate);
		item.title = title;
		item.body = `<p>${body}</p>`;
		item.author = identity;
		
		processResults([item]);
	}
	catch (error) {
		console.log(`error = ${error}`);
		processError(error);
	}
}