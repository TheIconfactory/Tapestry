# Tapestry Data Tool

The Tapestry app on iOS allows you to backup your feeds, connectors, and other configuration in Advanced settings. The backup file that’s created is plain text with JSON content.
 
This tool allows you open the JSON file and create an OPML file. This is not a complete conversion because some feeds rely on connectors that don’t have RSS or JSON feed endpoints. For example, accounts on Mastodon, Bluesky, and Tumblr can’t be represented in OPML and are not converted.

For your convenience, the latest version of this Mac app can be [downloaded from our website](https://files.iconfactory.net/software/TapestryDataTool.zip).

This tool can be used as an example of how to extract other information from the file. The app has no dependencies and should be easy to adapt and build for your own needs. To build the app, you will need to set your own Team in Signing & Capabilities.

