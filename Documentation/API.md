
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

### Item

`Item` objects are used to populate a timeline in the app. Items can be either posts or articles. You create one with:

```javascript
const uri = "https://example.com/unique/path/to/content";
const date = Date();
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

#### attachments: Array of Attachment

Up to four media attachments for the content. See below.

_NOTE:_ Media attachments will be automatically created when inline images are used in the HTML of the `content` property unless the `providesAttachments` configuration parameter is set to true.

### Identity

An `Item` can have a author that indicates how the content was created. It can be a person, a woman, a man, a camera, or a TV. The information is used to present an avatar and header in the timeline.

```javascript
const name = "CHOCK OF THE LOCK";
const identity = Identity.createWithName(name);
identity.uri = "https://chocklock.com";
identity.avatar = "https://chocklock.com/favicon.ico";

item.author = identity;
```

#### name: String (required)

The name of the creator. Can be an account’s full name, a bot name, or anything to identify the data and source.

#### username: String

The name of the creator. Can be an account’s full name, a bot name, or anything to identify the data and source.

#### uri: String

A unique URI for the creator on the Internet. Can be an individual’s account page, bot, or other type of creator. Will be used to show details for the creator if the URI can be converted to a browsable URL.

#### avatar: String

A string containing the URL for the creator’s avatar on the Internet. If no avatar is specified a generic image will be displayed in the timeline.

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


### MediaAttachment

`Post`s can also have media attachments. Photos, videos, and audio are commonly available from APIs and other data sources, and this is how you get them into the timeline. They will be displayed under the HTML content.

```javascript
const attachment = MediaAttachment.createWithUrl(url)
attachment.text = "Yet another cat on the Internet."
attachment.aspectSize = {width: 300, height: 400};
attachment.focalPoint = {x: 0, y: 0};

item.attachments = [attachment];
```

#### url: String (required)

A string containing the URL for the media on the Internet

#### thumbnail: String

A string containing the URL for a lower resolution copy of the media

#### mimeType: String

A string that lets Tapestry know what kind of media is being attached. If this value isn't present, the file name
extension for `media` will be used.

#### blurhash: String

A string that provides a placeholder image.

#### text: String

A string that describes the media (for accessibility)

#### aspectSize: Object

An object with `width` and `height` properties. The values are used to optimize the media placement in the timeline.

#### focalPoint: Object

An object with `x` and `x` properties. The values are used to center media in the timeline. If no values are specified, the center at (0, 0) is assumed.


## Actions

The Tapestry app will call the following functions in `plugin.js` when it needs the script to read or write data. If no implementation is provided, no action will be performed. For example, some sources will not need to `verify()` themselves.

All actions are performed asynchronously (using one or more JavaScript Promise objects). An action indicates that it has completed using the `processResults`, `processError`, and `processVerification` functions specified below.

### verify()

Determines if a site is reachable and gathers properties for the feed. After `processVerification` is called a feed can be saved by a user.

The properties returned can be user visible or used internally. An example of the former case is a display name will be used identify the feed. The latter case is a base URL that will be used to handle relative paths in the feed.

This function will only be called if `needsVerification` is set to true in the plug-in’s configuration.

### load()

Loads any new data and return it to the app with `processResults` or `processError`. Variables can be used to determine what to load. For example, whether to include mentions on Mastodon or not.

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

_NOTE:_ The JavaScript code doesn’t have access to the OAuth access token (for security, no authentication information is exposed to the plug-in). If an access token is needed in a list of `parameters`, use `__ACCESS_TOKEN__` — it will be substituted before the request is sent to the endpoint.


### processResults(results, complete)

Sends any data that’s retrieved to the Tapestry app for display.

  * results: `Array` with `Post` or `Creator` objects.
  * complete: `Boolean` with a flag that indicates that result collection is complete and can be displayed in the app timeline (default is true).


### processError(error)

Sends any error to the Tapestry app for display

  * error: `Error` which indicates what went wrong. Will be displayed in the user interface.

### processVerification(verification)

Sets the parameters for the site and service.

  * verification: dictionary `Object` or `String`.

The dictionary can contain the following:

  * displayName: `String` that will be used to name the feed. For example, a RSS feed name or a Mastodon account.
  * icon: `String` for an image URL that will be presented alongside the display name.
  * baseUrl: `String` that will be used to resolve relative URLs. Anything other than the protocol and hostname will be discarded.
  
When a string is returned, it will be used as a `displayName` with an empty `baseUrl` and default `icon`.

_NOTE:_ A `baseUrl` is typically used for feeds where the site is "feed.example.com" but images and other resources are loaded from "example.com".
  
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

### extractProperties(text) → Object

  * text: `String` is HTML content with `<meta>` properties (such as OpenGraph).
  
Returns an `Object` representation containing the HTML’s properties. These values can be used to generate link previews or enhance the content without scraping the markup.

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
 
   * icon: `String` with a URL to an image that will be used as a default for this connector.
   * item\_style: `String` with either "post" or "article" to define the content layout.
 	
Optional properties:

  * needs\_verification: `Boolean` with true if verification is needed (by calling `verify()`)
  * verify\_variables: 'Boolean' with true if variable changes cause verification. Use this option if changing a variable will affect  loading content (because its a part of a URL, for example).
  * provides\_attachments: `Boolean` with true if connector generates attachments directly, otherwise post-processing of HTML content will be used to capture images & video.
  * authorization\_header: `String` with a template for the authorization header. If no value is specified, "Bearer \_\_ACCESS\_TOKEN\_\_" will be used. See below for options.
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

The user interface in the Tapestry app is configured with this file. A connector plug-in can have any number of inputs, specified as an `Array`. Each input has this required property:

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

### discovery.json

This file helps the user find your plugin when they have a URL to a page of HTML. The rules in this file will be checked and if all constraints match, the plugin will be suggested to the user in an interface that simplifies set up.

The file consists of three categories: one specifies a list of sites where the plugin can be used, the other two specify a list of rules for the URL and HTML.

```json
{
	"sites": [],
	"url": [],
	"html": []
}
```

All three categories must match in order to be displayed. If one of these category is not supplied, it has no constraints, so it is considered a match.

The following sections describe each category.

#### sites

The sites category is a list of strings where the plugin can be used. These checks are performed on the URL that is supplied by the user.

For example. the `com.gocomics` plugin only works on one site so it uses:

```json
	"site": [
		"gocomics.com"
	],
