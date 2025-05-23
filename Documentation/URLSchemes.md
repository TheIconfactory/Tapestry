# URL Schemes

The following URL schemes are supported by Tapestry:

#### tapestry://oauth

Used internally for OAuth token exchange.

#### feed://

Uses the path of the URL to find an RSS feed.

#### tapestry://feedfinder

Opens the Feed Finder.

The URL can contain a query string with a `url` parameter. If a URL encoded value is provided, it will be used to pre-fill the input field.

#### tapestry://buy

Shows a view to purchase Tapestry.

#### tapestry://media

The URL must contain a query string with a `src` parameter. The URL encoded value specifies the media to view (can be an image or video).
A URL encoded `alt` parameter can also be provided to supply ALT text for the viewer.
