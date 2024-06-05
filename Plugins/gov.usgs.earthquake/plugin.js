// gov.usgs.earthquake

function load() {

	let summaryName = "4.5_day";
	
	if (typeof magnitude !== 'undefined') {
		switch (magnitude) {
			case "Significant":
				summaryName = "significant_day";
				break;
			case "Over 4.5":
				summaryName = "4.5_day";
				break;
			case "Over 2.5":
				summaryName = "2.5_day";
				break;
			case "Over 1.0":
				summaryName = "1.0_day";
				break;
			case "All":
				summaryName = "all";
				break;
		}
	}
	
	const endpoint = `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/${summaryName}.geojson`;

	sendRequest(endpoint)
	.then((text) => {
		const jsonObject = JSON.parse(text);

// 		const identityUrl = "https://earthquake.usgs.gov/";
// 		const identityName = "USGS – Latest Earthquakes";
// 		let identity = Identity.createWithName(identityName);
// 		identity.uri = identityUrl;
// 		identity.avatar = "https://earthquake.usgs.gov/earthquakes/map/assets/pwa/icon-192x192.png";

		const features = jsonObject["features"];
		
		let results = [];
		for (const feature of features) {
			const properties = feature["properties"];
			const url = properties["url"];
			const date = new Date(properties["time"]);
			const text = properties["title"];
			
			const geometry = feature["geometry"];
			const coordinates = geometry["coordinates"];
			const latitude = coordinates[1];
			const longitude = coordinates[0];
			const mapsUrl = "https://maps.apple.com/?ll=" + latitude + "," + longitude + "&spn=15.0";
			
			const content = "<p>" + text + " <a href=\"" + mapsUrl + "\">Open Map</a></p>"
			
			let resultItem = Item.createWithUriDate(url, date);
			resultItem.body = content;
//			resultItem.author = identity;
			
			results.push(resultItem);
		}
		processResults(results);
	})
	.catch((requestError) => {
		processError(requestError);
	});
}
