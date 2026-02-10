
# Tapestry API

## Introduction

The following document describes the JavaScript API that Tapestry uses to process information from the Internet. The components shown below are used to create "connectors" that allow a timeline to be populated from a data source.

This is a work-in-progress and details are certain to change.

> **Note:** The JavaScript in connectors must conform to the [ECMA-262 specification](http://www.ecma-international.org/publications/standards/Ecma-262.htm). This specification defines the language and its basic [functions](https://262.ecma-international.org/14.0/#sec-function-properties-of-the-global-object) and [objects](https://262.ecma-international.org/14.0/#sec-constructor-properties-of-the-global-object). Additions that support the Document Object Model (DOM) and other browser functions are not available.

---
## Variables

Any variables that have been specified in `ui-config.json` are set before the script is executed. For example, the Mastodon connector specifies the following inputs:

```json
{
	"inputs": [
		{
			"name": "site",
			"type": "url",
			"prompt": "Instance",
			"validate_as": "url",
			"placeholder": "https://mastodon.social"
		}
	]
}
```

The current value for the `site` input will be set before the `plugin.js` script is executed. This lets the script adapt to use `mastodon.social`, `mastodon.art`, etc. with code such as this:

```javascript
sendRequest(site + "/api/v1/timelines/home?limit=40")
```

See the Configuration section below for the specification of `ui-config.json` and each input/variable.

---
## Objects

The following objects are used to create content for the Tapestry app.

Note that the properties of these objects have implicit type conversions when values are set. For example:

```
> item = Item.createWithUriDate(uri, date);
< TapestryCore.ItemObject { … }

> item.body
< undefined

> typeof(item.body)
< "undefined"

> item.body = undefined
< undefined

> item.body
< "undefined"

> typeof(item.body)
< "string"
```

If you want to return an undefined (nil) value back to Tapestry, do not set the property. For example, to conditionally set the body property, you'd use:

```javascript
const item = Item.createWithUriDate(uri, date);
if (myContent != null) {
	item.body = myContent;
}
```
---
### Item

`Item` objects are used to populate a timeline in the app. Items can be either posts or articles. You create one with:

```javascript
const uri = "https://example.com/unique/path/to/content";
const date = new Date();
const item = Item.createWithUriDate(uri, date);
item.title = "Hello.";
item.body = "<p>This is <em>a contrived</em> example, but <b>so what?</b></p>";

```

#### uri: String (required)

A unique URI for the item on the Internet. Used to show details in a browser (assuming the URI is a valid HTTP URL).

#### date: Date (required)

The date and time when the post was created.

#### title: String

The title.

#### body: String

Text with HTML formatting that will be displayed for the post. See the end of this document for how this content and its formatting is used.

#### contentWarning: String

Adds a content warning to the item and blurs any attachments.

#### author: Identity

The creator of the content. See `Identity` below.

#### attachments: Array of MediaAttachment and LinkAttachment and Item and PollAttachment

Media, link, poll, and quoted item attachments for the content. See `MediaAttachment`, `LinkAttachment`, and `PollAttachment` below.

As of 1.3, the `attachments` array can also include ordinary `Item` instances to achieve a "quoted post" presentation when needed.

> **Note:** If the `provides_attachments` configuration parameter is not set or false, attachments will be generated automatically using the elements of the `body` HTML. If no other media attachments in the item have been set, inline images and videos will be used to create media attachments automatically. Additionally, the first link in the first paragraph will be checked for a link attachment. See the section on HTML Content for more information.

> **Compatibility:** Item and PollAttachment attachments are only supported in Tapestry 1.3 or higher and will be ignored by older versions.

#### shortcodes: Dictionary

This property contains a dictionary of name and URL pairs. Shortcodes are used to process any content in the `Item` or the author `Identity`. Text that uses the `:shortcode:` convention will be replaced by an image at display. For example:

```javascript
item.body = "<p>THE :ONE: AND ONLY :CHOCK: WAS HEAR</p>";
item.shortcodes = { "ONE": "https://example.com/one.jpg", "CHOCK": "https://chocklock.com/favicon.ico" };
```

Shortcode tokens must not contain spaces or additional colons: using `:my fancy code:` or `:what:the:hell:` is invalid and will be ignored. 

---
### Identity

An `Item` can have a author that indicates how the content was created. It can be a person, a woman, a man, a camera, or a TV. The information is used to present an avatar and display name in the timeline. Feed verification can also optionally return an `accountIdentity`.

```javascript
const name = "CHOCK OF THE LOCK";
const identity = Identity.createWithName(name);
identity.uri = "https://chocklock.com";
identity.avatar = "https://chocklock.com/favicon.ico";

item.author = identity;
```

An `Identity` instance can also be constructed with the `create()` function which takes each of the properties in order:

```javascript
item.author = Identity.create("CHOCK OF THE LOCK", null /* username */, "https://chocklock.com/favicon.ico", "https://chocklock.com");
```

#### name: String (required)

The name of the creator. Can be an account’s full name, a bot name, or anything to identify the data and source.

#### username: String

The name of the creator. Can be an account’s full name, a bot name, or anything to identify the data and source.

#### avatar: String

A string containing the URL for the creator’s avatar on the Internet. A Base64 encoded data URL can be used, if needed. If no avatar is specified a generic image will be displayed in the timeline.

#### uri: String

A unique URI for the creator on the Internet. Can be an individual’s account page, bot, or other type of creator. Will be used to show details for the creator if the URI can be converted to a browsable URL.

---
### Annotation

An `Item` can have annotations that indicates how the content arrived in the timeline. It can be used for boosts, replies, reposts, reblogs, or any other type of reference.

```javascript
const text = "CHOCK STAR";
const annotation = Annotation.createWithText(text);
annotation.icon = "https://chocklock.com/favicon.ico";
annotation.uri = "https://chocklock.com";

item.annotations = [annotation];
```

#### text: String (required)

The text for the annotation. It can be anything, but will be most useful to the user as something like "@chockenberry Boosted".

#### icon: String

A string containing a URL for the annotation’s icon. If no icon is specified only the text will be displayed in the timeline.

#### uri: String

A URI with more information about the annotation. For things like boosts/reposts/reblogs that are done by an account the user follows, a link to the account listed in the annotation would be appropriate.

---
### MediaAttachment

`Item`s can also have media attachments. Photos, videos, and audio are commonly available from APIs and other data sources, and this is how you get them into the timeline. They will be displayed under the HTML content.

```javascript
const attachment = MediaAttachment.createWithUrl(url);
attachment.mimeType = "image/gif";
attachment.text = "Yet another cat on the Internet.";
attachment.aspectSize = {width: 300, height: 400};
attachment.focalPoint = {x: 0, y: 0};

item.attachments = [attachment];
```

The supported file formats and extensions for images are:

  * PNG (Portable Network Graphic) - .png
  * TIFF (Tagged Image File Format) - .tiff or .tif
  * JPEG (Joint Photographic Experts Group) - .jpeg or .jpg
  * GIF (Graphic Interchange Format) - .gif (pronounced with a [soft G](https://en.wikipedia.org/wiki/Pronunciation_of_GIF)
  * BMP (Windows Bitmap Format) - .bmp or .BMPf
  * Windows Icon - .ico
  * Windows Cursor - .cur
  * XWindow bitmap - .xbm

The supported file formats and extensions for audio and video are:

  * AAC - .aac
  * AIFF - .aiff
  * AIFF Compressed - aifc
  * AVI - .avi
  * Audio Codec 3 (Dolby) - ac3
  * MPEG-4 Audio and Video - .mp4
  * MPEG-2 Video - .m2v
  * MPEG-2 Transport Stream - .ts
  * MPEG-1 Video - .mpg
  * MPEG-1 Audio Layer 2 - .mp2
  * MPEG-1 Audio Layer 3 - .mp3
  * Unix Audio - .au
  * 3GPP Container - .3gp, .3g2

An HLS playlist (.m3u8) should be specified explicitly as "video" or "audio" since Tapestry has no mechanism to examine the contents of the playlist.

#### url: String (required)

A string containing the URL for the media on the Internet. A Base64 encoded data URL can be used, if needed.

#### thumbnail: String

A string containing the URL for a lower resolution copy of the media. This is assumed to be an image file.

#### mimeType: String

A string that lets Tapestry know what kind of media is being attached. Currently supported types are "image", "video", and "audio". A subtype, such as "jpeg", "png", or "gif" can be supplied, but does not affect how the media is displayed.

If this value isn't provided, the file name extension for `url` will be used. If there is no file extension, "image" will be assumed.

Note that playlists, such as .m3u8, will be assumed to be audio (based upon the file extension). If the playlist contains video, set the `mimeType` explicitly to "video/mp4".

#### blurhash: String

A string that provides a placeholder image.

#### text: String

A string that describes the media (for accessibility)

#### aspectSize: Object

An object with `width` and `height` properties. The values are used to optimize the media placement in the timeline.

#### focalPoint: Object

An object with `x` and `x` properties. The values are used to center media in the timeline. If no values are specified, the center at (0, 0) is assumed.

---
### LinkAttachment

#### url: String (required)

A string containing the URL for the link on the Internet.

#### type: String

The type of link, typically an Open Graph [og:type](https://ogp.me/#types).

#### title: String

The title for the link, typically an Open Graph [og:title](https://ogp.me/#metadata).

#### subtitle: String aka "description"

The subtitle for the link, typically an Open Graph [og:description](https://ogp.me/#optional).

#### siteName: String

The site name for the link, typically an Open Graph [og:site\_name](https://ogp.me/#optional).

#### authorName: String

The author's name, typically as [HTML author metadata](https://www.w3.org/TR/2011/WD-html5-author-20110809/the-meta-element.html#meta-author).

#### authorProfile: String

A URL for the author, typically from [fediverse:creator](https://blog.joinmastodon.org/2024/07/highlighting-journalism-on-mastodon/).

#### image: String

An image for the link, typically the Open Graph [og:image](https://ogp.me/#metadata).

#### blurhash: String

A string that provides a placeholder image.

#### aspectSize: Object

An object with `width` and `height` properties, typically from Open Graph [og:image:width](https://ogp.me/#structured) and [og:image:height](https://ogp.me/#structured).

---
### PollAttachment

Used for attaching information about a poll to an `Item`.

```javascript
const attachment = PollAttachment.create();
attachment.options = [ PollOption.create("Option 1", 16), PollOption.create("Option 2", 26) ];
attachment.endDate = new Date();

item.attachments = [attachment];
```

#### options: Array of PollOptions (required)

An array of `PollOption` objects for each option in the poll.

#### endDate: Date (optional)

An optional date that the poll ends. If not specified, Tapestry renders the poll without showing a countdown time label.

#### multipleChoice: Bool (default false)

Set to `true` if the poll allows mutliple choices or not.

> **Compatibility:** Requires `minimum_app_version="1.3"` or higher.

---
### PollOption

Used to define an option for a `PollAttachment`.

```javascript
const a = PollOption.create("Zero votes.", 0);
const b = PollOption.create("This has 16 votes.", 16);
const c = PollOption.create("Unspecified votes.");
const poll = PollAttachment.create([a, b, c]);
```

#### title: String (required)
#### votes: Number (optional)

If `votes` is left unspecified on one or more options in a `PollAttachment`, Tapestry will not show vote totals or percentages.

> **Compatibility:** Requires `minimum_app_version="1.3"` or higher.

---
## Interface Functions

The Tapestry app will call the following functions in `plugin.js` when it needs the script to read or write data. If no implementation is provided, no action will be performed. For example, some sources will not need to `verify()` themselves.

All actions are performed asynchronously (using one or more JavaScript Promise objects). An action indicates that it has completed using the `processResults`, `processError`, and `processVerification` functions specified below.

---
### verify()

Determines if a site is reachable and gathers properties for the feed. After `processVerification` is called a feed can be saved by a user.

This function will only be called if `needs_verification` is set to true in the connectors’s configuration.

The properties returned can be user visible or used internally. An example of the former case is a display name will be used identify the feed. The latter case is a base URL that will be used to handle relative paths in the feed.

To return the results of verification, you must call `processVerification()`.

When you call `processVerification()` you can supply an object with these properties (all are optional):

  * displayName: `String` with a suggested name for a feed (e.g. an account name, blog name, etc.).
  * icon: `String` with a URL to an image that can be used as a graphic attached to the feed (e.g. an avatar).
  * baseUrl: `String` with a URL prefix for relative paths.
  * accountIdentity: `Identity` object that represents the logged in account for the feed.

For authenticated feeds (such as social media accounts), we suggest supplying an `accountIdentity` object (created with `Identity.create()`) that is configured with the user's display name, username, and avatar.

When a Tapestry user adds multiple feeds for the same connector that requires authentication (such as multiple Mastodon accounts), the information in `accountIdentity` can help the user tell the items from each feed apart in their timelines. For feeds without any associated user authentication, an `accountIdentity` will have little effect and isn't necessary.

If `icon` or `displayName` are omitted, then the ones supplied by `accountIdentity` will be used instead, if possible.

---
### load()

Your script should implement this function to load any new data and return it to the app with `processResults` or `processError`. Variables can be used to determine what to load. For example, whether to include mentions on Mastodon or not.

---
### performAction(actionId, actionValue, item)

Tapestry calls this function when an action needs to be performed by the connector.

  * actionId: A `String` with the action id
  * actionValue: The `String` value that was assigned to the action.
  * item: the `Item` instance that the action is being requested for.

After performing the action, call `actionComplete()` with the results.

> **Note:** Only one action per feed is allowed to be running at a time.
  
See section on `actions.json` and `actionComplete()` for more information on how to define and perform actions.

---
## Utility Functions

The following functions are available to the script to help it perform the actions listed above.

---
### sendRequest(url, method, parameters, extraHeaders, fullResponse) → Promise

Sends a request. If configured, a bearer token will be included with the request automatically.

  * url: `String` with the endpoint that will be retrieved.
  * method: `String` with the HTTP method for the request (default is "GET").
  * parameters: `String` with the parameters for HTML body of "POST" or "PUT" request. For example: "foo=1&bar=something" (default is null).
  * extraHeaders: `Dictionary` of `String` key/value pairs. They will be added to the request (default is null for no extra headers).
  * fullResponse: `Boolean` which causes response to include status code, headers, and body text.
  
Returns a `Promise` with a resolve handler with a String parameter and a reject handler with an Error parameter. The resolve handler’s string is:

> **Note:** The `url` is assumed to be properly encoded. Use JavaScript’s `encodeURI`, if needed.

For the "HEAD" method, the string result contains a JSON dictionary containing the HTTP status code, the response headers, and the URL that was loaded (which may be different than the request due to redirects):
  
```json
{
	"status": 404,
	"headers": {
		"last-modified": "Thu, 02 Mar 2023 21:46:29 GMT",
		"content-length": "15287",
		"...": "..."
	},
	"url": "https://example.com/redirect"
}
```

All successful requests return a string. Typically this will be HTML text or a JSON payload created from the response body. Regular expressions can be used on HTML and `JSON.parse` can be used to build queryable object. For XML text, `xmlParse()` can convert it to an object. In all cases, the data extracted will be returned to the Tapestry app.

The `parameters` string and values in `extraHeaders` can contain patterns that will be replaced with values managed by the Tapestry app:

  * `__ACCESS_TOKEN__` The access token returned when authenticating with OAuth or JWT.
  * `__CLIENT_ID__` The client ID used to identify the connector with the API.

For example, if you need to "POST" the client ID, you would use "client=\_\_CLIENT\_ID\_\_&text=foo" for the `parameters`. If you need this information in a header, use:

```javascript
	let extraHeaders = { "X-Client-Id", "__CLIENT_ID__" };
	sendRequest(url, "GET", null, extraHeaders)
	...
```

The `fullResponse` flag can be set to `true`. In this mode, the text response is a JSON dictionary that contains all the results from the request:

```json
{
	"status": 200,
	"headers": {
		"last-modified": "Thu, 02 Mar 2023 21:46:29 GMT",
		"content-length": "15287",
		"...": "..."
	},
	"url": "https://example.com/redirect",
	"body": "<!DOCTYPE html> ..."
}
```

#### EXAMPLE

A Mastodon user’s identity is determined by sending a request to verify credentials:

```javascript
function verify() {
	sendRequest(site + "/api/v1/accounts/verify_credentials")
	.then((text) => {
		const jsonObject = JSON.parse(text);
		
		const displayName = "@" + jsonObject["username"];
		const icon = jsonObject["avatar"];
		
		const verification = {
			displayName: displayName,
			icon: icon
		}
		processVerification(verification);
	})
	.catch((requestError) => {
		processError(requestError);
	});
}
```

> **Note:** The JavaScript code doesn’t have access to the OAuth access token (for security, no authentication information is exposed to the connector). If an access token is needed in a list of `parameters`, use `__ACCESS_TOKEN__` — it will be substituted before the request is sent to the endpoint.

---
### sendConditionalRequest(url, method, parameters, extraHeaders, fullResponse) → Promise

This performs an [HTTP conditional request](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Conditional_requests). 

The behavior is nearly identical to `sendRequest()` with one very important difference: If `fullResponse` is false or unspecified and the server responds with an `HTTP 304 Not Modified` response, the value returned by the promise will be `null`.

The purpose of this is to make it faster to check when content has changed since the last time it was requested. Internally the request's `url` is used as a key to record the modified date and/or etag as returned by the server. That information is then automatically added to the headers of your next conditional request for that same `url` so the server can know how to respond.

For feed-like data sources (such as RSS), this often results in a very significant speedup because it avoids re-downloading and re-importing unchanged content.

> **Note:** Not all web servers are correctly configured to support conditional requests. If the server doesn't send the required headers or otherwise ignores them, this function will fallback to behaving identically to `sendRequest()`.

> **Compatibility:** Requires `minimum_app_version="1.3"` or higher.

---
### processResults(results, isComplete)

Sends any data that’s retrieved to the Tapestry app for display.

  * results: `Array` with `Item` objects.
  * isComplete: `Boolean` with a flag that indicates that result collection is complete and can be displayed in the app timeline (default is true).

After returning a true value for `isComplete` any further results will be ignored. If you have multiple async `sendRequest` in your connector, you'll need to have some kind of reference counter to know when to set the flag to true. See the [Mastodon connector](https://github.com/TheIconfactory/Tapestry/blob/main/Plugins/org.joinmastodon/plugin.js) for an example of how to do this.

---
### processError(error)

Sends any error to the Tapestry app for display

  * error: `Error` which indicates what went wrong. Will be displayed in the user interface.

---
### processVerification(verification)

Sets the parameters for the site and service.

  * verification: dictionary `Object` or `String`.

The dictionary can contain the following:

  * displayName: `String` that will be used to name the feed. For example, a RSS feed name or a Mastodon account.
  * icon: `String` for an image URL that will be presented alongside the display name.
  * baseUrl: `String` that will be used to resolve relative URLs. Anything other than the protocol and hostname will be discarded.
  
When a string is returned, it will be used as a `displayName` with an empty `baseUrl` and default `icon`.

> **Note:** A `baseUrl` is typically used for feeds where the site is "feed.example.com" but images and other resources are loaded from "example.com".
  
---
### xmlParse(text) → (Object | Promise)

  * text: `String` is the text representation of the XML data.

If `minimum_app_version` is `1.3` or higher, this returns a `Promise` which asynchronously returns an `Object` or raises an error.

If `minimum_app_version` is unspecified or below `1.3`, this synchronously returns an `Object` or throws an error.

> **Note:** Do not assume that the order of the keys in the object dictionaries will be the same as they occurred in the XML. No order is preserved during processing (as is the case with JSON parsing).

To deal with the differences between XML and JavaScript objects (JSON), some processing is done on the XML.

If the XML has multiple nodes with the same name, they are put into an array. For example, the following XML:

```xml
<root>
	<metadata>Example</metadata>
	<entry>
		<title>First</title>
	</entry>
	<entry>
		<title>Second</title>
	</entry>
</root>		
```

Will generate:

```json
{
	"root": {
		"metadata": "Example",
		"entry": [
			{
				"title": "First"
			},
			{
				"title": "Second"
			}
		]
	}
}
```

When evaluating the result, you can use JavaScript’s `instanceof` operator. Using the example above, `object.root.entry instanceof Array` will return true, while `object.root instanceof Array` will return false. You can also use `Object`’s `.getOwnPropertyNames(object)` to get a list of properties generated for the node: in the example above, the properties of `object.root` are `[metadata,entry]`.

A node’s attributes are stored in a sibling object with a "$attrs" key. The dollar sign was chosen because it’s an invalid XML node name, but is a valid JavaScript property name. This makes it easy to access with a path like `object.root.node$attrs`.

For example, this XML:

```xml
<root>
	<node first="1" second="2" third="3">value</node>
</root>
```

Produces:

```json
{
	"root" : {
		"node" : "value",
		"node$attrs" : {
			"first" : "1",
			"second" : "2",
			"third" : "3"
		}
	}
}
```

Note that these two processing steps can be combined in some cases. An example is multiple link nodes with nothing but attributes:

```xml
<root>
	<link first="abc" second="def" />
	<link first="hij" second="klm" />
</root>
```

Will only produce attribute dictionaries:
 
```json
{
	"root" : {
		"link$attrs" : [
			{
				"first" : "abc",
				"second" : "def"
			},
			{
				"first" : "hij",
				"second" : "klm"
			}
		]
	}
}
```

Note also that text that’s not a part of a node will be ignored. For example:

```xml
<root>
	text
	<node>value</node>
</root>
```

Results:

```json
{
	"root" : {
		"node" : "value"
	}
}
```

XML elements with type "xhtml" will generate the node and its children as described above. It will also provide a text representation of those nodes in a "$xhtml" sibling object. This is mainly a convenience for parsing XHTML content elements in Atom RSS feeds:

```javascript
	if (entry.content$attrs["type"] == "xhtml") {
		content = entry.content$xhtml;
	}
	else {
		content = entry.content;
	}
```

Finally, not all XML nodes will be accessible with a object property path. An XML node with a namespace will be represented as `namespace:key` and that’s an invalid identifier in JavaScript. You will need to access these values using the index operator instead: `object["namespace.key"]`.

This functionality should be enough to parse XML generated from hierarchical data, such as an RSS feed generated by a WordPress database of posts.

> **Compatibility:** Returns a `Promise` if `minimum_app_version="1.3"` or higher.

---
### plistParse(text) → (Object | Promise)

  * text: `String` is the text representation of the property list data formatted as XML.

If `minimum_app_version` is `1.3` or higher, this returns a `Promise` which asynchronously returns an `Object` or raises an error.

If `minimum_app_version` is unspecified or below `1.3`, this synchronously returns an `Object` or throws an error.

Note that old style property lists or JSON property lists are not supported.

> **Compatibility:** Returns a `Promise` if `minimum_app_version="1.3"` or higher.

---
### extractProperties(text) → (Object | Promise)

  * text: `String` is HTML content with `<meta>` properties (such as Open Graph).

If `minimum_app_version` is `1.3` or higher, this returns a `Promise` which asynchronously returns an `Object` or raises an error.

If `minimum_app_version` is unspecified or below `1.3`, this synchronously returns an `Object` or throws an error.

The `Object` representation contains the HTML’s properties. These values can be used to generate link previews or enhance the content without scraping the markup.

> **Compatibility:** Returns a `Promise` if `minimum_app_version="1.3"` or higher.

---
### lookupIcon(url) → Promise

  * url: `String` with a path to an HTML page
  
Returns a `Promise` with a resolve handler that includes a `String` parameter with a path to an icon for the page. If no icon can be found, a `null` value is returned.

---
### setItem(key, value)

  * key: `String` a key for value being stored.
  * value: `String` to be saved in local storage.
  
Items can be removed from local storage by passing a `null` value. The amount of local storage is limited to 100,000 total characters and any items set beyond that threshold will be ignored.
  
---
### getItem(key) → String

  * key: `String` a key for value that was stored.
  
Returns a `String` that was saved in local storage. If no value was stored, `null` is returned.

---
### clearItems()

All items in local storage are removed.

---
### actionComplete(results, error)

Indicates that the action has been performed. Must be called.

  * results: An `Item` or Array of `Item`s that were updated. A null value indicates there were no results.
  * error: If not null, the `Error` indicates what went wrong and will be displayed in the user interface.

See section on `actions.json` for more information on how to complete actions.

> **Compatibility:** Returning an array of `Item`s requires `minimum_app_version="1.4"` or higher.

---
### require(resourceName) → Value | Object | String | false

  * resourceName: `String` with the name of a text resource to load.
  
The connector folder can contain a folder named "resources". The files in that folder are loaded using this function.

The resource’s file name extension determines what type of data is returned:

  * **".js"** causes the contents of the file to be evaluated and any resulting value is returned. This can be used to define functions that are used by `plugin.js` and allow you to organize and share your code. Any errors during evaluation will throw an exception that’s displayed in the user interface.
  * **".json"** parses the contents of the file and returns the resulting `Object`. If no object can be parsed, `false` is returned.
  * Any other extension, including **".txt"** returns the contents of the file as a UTF-8 `String`.
  * If the file contains any other kind of data, such as an image, `false` is returned.

Files in resources folder can be symbolic links (not aliases) to other files in the folder that contains the connectors. This way the connectors "com.example.one" and "com.example.two" can share common code in a single file. When you save a connector, the symbolic links are resolved and stored individually in the resulting .tapestry file.

If you are loading functions, errors can be detected with a `false` return value:

```javascript
if (require('utility.js') === false) {
	throw new Error("Failed to load utility.js");
}
```

This can be extended to ensure that `String` and `Object` are loaded correctly.

```javascript
let template = require('template.txt');
if (template === false) {
	throw new Error("Failed to load template")
}
else {
	console.log(`template = ${template}`)
}
```

If you have used Node.js’s module loading, the approach above is very similar approach. Note that there is no need to export functions from the .js file that is being loaded: all functions and variables in the file are exported.

---
### raiseCondition(condition, title, description)

Raises an persistent error condition that will be presented as a fatal error to the user:

  * type: A `String` with the type of condition: either "authorize" or "disable".
  * title: A `String` with a short description of the condition.
  * message: A `String` with a longer description.

When "authorize" is used, the authorization tokens for the feed will be removed. A prominent user interface will prompt the user to reauthorize the feed.

When "disable" is used, the condition is displayed prominently and the user will be given an option to disable the feed.

Any other `type` is ignored.

---
## Configuration

Each connector is defined using the following files:

  * `plugin-config.json` (Required)
  * `plugin.js` (Required)
  * `ui-config.json` (Optional)
  * `README.md` (Recommended)
  * `suggestions.json` (Optional)
  * `discovery.json` (Optional)
  * `actions.json` (Optional)
  
The contents of each of these files is discussed below.

---
### plugin-config.json

Required properties:

  * id: `String` with reverse domain name for uniqueness (e.g. org.joinmastodon or blog.micro)
  * display_name: `String` with name that will be displayed in user interface

Recommended properties:

  * site: `String` with the primary endpoint for the connector's API. This parameter is used in several different contexts:
  
  	- If not provided, the user will be prompted for a URL during setup. If you are accessing an API with a single endpoint, please provide a value. In cases where each instance of the source will need its own site, for example a Mastodon instance or an RSS feed, do not provide a value and let the user set it up.
  	- The value will also be used as a base URL for relative authentication URLs (see the _NOTE_ below).
  	- The configured value or a value provided by the user will be provided as as JavaScript variable.
  	- The configured value or a value provided by the user will be used to control when Tapestry sends an "Authorization" HTTP header. If the request's scheme is "https" on the default port (443) and the same domain or subdomain of `site`, the header will be included. 

  * site\_prompt: `String` with a prompt for user input.
  * site\_placeholder: 'String' with a placeholder for user input.
    - If no `site` is configured, these properties are required.
  * site\_help: `String` with a short description of what’s required for `site`.
 
  * icon: `String` with a URL to an image that will be used as a default for this connector.
  * service\_name: `String` with the name of the service (e.g. "Tumblr", "YouTube", "Blog", "Podcast").
  * default\_color: `String` with a default color name for feeds created by the connector. Valid values are "purple", "gold", "blue", "coral", "slate", "orange", "green", "teal". If no value is specified, "gray" will be used.
  * item\_style: `String` with either "post" or "article" to define the content layout.
  * version: `Number` with an integer value that increments with newer versions of the connector. If no value is supplied, 1 is assumed.
  * crosstalk: `String` with "inclusive", "exclusive", or "disabled". See the explanation of these modes below.
  * minimum\_app\_version: `String` with the version number of the Tapestry app that must be used for the connector. If the app version is lower than the specified value, the connector will be ignored until a newer version is installed. **Some API behaviors are also influenced by this setting!**
  
Optional properties:

  * needs\_verification: `Boolean` with true if verification is needed (by calling `verify()`)
  * verify\_variables: `Boolean` with true if variable changes cause verification. Use this option if changing a variable will affect  loading content (because its a part of a URL, for example).
  * provides\_attachments: `Boolean` with true if connector generates attachments directly, otherwise post-processing of HTML content will be used to capture images, videos, and link previews.
  * authorization\_header: `String` with a template for the authorization header. If no value is specified, "Bearer \_\_ACCESS\_TOKEN\_\_" will be used. See below for options.
  * refresh\_status\_code: `Number` with the HTTP status code that indicates authorization needs to be refreshed. Default value is 401. A value of 0 will not attempt to refresh tokens.
  * check\_interval: `Number` with number of seconds between load requests (currently unimplemented).
  * synchronizable\_credentials: `Boolean` allows feed authentication tokens to by synced using iCloud keychain when `true` (default is `true`).
  * hidden\_tag\_classes: `Array` of `String`s of HTML CSS class names. HTML tags in an item's body with a matching class will be hidden when rendering the item preview for the timeline.

Optional OAuth properties:

  * register: `String` with endpoint to register the Tapestry app (e.g. "/api/v1/apps").
  * oauth\_authorize: `String` with endpoint to authorize account (e.g. "/oauth/authorize").
  * oauth\_token: `String` with endpoint to get bearer token (e.g. "/oauth/token").
  * oauth\_type: `String` with response type parameter (currently, only "code" is supported).
  * oauth\_code\_key: `String` with code result from authorize endpoint (e.g "code").
  * oauth\_scope: `String` with scope used to register and get token (e.g. "read+write+push").
  * oauth\_grant\_type: `String` with grant type (currently, only "authorization\_code" is supported).
  * oauth\_http\_redirect: `Boolean`, with true, the OAuth redirect URI will be "https://iconfactory.com/tapestry-oauth", otherwise "tapestry://oauth" is used.
  * oauth\_basic\_auth: `Boolean`, with true, the client id and secret will be added to a Basic authentication header when generating or refreshing tokens.
  * oauth\_authorize\_omit\_secret: `Boolean`, with true, the client secret will not be sent to the `oauth_authorize` endpoint. This is needed for Google's OAuth 2.0 server.
  * oauth\_extra\_parameters: `String` with extra parameters for authorization request (e.g. "&duration=permanent&foo=bar")
  * needs\_api\_keys: `Boolean`, with true, user interface will prompt for OAuth API keys and store them securely in the user's keychain. Ignored if a `register` endpoint is specified or if there is no `oauth_authorize` endpoint.

Optional JWT properties:

  * jwt\_prompt: `String` with account information needed to login (e.g. "Email Address").
  * jwt\_authorize: `String` with endpoint to authorize account (e.g. "/xrpc/createSession").
  * jwt\_refresh: `String` with endpoint to refresh account (e.g. "/xrpc/refreshSession").

> **Note:** When using OAuth, Tapestry looks for `access_token` and `refresh_token` during the token exchange. With JWT, `accessJwt` and `refreshJwt` are used. These values are stored securely in the users' keychain.

> **Note:** The oauth\_authorize, oauth\_token, jwt\_authorize, and jwt\_refresh endpoints can be relative or absolute URLs. Relative paths use the `site` variable above as a base (allowing a single connector to support multiple federated servers, like with Mastodon). Absolute paths allow different domains to be used for the initial authorize and token generation (as with Tumblr).

The `authorization_header` string provides a template for the API endpoints. The following items in the string will be replaced with values managed by the Tapestry app:

  * `__ACCESS_TOKEN__` The access token returned when authenticating with OAuth or JWT.
  * `__CLIENT_ID__` The client ID used to identify the connector with the API.
  
For example, a string value of `OAuth oauth_consumer_key="__CLIENT_ID__", oauth_token="__ACCESS_TOKEN__"` will generate the following header:

	Authorization: OAuth oauth_consumer_key="dead-beef-1234" oauth_token="feed-face-5678"

Any credentials collected by Tapestry are used automatically during a `sendRequest`. An authorization header will be added when the following are true:

  * URL scheme is HTTPS
  * Port is 443
  * The host is a domain or subdomain of the feed's URL. For example, if the feed originates at `example.com`, requests to `api.example.com` will get the header, but requests to `1337hacker.com` will not.

Connectors can be configured for Tapestry’s Crosstalk feature using the `crosstalk` property. The options are:

  * `inclusive`: Crosstalk checks items in this connector’s feeds and all items in other feeds where Crosstalk is enabled. This is the default behavior.
  * `exclusive`: Crosstalk is only checked with items from other feeds that _do not_ use this connector. If two items are similar and use the same connector, they are _not marked_ as Crosstalk. This mode is used by some connectors to prevent daily items from being labeled as Crosstalk even though they have very similar content ("FoxTrot" and "FoxTrot Classics", for example).
  * `disabled`: Opts this connector entirely out of Crosstalk. Items from feeds using this connector will never be checked or labeled as Crosstalk even if they are similar to an item in another feed.
  
#### EXAMPLES

The configuration for the Mastodon connector is:

```json
{
	"id": "org.joinmastodon",
	"display_name": "Mastodon",
	"register": "/api/v1/apps",
	"oauth_authorize": "/oauth/authorize",
	"oauth_token": "/oauth/token",
	"oauth_type": "code",
	"oauth_code_key": "code",
	"oauth_scope": "read+write+push",
	"oauth_grant_type": "authorization_code",
	"provides_attachments": true,
	"check_interval": 300
}
```

The configuration for the JSON Feed connector is:

```json
{
	"id": "org.jsonfeed",
	"display_name": "JSON Feed",
	"needs_verification": true,
	"check_interval": 300
}
```
 
---
### ui-config.json

The user interface in the Tapestry app is configured with this file. A connector can have any number of inputs, specified as an `Array`. Each input has this required property:

  * name: `String` with the name of the input. This value is used to generate variables for `plugin.js`.

And these optional properties:

  * type: `String` with the type of input: "text", "switch", "choices".
  * prompt: `String` with the name displayed in the user interface.
  * placeholder: `String` with a placeholder value for the user interface.
  * value: `String` with a default value.
  * choices: `String` with a comma separated list of values that will be displayed in a menu.

If no `prompt` is specified, the capitalized name of the variable is used. If no `type` is specified, "text" will be assumed.

A variable with the type `switch` will present a switch in the configuration interface and sets a value of "on" or "off" (the default value). A `choices` type uses a popup menu with the strings in a comma separated list, with the default being the first item in the list.

Multiple inputs with the same name will result in undefined behavior. It won’t act predicably in the configuration interface or `plugin.js`.

These variables, and the changes that each user makes to them, are persisted by Tapestry. If the configuration of the inputs changes, existing values will be maintained and any new variables will get a default value. Variables that are removed from the configuration will also be removed from the user's persisted values.

#### EXAMPLE

Here is an example of the different kinds of variables:

```json
{
	"inputs": [
		{
			"name": "simple"
		},
		{
			"name": "title",
			"type": "text",
			"placeholder": "Enter a description"
		},
		{
			"name": "turbo",
			"type": "switch",
			"prompt": "TURBO",
			"placeholder": "No default value, will be 'off'"
		},
		{
			"name": "reticulate_splines",
			"type": "switch",
			"prompt": "Reticulate Splines",
			"value": "on",
			"placeholder": "When enabled, splines will be reticulated"
		},
		{
			"name": "dessert_choice",
			"type": "choices",
			"prompt": "Dessert Choice",
			"value": "Banana Cream Pie",
			"choices": "Apple Pie,   Banana Cream Pie,Chestnut Pie, Doomsday Cake, Everything Bagel",
			"placeholder": "Choose your dessert"
		}
	]
}
```

---
### plugin.js

A JavaScript file that implements the Actions specified above using the Functions listed above. This is the file that pulls all the pieces described above into code that gets data and transforms it for use in the universal timeline.

The following `plugin.js` script is used in a connector that retrieves all recent earthquakes from the U.S. Geological Survey (USGS). This is all that's needed to create posts for the universal timeline:

```javascript
function load() {

	let summaryName = "4.5_day";
	
	const endpoint = `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/${summaryName}.geojson`;

	sendRequest(endpoint)
	.then((text) => {
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
	})
	.catch((requestError) => {
		processError(requestError);
	});
}
```

This connector took about an hour to write with no prior knowledge of the API or data formats involved. All of the connectors in the current version of the Tapestry app range in length from about 50 to 200 lines of code (including comments).

---
### README.md

This file, formatted with Markdown, is displayed in Tapestry when the user views your connector’s information. It is highly recommended since it provides valuable context for the end user.

Only inline styles are supported (e.g. no `#` header blocks or images). This is a limitation of displaying Markdown in user interface controls on Apple platforms. 

Here is an example:

```markdown
This connector displays a feed of earthquakes from around the world. The feed is
generated by the [USGS](https://earthquake.usgs.gov).

The feed can be configured to show significant quakes or ones above a certain
threshold on the Richter scale.

This first connector for Tapestry was written by Craig Hockenberry 
([@chockenberry](https://mastodon.social/@chockenberry)) while creating a prototype.
```

---
### suggestions.json

The contents of this file will help the user setup the connector. There are two types of suggestions: one for site URLs and another for settings.

For example, the RSS connector suggests a few sites to help someone set up a feed the first time:

```json
{
	"sites": [
		{
			"value": "https://feeds.kottke.org/main",
			"title": "Kottke"
		},
		{
			"value": "https://www.apple.com/newsroom/rss-feed.rss",
			"title": "Apple Newsroom"
		}
	]
}
```

Settings for variables can also be suggested. The `name` parameter should match the one in `ui-config.json`. The `title` should be kept fairly short because of the width limitations on mobile devices:

```json
{
	"variables": [
		{
			"name": "reticulate_splines",
			"value": "false",
			"title": "ECO Mode"
		},
		{
			"name": "message",
			"value": "Now is the time for all good men to come to the aid of their party",
			"title": "Long Message"
		},
		{
			"name": "short",
			"value": "Hi.",
			"title": "Short",
		}
	]
}
```

If multiple names and values are needed, the following form can be used:

```json
	"variables": [
		{
			"title": "@Gargron",
			"names": [
				"account",
				"site"
			],
			"values": [
				"Gargron",
				"https://mastodon.social"
			]
		}
	]
```

---
### apps.json

The contents of this file will help the user select a native app to be used by feeds created with this connector.

```json
{
	"apps": [
		{
			"id": "com.github.feditext",
			"name": "Feditext",
			"template": "feditext://__HOST_PATH__",
			"pattern": "https://([^:/\\s]+)(/(users/|@)[a-zA-Z0-9_]+.*)"
		},
		{
			"id": "com.github.Dimillian",
			"name": "Ice Cubes",
			"template": "IceCubesApp://__HOST_PATH__",
			"pattern": "https://([^:/\\s]+)(/(users/|@)[a-zA-Z0-9_]+.*)"
		},
		{
			"id": "com.tapbots",
			"name": "Ivory",
			"template": "ivory:///openURL?url=__URL_ENCODED__",
			"pattern": "https://([^:/\\s]+)(/(users/|@)[a-zA-Z0-9_]+.*)"
		},
		{
			"id": "app.getmammoth",
			"name": "Mammoth",
			"template": "mammoth://__HOST_PATH__",
			"pattern": "https://([^:/\\s]+)(/(users/|@)[a-zA-Z0-9_]+.*)"
		},
		{
			"id": "com.github.JunyuKuang",
			"name": "Mona",
			"template": "mona://__HOST_PATH__",
			"pattern": "https://([^:/\\s]+)(/(users/|@)[a-zA-Z0-9_]+.*)"
		}
	]
}
```

The following components can be used as replacements in `template`:

  * \_\_HOST\_PATH\_\_ = `mastodon.social/@chockenberry/112973783761167377`
  * \_\_PATH\_\_ = `/@chockenberry/112973783761167377`
  * \_\_URL\_ENCODED\_\_ = `https:%3A%2F%2Fmastodon.social%2F%40chockenberry%2F112973783761167377`
  * \_\_URL\_\_ = `https://mastodon.social/@chockenberry/112973783761167377`


With this URL:

> https://mastodon.social/@chockenberry/112973783761167377

If the user has chosen Ivory as a native app, the URL will be transformed using \_\_URL\_ENCODED\_\_ to:

> `ivory:///openURL?url=https:%3A%2F%2Fmastodon.social%2F%40chockenberry%2F112973783761167377`

When the a user chooses Mona, Mammoth, Ice Cubes, or Feditext, the URL will be transformed with \_\_HOST\_PATH\_\_ to:

> `mona://mastodon.social/@chockenberry/112973783761167377`

The \_\_URL\_\_ template value can be useful for apps that support [Universal Links](https://developer.apple.com/ios/universal-links/). The URL will be handled externally by the operating system and the user is presented with a choice to use an app:

```json
{
	"apps": [
		{
			"id": "com.tumblr",
			"name": "Tumblr",
			"template": "__URL__",
			"pattern": "https://([a-z0-9_]+\\.|)tumblr\\.com"
		}
	]
}
```

The `pattern` is a case-insensitive regular expression. When a link’s URL matches the pattern, the URL created by the template will be opened.

---
### discovery.json

This file helps the user find your connector when they have a URL to a page of HTML. The rules in this file will be checked and if all constraints match, the connector will be suggested to the user in an interface that simplifies set up.

The file consists of three categories: one specifies a list of sites where the connector can be used, the other two specify a list of rules for the URL and HTML.

```json
{
	"sites": [],
	"url": [],
	"html": [],
	"xml": []
}
```

All three categories must match in order to be displayed. If one of these category is not supplied, it has no constraints, so it is considered a match.

The following sections describe each category.

#### sites

The sites category is a list of strings where the connector can be used. These checks are performed on the URL that is supplied by the user.

For example. the `com.example` connector only works on one site so it uses:

```json
	"site": [
		"example.com"
	],
```

The YouTube connector will work on many different domains. Note that "youtube." will match "youtube.de", "youtube.fr", as well as the more familiar "youtube.com". The match does not use regular expressions.

```json
 	"site": [
 		"youtube.",
 		"youtu.be",
 		"youtubekids.com"
 	],
```

Matches are case insensitive. If a user types "YouTube.com/@iJustine", it will match the "youtube." rule above.

If the sites rules do not match, no further checks are performed and the connector is not suggested to the user.

#### url

The rules for the user’s URL consist of two parts:

  * extract (required): a regex pattern that will be used on the URL and passed to the `variable`.
  * variable (required): `site` or any variable defined in `ui-config.json` that will be set using `extract`.

If the `extract` pattern is empty it's considered a match and the full URL will be passed to the variable (this will likely be the `site`). The following example sets the `site` variable with the URL entered by the user.

```json
	"url": [
		{
			"extract": "",
			"variable": "site"
		}
	]
```

The `extract` regex pattern begins and ends with a single slash ("/") character. If no match is found, the rule fails and the connector is not offered as a suggestion. The `variable` parameter can contain a single variable name or a comma separated list.

All regular expressions are, like the web itself, case insensitive. The pattern "/foo/" will match "FOOBAR" in both the URL and HTML.

If necessary, non-capturing groups like "(?:foo|bar)" can be used in the regular expression.

This example extracts the "aww" from `http://reddit.com/r/aww/whatever` and puts it in a "subreddit" variable:

```json
	"url": [
		{
			"extract": "/reddit.com/r/([^/]+)/",
			"variable": "subreddit"
		}
	]
```

This example extracts two capture groups from `https://mastodon.social/tags/TapestryApp`. The first one sets `site` to "https://mastodon.social" and the second puts "TapestryApp" in a "tag" variable:

```json
	"url": [
		{
			"extract": "/(https://[^:/\\s]+)/tags/([a-zA-Z0-9_]+.*)/",
			"variable": "site, tag"
		}
	]
```

#### html

The content at the URL provided by the user can also be checked. HTML rules operate in one of two modes:

  * **Attribute mode** (when `check` is provided): Collects all elements of a specific type, checks an attribute of those elements against `match`, and optionally extracts a value from another attribute.
  * **Content mode** (when `check` is omitted): Collects all elements of a specific type and applies `match` against the element's text content. This is useful for matching data embedded inside `<script>` tags or other elements where the relevant data is in the body text rather than an attribute.

This approach allows your connector to check things like `<link>` or `<meta>` tags as well as `<script>` tag contents. For example, a page that has the following HTML markup can be used with a connector that handles RSS feeds:

```html
<link rel="alternate" type="application/atom+xml" href="/feeds/main" />
```

The `html` rules use the following properties:

  * `element` (required): the elements in the HTML to check: "link", "meta", "script", or any other tag.
  * `check` (optional): the attribute in the element to check. If omitted, the rule operates in content mode and `match` is applied to the element's text content instead.
  * `match` (required): a string _or_ regex pattern that will be used to find matching values.
  * `use` (optional, attribute mode only): the attribute in the element that contains a value to use with the connector.
  * `extract` (optional, attribute mode only): a string _or_ regex pattern that will be used on the value specified by `use` and passed to the `variable`.
  * `transform` (optional): a template string applied as the final step before assigning to `variable`. Uses `$0` for the full match and `$1`, `$2`, etc. for capture groups from the `match` regex.
  * `variable` (optional): `site` or any variable defined in `ui-config.json` that will be set.

Both `match` and `extract` can be:

  * a string to match (e.g. "Mastodon" or "application/rss+xml")
  * a regex pattern that begins and ends with a single slash ("/") (e.g. "/example.com/([^/]+)/"

An HTML rule will fail if any of the following are true:

  * The HTML contains no `element` tags.
  * In attribute mode: the `check` attribute doesn't exist on any element, or `match` is not satisfied.
  * In content mode: no element's text content satisfies `match`.
  * If `use` is specified and no `extract` match is found.

The "href" attribute value in a `use` property will always return an absolute URL, even if there is a relative URL in the document. Variables, specifically `site`, will need a fully qualified domain name to access data since the connector has no notion of a base URL.

##### Rule evaluation

When multiple rules target **different** variables (or have no variable), they must **all** pass — this is AND logic.

When multiple rules target the **same** variable, they are treated as **alternatives** — the first rule that succeeds wins. If none succeed, the check fails. This allows a connector to define multiple strategies for discovering the same value.

##### Attribute mode examples

Get the URL for an RSS feed. Note the use of a `match` pattern with a non-capturing group that allows both the RSS and Atom formats:

```json
	"html": [
		{
			"element": "link",
			"check": "type",
			"match": "/application/(?:rss|atom)\\+xml/",
			"use": "href",
			"variable": "site"
		}
	]
```

Also note that backslashes need to be escaped because they are passed as strings to Swift's Regex framework. Forward slashes do not need to be escaped.

A simpler example just checks if there is a subscribe URL for Micro.blog without setting a variable:

```json
	"html": [
		{
			"element": "link",
			"check": "rel",
			"match": "subscribe",
			"use": "href",
			"extract": "https://micro.blog/users/follow"
		}
	]
```

Multiple rules that must all pass. The first rule below checks if there is an Open Graph `og:site_name` meta property that contains the word "Mastodon". If it does, there is another check for the `og:url` property where the `site` variable can be extracted:

```json
	"html": [
		{
			"element": "meta",
			"check": "property",
			"match": "og:site_name",
			"use": "content",
			"extract": "/.*Mastodon.*/"
		},
		{
			"element": "meta",
			"check": "property",
			"match": "og:url",
			"use": "content",
			"extract": "/(https://[^/]+)/",
			"variable": "site"
		}
	]
```

The connector for podcasts uses two rules that must both pass — the second rule has no `variable`, making it a filter that narrows the match to podcast sites specifically:

```json
		{
			"element": "link",
			"check": "type",
			"match": "application/rss+xml",
			"use": "href",
			"variable": "site"
		},
		{
			"element": "a",
			"check": "href",
			"match": "///(?:podcasts.apple.com|apple.co)//"
		}
```

The first rule checks that there is an RSS feed while the second rule checks if there is a link on the page to Apple's podcast directory.

##### Content mode example

YouTube channel pages have an RSS `<link>` tag, but watch pages do not. Instead the channel ID is embedded in a `<script>` tag's JSON. Using content mode and same-variable alternatives, both cases can be handled:

```json
	"html": [
		{
			"element": "link",
			"check": "type",
			"match": "application/rss+xml",
			"use": "href",
			"variable": "site"
		},
		{
			"element": "script",
			"match": "/\"channelId\"\\s*:\\s*\"(UC[A-Za-z0-9_-]+)\"/",
			"transform": "https://www.youtube.com/channel/$1",
			"variable": "site"
		}
	]
```

Both rules target `site`, so they are alternatives. On a channel page, the first rule matches the RSS link and the second rule is skipped. On a watch page, the first rule fails (no RSS link), so the second rule matches `"channelId"` in a script's text content and uses `transform` to build a channel URL from the captured group.

#### xml

If none of the rules above apply, the content can be checked for XML elements. There are two parameters, both of which are required. This example will identify podcast feeds:

```json
	"xml": [
		{
			"root": "rss",
			"with": "itunes:image"
		}
	]
```

The `root` element must be the first element in the content. In the example above, it guarantees that the XML data is in the RSS format.

The `with` element must occur at least once in the content. The example above checks that the RSS feed contains an iTunes image, which is required for a podcast.

#### json

If none of the rules above apply, the content can be checked for JSON keys. There are two parameters, both of which are required. This example identifies the JSON Feed format:

```json
	"json": [
		{
			"key": "version",
			"value": "https://jsonfeed.org/version/1.1"
		}
	]
```

The `key` must be a top-level key in the JSON content. The example ensures that the JSON dictionary has a `version` key with the correct `value`.

---
### actions.json

This file defines actions that can alter items supplied by a connector. An action is defined and referenced by `id`, however the `name` and `icon` are displayed in the Tapestry user interface. The `icon` can be any SF Symbol name or one of Tapestry's built-in symbols (listed below).

As of Tapestry 1.4, actions can also have an optional `role` that further determines where the action is rendered in the UI, assumptions about the action's return values, and how it is expected to behave. (See roles listed below.)

By default, actions are displayed as buttons on items in the timeline and/or in the item's overflow menu.

The `actions.json` file must define all possible actions, however when displaying an individual item in the timeline, only the actions attached to that item will actually be presented to the user.

Actions are displayed or preferred in the order they are defined in the `actions.json` file.

```json
{
	"items": [
		{
			"id": "favorite",
			"name": "Add Favorite",
			"icon": "heart.fill"
		},
		{
			"id": "unfavorite",
			"name": "Remove Favorite",
			"icon": "heart"
		},
		{
			"id": "thread",
			"name": "Thread",
			"icon": "bubble",
			"role": "context"
		}
	],
}
```

When returning an `Item` in `processResults()` you can include a dictionary of `actions` that can be applied to that item. Each action has an `id` and a string value that will be passed to the action when it's performed.

For example, an action that marks an item as a favorite, might need an identifier: 

```javascript
	item.actions = { favorite: "123456" };
```

It's also likely that structured data will be needed, so JSON can be used as an action value:

```javascript
	item.actions = { like: `{ "uri": "at:..." }`, repost: `{ "uri": "at:..." }` };
```

When an item has one or more actions, a menu or one or more action buttons will be displayed in the app. When a user selects one of the actions the `performAction` function is called with the action `id`, `value`, and `item`.

It is the connector’s responsibility to manage the list of actions as the state of the item changes. For example, if an action to "favorite" is performed, the action would be removed from the item and replaced with "unfavorite" action with a different icon and/or name so the user can tell that the state has changed.

The modified item is returned to Tapestry using `actionComplete`. If the action cannot be performed, an `Error` should be returned and will be displayed to the user.

This example performs "favorite" and "unfavorite" on an item. Note that any part of the item can be modified: the body in this example, but it could be annotations or attachments as well. The example also shows how the state of the item is managed using `item.actions`:

```javascript

function performAction(actionId, actionValue, item) {
	console.log(`actionId = ${actionId}`);
	if (actionId == "favorite") {
		let content = item.body;
		content += "<p>Faved!</p>";
		item.body = content;
		
		let actions = item.actions;
		delete actions["favorite"];
		actions["unfavorite"] = "boo";
		item.actions = actions;
		actionComplete(item, null);
	}
	else if (actionId == "unfavorite") {
		let content = item.body;
		content += "<p><strong>UNFAVED!</strong></p>";
		item.body = content;

		let actions = item.actions;
		delete actions["unfavorite"];
		actions["favorite"] = "yay";
		item.actions = actions;
		actionComplete(item, null);
	}
	else if (actionId == "whoops") {
		let error = new Error("That wasn't supposed to happen!")
		actionComplete(null, error);
	}

```

#### Action Roles

The following roles are supported for actions.

By default, actions have a `null` role which means they don't get any special treatment and are generally displayed as buttons directly on the item in the timeline or, if there are too many, as options in the item's overflow menu.

**`"context"`**

A context action is expected to return additional context about the item such as a conversation thread. To display a conversation thread, for example, call `actionComplete()` with an array of `Item`s. The display order is preserved (Tapestry will not re-sort these items by date). It is your responsibility to return the original item in the resulting array in the position you want it to be displayed otherwise it will not be included in the resulting timeline view. Context actions appear in the swipe menu for items in the timeline and also replace the default "Details" button. (Added in Tapestry 1.4.)

#### Built-in Symbols

The following names can be used for the `icon` of an action:

tapestry.arrow.right.circle.fill
tapestry.bluesky
tapestry.bookmark.fill
tapestry.bookmark
tapestry.boost.fill
tapestry.boost
tapestry.counter.arrow
tapestry.crosstalk
tapestry.hashtag
tapestry.jump.back
tapestry.jump.to.marker
tapestry.jump.to.top
tapestry.mark.fill
tapestry.mark
tapestry.mastodon
tapestry.microblog
tapestry.muffled
tapestry.open.original
tapestry.person.2
tapestry.person
tapestry.reddit
tapestry.sparkles.premium
tapestry.star.fill
tapestry.star
tapestry.timeline.collapsed
tapestry.timeline.expanded
tapestry.timeline.mini
tapestry.tumblr
tapestry.view.details
tapestry.youtube

---
## HTML Content

### How Tapestry uses HTML

Tapestry's `Item` object uses HTML as its native content type. The `body` property will be used in two ways:

  1. To preview the post in the main timeline. A limited number of words (100-200) in the content will be displayed as formatted text. HTML tags can be used to influence this formatting (e.g. `<strong>` making bold text). Any content that won’t fit in the available space will end with "More…".
  2. The post’s detail view will display the full HTML content with styling provided by Tapestry’s current theme (e.g. dark vs. light). This content will be displayed as a web view.

Some HTML tags won’t appear in the preview. Things like `<table>`, `<ul>`, or `<hr/>` will only appear in the detail view. Our hope is that for most use cases, this will be fine. It’s rare to begin HTML with these kinds of tags, so previewing them is unnecessary. Additionally, the detail view will use a full WebKit rendering engine, so it can display any content not in the preview.

### HTML Preview Tags

In the first case, speed is of the essence. Timeline scrolling peformance can only be achieved with a subset of HTML that is converted to formatted text. In this context, think of your content text more like Markdown formatting than full HTML formatting.

The following tags are supported:

  * `<p>` to start a paragraph.
  * `<strong>, <b>` for **strongly emphasized** text.
  * `<em>, <i>` for _emphasized_ text.
  * `<strike>, <s>` for ~~strikethrough~~ text.
  * `<a>` for [linked](https://example.com) text.
  * `<img>` for inline attachments (see below).
  * `<blockquote>` for quoted text.
  * `<br>` for a newline in the context of a paragraph. Ignored outside a paragraph.

For example, if your connector provides the following `body`:

```html
<p><b>Bold</b>, <i>italic</i>, <b><i>both</i></b>,<br/> and <a href="#">link</a>.</p>
```

Tapestry will render a preview and detail view like this:


> **Bold**, _italic_, **_both_**,<br/>
> and [link](#).

As with all HTML, unclosed tags will provide unpredictable results. Close your tags.

### HTML Inline Attachments

Some attachments are easier to deal with as inline content. For example, a blog feed may contain several `<img>` tags that you want to see as images in the timeline.

As a part of the step to create the timeline preview, images can automatically be extracted from the HTML content and assigned as `MediaAttachment` objects.

For example, if your connector provides this content:
```
<p>In this blog post, I will explain our watermark.</p>
<p><img src="https://iconfactory.com/images-v8/if_watermark.png"/></p>
```

If no media attachments have been added to an item, Tapestry will create them automatically from inline images and show this in the media viewer:

<img width="46" height="46" src="https://iconfactory.com/images-v8/if_watermark.png"/>

If the `<img>` tag includes an `alt` attribute, that text will be included in the attachment and used to improve accessibility in the timeline.

A `LinkAttachment` can also be created automatically. Tapestry will check the first link in the first paragraph and show the preview card in the timeline if the link contains Open Graph information.

<table>
	<tr>
		<th>State</th>
		<th>Behavior</th>
	</tr>
	<tr>
		<td>True</td>
		<td>Good</td>
	</tr>
</table>
	
This behavior can be disabled with `"provides_attachments": true` in `plugin-config.json`. The Mastodon connector is an example of where this is used because its API provides attachments directly in the payload.

