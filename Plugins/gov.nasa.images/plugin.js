// gov.nasa.images

const nasaIcon = "https://usetapestry.com/icons/nasa.png";

async function verify() {
	processVerification({
		displayName: "NASA Images",
		icon: nasaIcon
	});
}

async function load() {
	// Fetch the curated "recent uploads" list — same data the website uses
	const response = await sendRequest("https://images-assets.nasa.gov/recent.json", "GET");
	const jsonObject = JSON.parse(response);
	const allItems = jsonObject.collection.items;

	if (!allItems || allItems.length === 0) {
		processResults([]);
		return;
	}

	const hasImported = getItem("hasImported");
	const results = [];

	for (let i = allItems.length - 1; i >= 0; i--) {
		const item = allItems[i];
		const data = item.data[0];
		if (!data) continue;

		const nasaId = data.nasa_id;
		// On first import, offset from date_created by position so items with identical dates
		// (NASA often uses midnight with no time) preserve the upload order from recent.json.
		// On subsequent imports, new Date() in the loop naturally advances per iteration.
		const date = hasImported ? new Date() : new Date(new Date(data.date_created).getTime() + (allItems.length - i) * 1000);
		const title = data.title;
		const description = data.description;
		// description_508 is sometimes a raw camera filename (e.g. "017A7339.NEF"), so validate it
		const desc508 = data.description_508;
		const goodDesc508 = desc508 && desc508.length > 10 && !/^\S+\.\w{2,4}$/.test(desc508.trim());
		const altText = (goodDesc508 ? desc508 : null) || (description && description !== title ? description : null);

		const uri = `https://images.nasa.gov/details/${nasaId}`;

		const resultItem = Item.createWithUriDate(uri, date);
		resultItem.title = title;

		if (includeDescription === "on" && description) {
			resultItem.body = description;
		}

		// Attachments
		if (data.media_type === "video" && item.href) {
			const basePath = item.href.replace("/collection.json", "");
			const videoUrl = `${basePath}/${encodeURIComponent(nasaId)}~orig.mp4`;

			const attachment = MediaAttachment.createWithUrl(videoUrl);
			attachment.mimeType = "video/mp4";
			attachment.text = altText;

			if (item.links && item.links.length > 0) {
				const thumb = item.links.find(l => l.href && l.render === "image");
				if (thumb) {
					attachment.thumbnail = thumb.href;
				}
			}

			resultItem.attachments = [attachment];
		}
		else if (data.media_type === "audio" && item.href) {
			const basePath = item.href.replace("/collection.json", "");
			const audioUrl = `${basePath}/${encodeURIComponent(nasaId)}~orig.mp3`;

			const attachment = MediaAttachment.createWithUrl(audioUrl);
			attachment.mimeType = "audio/mpeg";
			attachment.text = altText;
			resultItem.attachments = [attachment];
		}
		else if (item.links && item.links.length > 0) {
			// Image: use orig (full res) as main URL, large as thumbnail
			const orig = item.links.find(l => l.href && l.href.includes("~orig"));
			const large = item.links.find(l => l.href && l.href.includes("~large"));
			const imageLink = orig || large || item.links[0];

			if (imageLink && imageLink.href) {
				const attachment = MediaAttachment.createWithUrl(imageLink.href);
				attachment.mimeType = "image/jpeg";
				if (imageLink.width && imageLink.height) {
					attachment.aspectSize = { width: imageLink.width, height: imageLink.height };
				}
				const thumbLink = large || item.links.find(l => l.href && l.href.includes("~medium"));
				if (thumbLink && thumbLink.href) {
					attachment.thumbnail = thumbLink.href;
				}
				attachment.text = altText;
				resultItem.attachments = [attachment];
			}
		}

		// Keywords as annotation
		if (includeKeywords === "on" && data.keywords && data.keywords.length > 0) {
			const keywordsText = data.keywords.join(", ");
			const annotation = Annotation.createWithText(keywordsText);
			resultItem.annotations = [annotation];
		}

		results.push(resultItem);
	}

	if (!hasImported) {
		setItem("hasImported", "true");
	}

	processResults(results);
}
