
// gov.noaa.nesdis.star

function verify() {
	let displayName = "";
	if (satellite == "East Coast") {
		displayName = "GOES19 Satellite";
	}
	else {
		displayName = "GOES18 Satellite";
	}
	
	setItem("lastUpdate", null);
	
	processVerification(displayName);
}
	
// NOTE: Images update every five minutes, but it takes longer to see a visible difference.
// A new post will only be generated when we're past the updateInterval.

const updateInterval = 2 * 60 * 60 * 1000; // in milliseconds

const minuteThreshold = 60;

function load() {
	const date = new Date();

	let nowTimestamp = (new Date()).getTime();
	
	let doUpdate = true;
	let lastUpdate = getItem("lastUpdate");
	if (lastUpdate != null) {
		let lastUpdateTimestamp = parseInt(lastUpdate);
		console.log(`lastUpdateTimestamp = ${new Date(lastUpdateTimestamp)}`);
		console.log(`updateInterval = ${updateInterval}`);
		let futureTimestamp = (lastUpdateTimestamp + updateInterval);
		console.log(`futureTimestamp = ${new Date(futureTimestamp)}`);
		if (nowTimestamp < futureTimestamp) {
			// time has not elapsed, do not load
			console.log(`time until next update = ${(futureTimestamp - nowTimestamp) / 1000} sec.`);
			doUpdate = false;
		}
	}

	if (doUpdate) {
		let directory = "GOES18";
		if (satellite == "East Coast") {
			directory = "GOES19";
		}

		let subdirectory = "CONUS";
		let imageWidth = "2500";
		let imageHeight = "1500";
		if (view == "Full Disk") {
			subdirectory = "FD";
			imageWidth = "1808";
			imageHeight = "1808";
		}
		let directoryUrl = `https://cdn.star.nesdis.noaa.gov/${directory}/ABI/${subdirectory}/${image}/`;
		sendRequest(directoryUrl)
		.then((html) => {
			
			let imageRegex = null;
			if (view == "Full Disk") {
				imageRegex = /<a href="(.*-1808x1808\.jpg)">/gm
			}
			else {
				imageRegex = /<a href="(.*-2500x1500\.jpg)">/gm
			}
			const matches = [...html.matchAll(imageRegex)];
			if (matches.length > 0) {
				const lastMatch = matches[matches.length - 1];
				const imageUrl = lastMatch[1];
	
				let year = parseInt(imageUrl.substring(0, 4));
				let dayOfYear = parseInt(imageUrl.substring(4, 7));
				let hour = parseInt(imageUrl.substring(7, 9));
				let minute = parseInt(imageUrl.substring(9, 11));
				
				const url = `https://cdn.star.nesdis.noaa.gov/${directory}/ABI/${subdirectory}/${image}/${imageUrl}`;
				
				const initialDate = new Date(Date.UTC(year, 0, 1, hour, minute));
				const date = new Date(initialDate.setUTCDate(dayOfYear));
				
				let attachment = MediaAttachment.createWithUrl(url);
				attachment.aspectSize = {width: imageWidth, height: imageHeight};
				
				const content = `<p>${image} image of ${view} (${satellite})</p>`;
				var resultItem = Item.createWithUriDate(url, date);
				resultItem.body = content;
				resultItem.attachments = [attachment];
				
				processResults([resultItem]);
				
				setItem("lastUpdate", String(nowTimestamp));
			}
			else {
				processError(Error(`No images for: /${directory}/ABI/${subdirectory}/${image}`));
			}
		})
		.catch((requestError) => {
			processError(requestError);
		});	

		lastDate = date;
	}
	else {
		// no results	
		processResults(null);
	}
}
