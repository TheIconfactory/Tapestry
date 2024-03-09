// xml.feed
let feedUrl = false;
let avatar = false;

function identify() {
  console.log("identify");
  sendRequest(site)
    .then((html) => {
      // site_format: https://www.youtube.com/<channel_name>
      // <meta property="og:url" content="https://www.youtube.com/channel/UC7zt-GmwdxyqgSwhKmhSniQ">
      const properties = metaProperties(html);
      const channelName = properties["og:title"];
      const channelUrl = properties["og:url"];
      try {
        feedUrl = _get_feed_url(channelUrl);
      } catch {
        return setIdentifier("Unknown");
      }
      avatarMatch = html.match(avatarRegex);
      avatar = avatarMatch[1];
      const dictionary = {
        identifier: channelName || "Channel name not found",
        baseUrl: feedUrl,
      };
      setIdentifier(dictionary);
    })
    .catch((requestError) => {
      processError(requestError);
      setIdentifier(null);
    });
}

function _get_feed_url(channelUrl) {
  /*
   * channelUrl format
   * https://www.youtube.com/channel/{channel_id}
   */
  lastUrlSeparator = channelUrl.lastIndexOf("/");
  if (lastUrlSeparator <= 0) {
    throw Exception("Could not get channel Id");
  }
  channelId = channelUrl.substring(lastUrlSeparator + 1);

  // feed_url: https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
}

const metaRegex = /<meta\s+property=\"(.*?)\" content=\"(.*?)\">/g;
const avatarRegex = /<link rel="image_src" href="([^"]*)">/;

function metaProperties(html) {
  var properties = {};

  const matches = html.matchAll(metaRegex);
  for (const match of matches) {
    const key = match[1];
    const value = match[2];
    properties[key] = value;
  }

  return properties;
}

function load() {
  console.log("load");
  sendRequest(feedUrl)
    .then((xml) => {
      let jsonObject = xmlParse(xml);
      const feedIsInvalid = jsonObject.feed == null || jsonObject.rss != null;
      if (feedIsInvalid) {
        throw Exception("Invalid feed format");
      }

      const feedName = jsonObject.feed.title;
      var creator = Creator.createWithUriName(feedUrl, feedName);
      creator.avatar = avatar;

      const entries = jsonObject.feed.entry;
      var results = [];
      for (const entry of entries) {
        const entryAttributes = entry.link$attrs;
        let entryUrl = null;
        if (entryAttributes instanceof Array) {
          for (const entryAttribute of entryAttributes) {
            if (entryAttribute.rel == "alternate") {
              entryUrl = entryAttribute.href;
              break;
            }
          }
        } else {
          if (entryAttributes.rel == "alternate") {
            entryUrl = entryAttributes.href;
          }
        }

        const url = entryUrl;
        const date = new Date(entry.published); // could also be "entry.updated"

        const mediaGroup = entry["media:group"];

        const thumbnail = mediaGroup["media:thumbnail$attrs"].url;
        const attachment = Attachment.createWithMedia(thumbnail);

        const content = mediaGroup["media:title"];
        const post = Post.createWithUriDateContent(url, date, content);
        post.creator = creator;
        post.attachments = [attachment];

        results.push(post);
      }

      processResults(results);
    })
    .catch((requestError) => {
      processError(requestError);
    });
}
