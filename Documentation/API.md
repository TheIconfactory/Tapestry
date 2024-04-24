
# Tapestry API

## Introduction

The following document describes the JavaScript API that Tapestry uses to process information from the Internet. The components shown below are used to create "connectors" that allow a timeline to be populated from a data source.

This is a work-in-progress and details are certain to change.

Note that JavaScript in plug-ins must conform to the [ECMA-262 specification](http://www.ecma-international.org/publications/standards/Ecma-262.htm). This specification defines the language and its basic [functions](https://262.ecma-international.org/14.0/#sec-function-properties-of-the-global-object) and [objects](https://262.ecma-international.org/14.0/#sec-constructor-properties-of-the-global-object). Additions that support the Document Object Model (DOM) and other browser functions are not available.

## Variables

Any variables that have been specified in `ui-config.json` are set before the script is executed. For example, the Mastodon plug-in specifies the following inputs:

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

## Objects

The following objects are used to create content for the Tapestry app:


### Post

`Post` objects are used to populate a timeline in the app. One will also be used to add a new item to a service (and timeline). You create one with:

```javascript
const uri = "https://example.com/unique/path/to/content";
const date = Date();
const content = "This is <em>a contrived</em> example, but <b>so what?</b>".
const post = Post.createWithUriDateContent(uri, date, content);
```

#### uri: String (required)

A unique URI for the post on the Internet. Used to show details for the post.

#### date: Date (required)

The date and time when the post was created.

#### content: String (required)

Text with HTML formatting that will be displayed for the post. See the end of this document for how this content and its formatting is used.

#### creator: Creator

The creator of the content. See below.

#### attachments: Array of Attachment

Up to four media attachments for the content. See below.

_NOTE:_ Media attachments will be automatically created when inline images are used in the HTML of the `content` property unless the `providesAttachments` configuration parameter is set to true.

### Creator

A `Post` can have a creator that indicates how the content was created. It can be a person, a service, or a device. The information is used to present an avatar and header for the post in the timeline.

```javascript
const uri = "https://chocklock.com";
const name = "CHOCK OF THE LOCK";
const creator = Creator.createWithUriName(uri, name);
creator.avatar = "https://chocklock.com/favicon.ico";

post.creator = creator;
```

#### uri: String (required)

A unique URI for the creator on the Internet. Can be an individual’s account page, bot, or other type of creator. Will be used to show details for the creator.

#### name: String (required)

The name of the creator. Can be an account’s full name, a bot name, or anything to identify the data and source.

#### avatar: String

A string containing the URL for the creator’s avatar on the Internet. If no avatar is specified a generic image will be displayed in the timeline.


### Attachment

`Post`s can also have media attachments. Photos, videos, and audio are commonly available from APIs and other data sources, and this is how you get them into the timeline. They will be displayed under the HTML content.

```javascript
const attachment = Attachment.createWithMedia(media)
attachment.text = "Yet another cat on the Internet."

post.attachments = [attachment];
```

#### media: String (required)

A string containing the URL for the media on the Internet

#### thumbnail: String

A string containing the URL for a lower resolution copy of the media

#### text: String

A string that describes the media (for accessibility)

#### blurhash: String

A string that provides a placeholder image.

#### mimeType: String

A string that lets Tapestry know what kind of media is being attached. If this value isn't present, the file name
extension for `media` will be used.

#### authorizationHeader: String

This string provides an authorization template for accessing protected `media`. If a value is provided, the "Authorization" header will be set with the following items being replaced with values managed by the Tapestry app:

  * `__ACCESS_TOKEN__` The access token returned when authenticating with OAuth or JWT.
  * `__CLIENT_ID__` The client ID used to identify the plugin with the API.
  
For example, you could set a string value of `Bearer __ACCESS_TOKEN__` and an "Authorization: Bearer dead-beef-1234" header would be used when retrieving a `media` image.

## Actions

The Tapestry app will call the following functions in `plugin.js` when it needs the script to read or write data. If no implementation is provided, no action will be performed. For example, some sources will not need to `identify()` themselves.

All actions are performed asynchronously (using one or more JavaScript Promise objects). An action indicates that it has completed using the `processResults`, `processError`, and `setIdentifier` functions specified below.

### identify()

Determines the identity for the user and site. After `setIdentifier` is called with a String, it will displayed in the app when configuring the timeline. For example, "Mastodon (chockenberry)" allows a user to differentiate between separate accounts.

This function will only be called if `needsVerification` is set to true in the plug-in’s configuration.

### load()

Loads any new data and return it to the app with `processResults` or `processError`. Variables can be used to determine what to load. For example, whether to include mentions on Mastodon or not.

### send(post)

Use the supplied `Post` object to send data to a service. The `post.attachments` will contain a string URL in media and a description (if available): these attachments can be uploaded to a media endpoint using `uploadFile` before posting. 

This function will only be called if `canPost` is set to true in the plug-in’s configuration.

## Functions

The following functions are available to the script to help it perform the actions listed above.

### sendRequest(url, method, parameters, extraHeaders) → Promise

Sends a request. If configured, a bearer token will be included with the request automatically.

  * url: `String` with the endpoint that will be retrieved.
  * method: `String` with the HTTP method for the request (default is "GET").
  * parameters: `String` with the parameters for HTML body of "POST" or "PUT" request. For example: "foo=1&bar=something" (default is null).
  * extraHeaders: `Dictionary` of `String` key/value pairs. They will be added to the request (default is null for no extra headers).

Returns a `Promise` with a resolve handler with a String parameter and a reject handler with an Error parameter. The resolve handler’s string is:

_NOTE:_ The `url` is assumed to be properly encoded. Use JavaScript’s `encodeURI`, if needed.

  * For "HEAD" method, the string result contains a JSON dictionary:
  
```json
{
	"status": 404,
	"headers": {
		"last-modified": "Thu, 02 Mar 2023 21:46:29 GMT",
		"content-length": "15287",
		"...": "..."
	}
}
```

  * For all other successful requests, the string contains the response body. Typically this will be HTML text or a JSON payload. Regular expressions can be used on HTML and `JSON.parse` can be used to build queryable object. In both cases, the data extracted will be returned to the Tapestry app.

_NOTE:_ The `parameters` string can contain patterns that will be replaced with values managed by the Tapestry app:

  * `__ACCESS_TOKEN__` The access token returned when authenticating with OAuth or JWT.
  * `__CLIENT_ID__` The client ID used to identify the plugin with the API.

For example, if you need to "POST" the client ID, you would use "client=\_\_CLIENT\_ID\_\_&foo=1&bar=something".

#### EXAMPLE

A Mastodon user’s identity is determined by sending a request to verify credentials:

```javascript
function identify() {
	sendRequest(site + "/api/v1/accounts/verify_credentials")
	.then((text) => {
		const jsonObject = JSON.parse(text);
		
		const identifier = jsonObject["username"];
		setIdentifier(identifier);
	})
	.catch((requestError) => {
		processError(requestError);
	});
}
```

_NOTE:_ The JavaScript code doesn’t have access to the OAuth access token (for security, no authentication information is exposed to the plug-in). If an access token is needed in a list of `parameters`, use `__ACCESS_TOKEN__` — it will be substituted before the request is sent to the endpoint.


### processResults(results, complete)

Sends any data that’s retrieved to the Tapestry app for display.

  * results: `Array` with `Post` or `Creator` objects.
  * complete: `Boolean` with a flag that indicates that result collection is complete and can be displayed in the app timeline (default is true).


### processError(error)

Sends any error to the Tapestry app for display

  * error: `Error` which indicates what went wrong. Will be displayed in the user interface.

### setIdentifier(identifier)

Sets the identity for the site and service.

  * identifier: `String` or dictionary `Object` which helps user to identify the account being used.
  
_NOTE:_ When using a dictionary, an `identifier` for the site name and a `baseUrl` for media (which is different than the site) should be supplied. A dictionary is typically used for feeds where the site is "feed.example.com" but images and other resources are loaded from "example.com".
  
### uploadFile(file, mediaEndpoint) → Promise

  * file: `String` is the name retrieved from `post.attachments.media`. Do not modify this value, which points to a temporary file that will be used for the upload.
  * mediaEndpoint: `String` is the URL where multipart/form-data content will be delivered.

### xmlParse(text) → Object

  * text: `String` is the text representation of the XML data.
  
Returns an `Object` representation of the XML data, much like `JSON.parse` does.

_NOTE:_ Do not assume that the order of the keys in the object dictionaries will be the same as they occurred in the XML. No order is preserved during processing (as is the case with JSON parsing).

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

Finally, not all XML nodes will be accessible with a object property path. An XML node with a namespace will be represented as `namespace:key` and that’s an invalid identifier in JavaScript. You will need to access these values using the index operator instead: `object["namespace.key"]`.

This functionality should be enough to parse XML generated from hierarchical data, such as an RSS feed generated by a WordPress database of posts.

### plistParse(text) → Object

  * text: `String` is the text representation of the property list data formatted as XML.
  
Returns an `Object` representation of the data, much like `JSON.parse` does.

Note that old style property lists or JSON property lists are not supported.

## Configuration

Each connector plug-in is defined using the following files:

  * `plugin-config.json` (Required)
  * `plugin.js` (Required)
  * `ui-config.json` (Required)
  * `README.md` (Recommended)
  * `suggestions.json` (Optional)
  
The contents of each of these files is discussed below.

### plugin-config.json

Required properties:

  * id: `String` with reverse domain name for uniqueness (e.g. org.joinmastodon or blog.micro)
  * displayName: `String` with name that will be displayed in user interface

Recommended properties:

  * site: `String` with the primary endpoint for the plugin's API. This parameter is used in several different contexts:
  
  	- If not provided, the user will be prompted for a URL during setup. If you are accessing an API with a single endpoint, please provide a value. In cases where each instance of the source will need its own site, for example a Mastodon instance or an RSS feed, do not provide a value and let the user can set it up.
  	- The value will also be used as a base URL for relative authentication URLs (see the _NOTE_ below).
  	- The configured value or a value provided by the user will be provided as as JavaScript variable.
  	- The configured value or a value provided by the user will be used to control when Tapestry sends an "Authorization" HTTP header. If the request's scheme is "https" on the default port (443) and the same domain or subdomain of `site`, the header will be included. 

  * site\_prompt: `String` with a prompt for user input.
  * site\_placeholder: 'String' with a placeholder for user input.
  	- If no `site` is configured, these properties are required.
  	
Optional properties:

  * needs\_verification: `Boolean` with true if verification is needed (by calling `identify()`)
  * provides\_attachments: `Boolean` with true if connector generates attachments directly, otherwise post-processing of HTML content will be used to capture images & video.
  * authorization\_header: `String` with a template for the authorization header. If no value is specified, "Bearer \_\_ACCESS\_TOKEN\_\_" will be used. See below for options
  * check\_interval: `Number` with number of seconds between load requests (currently unimplemented).

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

  * jwt\_authorize: `String` with endpoint to authorize account (e.g. "/xrpc/createSession").
  * jwt\_refresh: `String` with endpoint to refresh account (e.g. "/xrpc/refreshSession").
 
_NOTE:_ The oauth\_authorize, oauth\_token, jwt\_authorize, and jwt\_refresh endpoints can be relative or absolute URLs. Relative paths use the `site` variable above as a base (allowing a single connector to support multiple federated servers, like with Mastodon). Absolute paths allow different domains to be used for the initial authorize and token generation (as with Tumblr).

_NOTE:_ The authorization\_header string provides a template for the API endpoints. The following items in the string will be replaced with values managed by the Tapestry app:

  * `__ACCESS_TOKEN__` The access token returned when authenticating with OAuth or JWT.
  * `__CLIENT_ID__` The client ID used to identify the plugin with the API.
  
For example, you could set a string value of `OAuth oauth_consumer_key="__CLIENT_ID__", oauth_token="__ACCESS_TOKEN__"` and the following header would be generated:

	Authorization: OAuth oauth_consumer_key="dead-beef-1234" oauth_token="feed-face-5678"

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
	"providesAttachments": true,
	"canPost": true,
	"check_interval": 300
}
```

The configuration for the JSON Feed connector is:

```json
{
	"id": "org.jsonfeed",
	"display_name": "JSON Feed",
	"needsVerification": true,
	"check_interval": 300
}
```
 
### ui-config.json

The user interface in the Tapestry app is configured with this file. A connector plug-in can have any number of inputs, specified as an `Array`. Each input has the these required properties:

  * name: `String` with the name of the input. This value is used to generate variables for `plugin.js`.
  * type: `String` with the type of input: "text", "switch", "choices".
  * prompt: `String` with the name displayed in the user interface.

And these optional properties:

  * placeholder: `String` with a placeholder value for the user interface.
  * value: `String` with a default value.
  * choices: `String` with a comma separated list of values that will be displayed in a menu.

These variables, and the changes that each user makes to them, are persisted by Tapestry. If the configuration of the inputs changes, existing values will be maintained and any new variables will get a default value. Variables that are removed from the configuration will also be removed from the user's persisted values.

#### EXAMPLES

The user interface configuration for the Mastodon connector is:

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

The user interface configuration for the JSON Feed connector is:

```json
{
	"inputs": [
		{
			"name": "site",
			"type": "url",
			"prompt": "Feed URL",
			"validate_as": "url",
			"placeholder": "https://foo.com/feed.json"
		}
	]
}
```

### plugin.js

A JavaScript file that implements the Actions specified above using the Functions listed above. This is the file that pulls all the pieces described above into code that gets data and transforms it for use in the universal timeline.

The following `plugin.js` script is used in a connector that retrieves all recent earthquakes from the U.S. Geological Survey (USGS). This is all that's needed to create posts for the universal timeline:

```javascript
function load() {
	const endpoint = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson";
	sendRequest(endpoint)
	.then((text) => {
		const jsonObject = JSON.parse(text);

		const creatorUrl = "https://earthquake.usgs.gov/";
		const creatorName = "USGS – Latest Earthquakes";
		let creator = Creator.createWithUriName(creatorUrl, creatorName);
		creator.avatar = "https://earthquake.usgs.gov/earthquakes/map/assets/pwa/icon-192x192.png";

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
			
			const content = "<p>" + text + " <a href=\"" + mapsUrl + "\">Open Map</a><p>"
			
			let post = Post.createWithUriDateContent(url, date, content);
			post.creator = creator;
			
			results.push(post);
		}
		processResults(results);
	})
	.catch((requestError) => {
		processError(requestError);
	});
}
```

This connector took about an hour to write with no prior knowledge of the API or data formats involved. All of the connectors in the current version of the Tapestry app range in length from about 50 to 200 lines of code (including comments).

### README.md

This file, formatted with Markdown, is displayed in Tapestry when the user views your plugin’s information. It is highly recommended since it provides valuable context for the end user.

Only inline styles are supported (e.g. no `#` header blocks or images). This is a limitation of displaying Markdown in user interface controls on Apple platforms. 

