// gov.usgs.earthquake

async function load() {

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

	let text = await sendConditionalRequest(endpoint)
    
    if (!text) {
        return processResults([]);
    }
    
    const jsonObject = JSON.parse(text);

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
        const mapsUrl = "https://maps.apple.com/?ll=" + latitude + "," + longitude + "&z=8";
        
        const content = "<p>" + text + " <a href=\"" + mapsUrl + "\">Open Map</a></p>"
        
        let resultItem = Item.createWithUriDate(url, date);
        resultItem.body = content;
        
        results.push(resultItem);
    }
    processResults(results);
}
