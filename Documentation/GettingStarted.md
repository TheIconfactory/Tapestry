
# Getting Started With the Tapestry API

## Introduction

Tapestry ...

### Connectors

Tapestry is built around the concept of connectors. A connector is a collection of configuration files and code that allow a feed to gather data. Connectors are created by developers; feeds are created by users.

A familiar example is an RSS connector: it processes XML text with JavaScript to generate item objects for a blog feed. Tapestry then takes these objects and displays them chronologically in the user’s timeline.

Connectors are simple by design: everything is just a text files that you can edit with your favorite editor. As you’re developing these connectors, a tool called [Tapestry Loom](https://testflight.apple.com/join/SMcNQbCs) will help you build and test your project.

Think of this setup like creating a web page: you edit HTML and refresh your browser to see the changes. In this scenario, Tapestry Loom is the browser.

### The Mystic 9-Ball

Think how much easier life would be if we could predict the future. Thanks to the [Mystic 9-Ball website](https://usetapestry.com/samples/mystic9ball), now we can!

These predictions help us plan our future, so wouldn’t it be great if we could put them in our Tapestry timeline?

Probably not, but it _would_ be a helpful to show you how to build your first connector for Tapestry. At the end of this tutorial, you'll be able to see the Mystic 9-Ball’s prognostications  in your universal timeline.

Let's get started!

## Your First Connector

Start by creating a folder on your Mac named "Connectors". It doesn't matter where that folder is, but you may want to make it a part of a version control repository so it's easy to track changes.

In that folder, create another folder called "com.usetapestry.mystic9ball". This is the folder where we will be collecting the text files that Tapestry uses.

Tapestry uses [reverse domain names](https://en.wikipedia.org/wiki/Reverse_domain_name_notation) to identify connectors. Every connector needs a unique identifier, and this is the simplest way to accomplish that.

In the "com.usetapestry.mystic9ball" folder, create the two files that are required for a connector:

  * `plugin-config.json`: contains information about the connector, for example the name that appears in Tapestry.
  * `plugin.js`: contains JavaScript that lets the connector do its work
  
The `plugin.js` file can be empty for now, but the `plugin-config.json` file requires some basic information: an `id` and `display_name` is [required](https://github.com/TheIconfactory/Tapestry/blob/main/Documentation/API.md#plugin-configjson).

```json
{
	"id": "com.usetapestry.mystic9ball",
	"display_name": "Mystic 9-Ball",
}

```

With that, your connector [appears](images/GettingStarted_1.png) in Tapestry Loom:

![Tapestry Loom with com.usetapestry.mystic9ball connector being displayed](images/1-UpAndRunning.png)

An important first step - your work is now showing up in the _Connector_ (left-most) panel of the app!

## What Are You Connecting To?

A connector that doesn't connect to anything isn’t very useful. Let’s fix that!

In Tapestry, the `site` specifies a location on the Internet where data can be collected. In this case, we're connecting to the Magic 9-Ball, so we’ll set it to `https://usetapestry.com/samples/mystic9ball` and have this in our `plugin-config.json`:

```json
{
	"id": "com.usetapestry.mystic9ball",
	"display_name": "Mystic 9-Ball",
	"site": "https://usetapestry.com/samples/mystic9ball",
}
```

We now need to let Loom know about the changes we've made. Click on the **↻** button in the lower-left corner of the window and you'll see `site` show up in the _Connector_ panel. The next panel to the right, called the _Feed_ panel, also has some information.

Let’s fill in some of the other configuration values to get a better icon:

```json
{
	"id": "com.usetapestry.mystic9ball",
	"display_name": "Mystic 9-Ball",
	"site": "https://usetapestry.com/samples/mystic9ball",
	"icon": "https://usetapestry.com/samples/mystic9ball/images/icon.png",
}
```

We’ll need to refresh again because of these changes, but try using the **Cmd-R** keyboard shortcut this time.

Our connector is now ready for the next step — collecting information to the Tapestry app.

## Feed Me!

There isn’t anything else needed to make a feed with the Mystic 9-Ball connector, so just press **Save Feed** to create a test feed.

Our focus now shifts to the third panel where _Results_ are show. The table is currently empty, but will fill up with items loaded by your connector.

Press the **Load** button and Tapestry will try to load items using your connector. You'll notice that a red dot appears next to the document icon at the bottom of the _Results_ panel. When you click on this button, you'll see all the messages logged while running `plugin.js`.

But what does `EXCEPTION: ReferenceError: Can't find variable: load` mean?

This is caused by Tapestry trying to call a [load](https://github.com/TheIconfactory/Tapestry/blob/main/Documentation/API.md#load) function in your JavaScript code and failing. So let's update or `plugin.js` code to load some data!

Add this to your `plugin.js`:

```javascript
function load() {
	let uri = site;
	let date = new Date();
	
	let item = Item.createWithUriDate(uri, date);
	item.body = "Hello world!";

	let items = [item];
		
	processResults(items);
}
```

You just changed the JavaScript code, so you need to refresh the connector and load the changes (use the **↻** button or **Cmd-R**). When you press the **Load** button, the JavaScript `load()` function is called and you'll see your first item in the _Results_ panel. And when you click on that result, you'll see it in the right-most _Preview_ panel. Woo-hoo! 
 
![The com.usetapestry.mystic9ball connector displaying result and a preview](images/2-HelloWorld.png)

So what just happened here? Let's go through it line-by-line.

An item in the timeline _must_ have two things: a URI and a date.

The URI is a [unique identifier](https://en.wikipedia.org/wiki/Uniform_Resource_Identifier) that lets Tapestry manage all the items in your timeline. The URI will usually be a URL, which is a unique place on the Internet. The date is required so that Tapestry can present the items chronologically.

To start, we'll use the unique address of the website that was defined in `plugin-config.json`. We get that information using a `site` variable that Tapestry provides to every script. Note that in some cases, such as with an RSS feed or Mastodon account, the `site` variable is specified by the end user. But no matter where it comes from, your code is guaranteed to get a string that contains a valid URL.

The `new Date()` provides the current date and time.

Together, a JavaScript `Item` object is created using `Item.createWithUriDate(uri, date)`. Once we have that object we can add content by setting its `body` property. In this example, the content is plain text, but it can also be HTML (more about that in the next section).

The `Item` has [other properties](https://github.com/TheIconfactory/Tapestry/blob/main/Documentation/API.md#item), such as a `title`, `contentWarning`, and `attachments` which we'll cover later.

Once the item has been created and all its properties set, it is returned as an array via `processResults`. This is the point where all the information that your connector has collected gets processed and stored by Tapestry.

Tapestry Loom uses the same processing pipeline that is used in the app, so that makes it easy for you to test and preview any changes that you make to your connector. Saving in your text editor, followed by a **Cmd-R** reload and **Load** button press is a sequence you'll repeat frequently.

## But Is It Useful?

But let's be honest: seeing "Hello World!" in your timeline every time you refresh wouldn't be very useful. Let's change that!

We know that this site has an API, but we're not exactly sure what kind of data we get from that app. But it's easy to send a request and see what we get back:

```javascript
function load() {
	let uri = site;
	let date = new Date();
	
	let item = Item.createWithUriDate(uri, date);
	item.body = "Hello world!";

	let items = [item];
	
	const endpoint = `${site}/api`;
	sendRequest(endpoint)
	.then((text) => {
		console.log(`text = ${text}`);
		processResults(items);
	})
	.catch((requestError) => {
		processError(requestError);
	});
}
```

The first thing we do is create an `endpoint` that points to the site's API. That endpoint is used with the [sendRequest](https://github.com/TheIconfactory/Tapestry/blob/main/Documentation/API.md#sendrequesturl-method-parameters-extraheaders--promise) function provided by Tapestry.

(Note: If you've used the fetch API in a browser, you’re power user that already has a good idea on how this works. The main difference with Tapestry is that it securely adds Authorization headers on the request if the connector uses OAuth or JWT. If none of this makes sense to you, don't worry - it's not required to write a basic connector!)

After the request completes, you'll have some `text` to process. At this point we can just output it with `console.log` and return the results like before.

If the request can't complete, you should catch that `requestError` and send it back to Tapestry so it can be displayed in the user interface.

After doing **Cmd-R** and **Load**, you'll see the document icon update because of the log message you just added. When you press that button, you'll see something like this:

```
text = {
    "timestamp": 1722038267,
    "value": 9,
    "description": "No You Didn\u2019t",
    "image": "/samples/mystic9ball/images/ball/9ball_9.png"
}

```

Those are the results from the API and we can easily put these JSON results to use:

```javascript
function load() {
	const endpoint = `${site}/api`;
	sendRequest(endpoint)
	.then((text) => {
		const json = JSON.parse(text);

		let uri = site;
		let date = new Date(json.timestamp * 1000); // seconds → milliseconds
	
		let src = "https://usetapestry.com" + json.image; // relative → absolute url
		
		let item = Item.createWithUriDate(uri, date);
		item.body = `<p>The Mystic 9-Ball says: <b>${json.description}</b><img src="${src}" /></p>`;

		let items = [item];

		processResults(items);
	})
	.catch((requestError) => {
		processError(requestError);
	});
}
```

The first thing you'll do with the text is convert it to a JSON object with `json = JSON.parse(text)`. Then `json.timestamp`, `json.description`, and `json.image` can be used to improve the item for our connector.

Also note that the item’s body is now specified using HTML. Even if you’re familiar with the markup, you should check out [how Tapestry uses  HTML](https://github.com/TheIconfactory/Tapestry/blob/main/Documentation/API.md#html-content). 

One issue with the script above is that the URI never changes; only the date gets updated. Tapestry will detect this and constantly put the item at the top of the timeline. From a user’s point-of-view, it’s better to make sure that each URI produced is unique and keeps it’s place in the universal timeline.

Luckily, we can easily do this using information in the JSON data:

```javascript
		let uri = site + `?value=${json.value}&timestamp=${json.timestamp}`;
```

By adding both the `json.value` and `json.timestamp` as query parameters, a unique URL is formed. An added benefit is that this URL can now be shared by folks that are using your connector. If they get a [“Nailed It”](https://usetapestry.com/samples/mystic9ball/?value=3&timestamp=1722038267), all their friends can see it!


## Just How You Like it

There's another problem with our connector: it loads every time you refresh the feeds in Tapestry. We don’t need that many prognostications!

To tackle this, we'll create a variable for our JavaScript to use. This variable can be set by whoever uses the connector to get the behavior that best fits their needs.

Let's start by creating a `ui-config.json` file in our `com.usetapestry.mystic9ball` folder:

```json
{
	"inputs": [
		{
			"name": "interval",
			"type": "choices",
			"prompt": "Minutes Between Shakes",
			"value": "30",
			"choices": "1, 5, 15, 30, 60, 90"
		}
	]
}
```

This creates a JavaScript String variable named `interval` that contains one of the values in `choices`. The default value is “30”.

This new variable is added to our script:

```javascript
var lastUpdate = null;

function load() {
	if (lastUpdate != null) {
		// check the interval provided by the user
		console.log(`interval = ${interval}`);
		let delta = parseInt(interval) * 60000; // minutes → milliseconds
		let future = (lastUpdate.getTime() + delta);
		let now = (new Date()).getTime();
		if (now < future) {
			// time has not elapsed, return no results
			console.log(`time until next update = ${(future - now) / 1000} sec.`);
			processResults(null);
			return;
		}
	}
	
	const endpoint = `${site}/api`;
	sendRequest(endpoint)
	.then((text) => {
		const json = JSON.parse(text);

		let uri = site + `?value=${json.value}&timestamp=${json.timestamp}`;
		let date = new Date(json.timestamp * 1000); // seconds → milliseconds
	
		let src = "https://usetapestry.com" + json.image; // relative → absolute url
		
		let item = Item.createWithUriDate(uri, date);
		item.body = `<p>The Mystic 9-Ball says: ${json.description}<img src="${src}" /></p>`;

		let items = [item];

		processResults(items);
		
		lastUpdate = new Date();
	})
	.catch((requestError) => {
		processError(requestError);
	});
}
```

Reload the connector and the _Feed_ panel will show the new _Minutes Between Shakes_ setting with your list of choices. Try setting it to “1” and then **Save Feed**.

Now, the **Load** button will only update the Results list if a minute has passed. The log button shows information that lets you verify that everything is working correctly.


## The Fine Manual

By now, you know what this connector does. But others do not, and a little bit of README goes a long way.

Thankfully, it's an easy thing to do with your Tapestry connector. Just add a `README.md` file with Markdown syntax in your folder and you're done!

```markdown
This is a sample that shows developers how to create connectors for Tapestry.

You can find the [full tutorial on GitHub](https://github.com/TheIconfactory/Tapestry/Documentation/GettingStarted.md)

The [source code](https://github.com/TheIconfactory/Tapestry/Plugins/com.usetapestry.mystic9ball) for the connector is also available.

```

You can preview the content using the **Read Me** button in the _Connector_ panel.

![Tapestry Loom displaying a preview of the README](images/3-README.png)


## Finding Yourself

Tapestry’s _Feed Finder_ is a powerful way for people to find your connector: all they need to know is a URL. With that information, the app can check for connectors that can be used on the site.

(Note: Eventually, this functionality will be available as an extension, so folks can find feeds directly from the web browser.)

This feature works by using a `discovery.json` file in your connector folder. Create one with this information:

```json
{
	"sites": [
		"usetapestry.com"
	]
}
```

After reloading the connector, the magnifying glass icon in the lower-left of the _Connector_ panel opens a sheet where you can test the Feed Finder. Any URL on `usetapestry.com` will now suggest our connector. Cool!

![Tapestry Loom displaying the Feed Finder tester](images/4-Discovery.png)

This is a simple example: there are cases where the contents of the page need to be examined and extracted. These are covered in the [file’s documentation](https://github.com/TheIconfactory/Tapestry/blob/main/Documentation/API.md#discoveryjson)

LAST EDIT

## The Power of Items

We’ve design the `Item` to be flexible and usable for many different needs. As a result, there are many things your connector can tune to get the best looking content in Tapestry.

TODO: Explain difference between post and article

![A comparison of post and article styles with callouts for properties](images/X-TimelineItems.jpg)