```

The YouTube plugin will work on many different domains. Note that "youtube." will match "youtube.de", "youtube.fr", as well as the more familiar "youtube.com". The match does not use regular expressions.

```json
 	"site": [
 		"youtube.",
 		"youtu.be",
 		"youtubekids.com"
 	],
```

If the sites rules do not match, no further checks are performed and the plugin is not suggested to the user.

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

The `extract` regex pattern begins and ends with a single slash ("/") character. The first capture group in the pattern is used to set the variable’s value. If no match is found, the rule fails and the plugin is not offered as a suggestion.

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

#### html

The content at the URL provided by the user can also be checked. The strategy is to collect all elements of a specific type, check an attribute of those elements, see if it matches, and then optionally save all or part of a match in a variable.

This approach allows your plugin to check things like `<link>` or `<meta>` tags for things that it needs. For example, a page that has the following HTML markup can be used with a plugin that handles RSS feeds:

```html
<link rel="alternate" type="application/atom+xml" href="/feeds/main" />
```

The `html` rules use the following properties:

  * element (required): the elements in the HTML to check: "link", "meta", or any other tag.
  * check (required): the attribute in the element to check
  * match (required): a string _or_ regex pattern that will be used to find matching attribute values
  * use (optional): the attribute in the element that contains a value to use with the plugin
  * extract (optional): a string _or_ regex pattern that will be used on the value specified by `use` and passed to the `variable`.
  * variable (optional): `site` or any variable defined in `ui-config.json` that will be set using `extract`.

Both `match` and `extract` can be:

  * a string to match (e.g. "Mastodon" or "application/rss+xml")
  * a regex pattern that begins and ends with a single slash ("/") (e.g. "/example.com/([^/]+)/"

The HTML rule will fail if any of the following are true:

  * The HTML contains no `element` tags.
  * If no `check` attribute exists, or if the `match` is not satisfied.
  * If `use` is specified and no `extract` match is found.

Finally, the "href" attribute value in a `use` property will always return an absolute URL, even if there is a relative URL in the document. Variables, specifically `site`, will need a fully qualified domain name to access data since the plugin has no notion of a base URL.

A picture is worth a thousand words, so the remainder of this section are examples.

The first example shows how to get the URL for an RSS feed. Note the use of a `match` pattern with a non-capturing group that allows both the RSS and Atom formats:

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

Also note that the example above shows that backslashes need to be escaped because they are passed as strings to Swift's Regex framework. Forward slashes do not need to be escaped.

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

If there are multiple rules, they must all pass. For example, the first rule below checks if there is an OpenGraph `og:site_name` meta property that contains the word "Mastodon". If it does, there is another check for the `og:url` property where the `site` variable can be extracted:

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

Any HTML element can be used. For example the plugin for podcasts uses these two rules:

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

```html
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