Here is an example:

```markdown
This connector displays a feed of earthquakes from around the world. The feed
is generated by the [USGS](https://earthquake.usgs.gov).

The feed can be configured to show significant quakes or ones above a certain
threshold on the Richter scale.

This is the first connector written for Tapestry and was written by Craig
Hockenberry ([@chockenberry](https://mastodon.social/@chockenberry)) while
creating the first prototype.

```

### suggestions.json

The contents of this file will help the user setup the connector. There are two types of suggestions: one for site URLs and another for settings.

For example, the RSS plug-in suggests a few sites to help someone set up a feed the first time:

```
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

```
{
	"variables": [
		{
			"name": "dessert_choice",
			"value": "Apple Pie",
			"title": "American as..."
		},
		{
			"name": "reticulate_splines",
			"value": "false",
			"title": "ECO Mode"
		},
		{
			"name": "title",
			"value": "Now is the time for all good men to come to the aid of their party",
			"title": "Long Title"
		},
		{
			"name": "title",
			"value": "Hello",
			"title": "Short"
		}
	]
}
```

## HTML Content

### How Tapestry uses HTML

Tapestry's `Post` object uses HTML as its native content type. The `content` property will be used in two ways:

  1. To preview the post in the main timeline. A limited number of words (100-200) in the content will be displayed as formatted text. HTML tags can be used to influence this formatting (e.g. `<strong>` making bold text). Any content that won’t fit in the available space will end with "More…".
  2. The post’s detail view will display the full HTML content with styling provided by Tapestry’s current theme (e.g. dark vs. light). This content will be displayed as a web view.

Some HTML tags won’t appear in the preview. Things like `<table>`, `<ul>`, or `<hr/>` will only appear in the detail view. Our hope is that for most use cases, this will be fine. It’s rare to begin HTML with these kinds of tags, so previewing them is unnecessary. Additionally, the detail view will use a full WebKit rendering engine, so it can display any content not in the preview.

### HTML Preview Tags

In the first case, speed is of the essence. Timeline scrolling peformance can only be achieved with a subset of HTML that is converted to formatted text. In this context, think of your content text more like Markdown formatting than full HTML formatting.

The following tags are supported:

  * `<p>` to start a paragraph.
  * `<strong>, <b>` for **strongly emphasized** text.
  * `<em>, <i>` for _emphasized_ text.
  * `<a>` for [linked](https://example.com) text.
  * `<img>` for inline attachments (see below).
  * `<blockquote>` for quoted text.
  * `<br>` for a newline in the context of a paragraph. Ignored outside a paragraph.

For example, if your plugin provides the following `content`:

```
<p><b>Bold</b>, <i>italic</i>, <b><i>both</i></b>,<br/> and <a href="#">link</a>.</p>
```

Tapestry will render a preview and detail view like this:


> **Bold**, _italic_, **_both_**,<br/>
> and [link](#).

As with all HTML, unclosed tags will provide unpredictable results. Close your tags.

### HTML Inline Attachments

Some attachments are easier to deal with as inline content. For example, a blog feed may contain several `<img>` tags that you want to see as images in the timeline.

As a part of the step to create the timeline preview, images can automatically be extracted from the HTML content and assigned as `Attachment` objects.

For example, if your plugin provides this content:
```
<p>In this blog post, I will explain our watermark.</p>
<p><img src="https://iconfactory.com/images-v8/if_watermark.png"/></p>
```

Tapestry will create an attachment for this image:

<img width="46" height="46" src="https://iconfactory.com/images-v8/if_watermark.png"/>

If the `<img>` tag includes an `alt` attribute, that text will be included in the attachment and used to improve accessibility in the timeline.

This behavior can be disabled with `"providesAttachments": true` in `plugin-config.json`. The Mastodon plug-in is an example of where this is used because the API provides media attachments directly.

