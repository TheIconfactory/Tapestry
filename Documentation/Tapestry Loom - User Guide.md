
# Tapestry Loom - User Guide

## Introduction

The Tapestry Loom is a tool that allows you to build and test plugins using the [Tapestry API](API.md)

This is a work-in-progress and details are certain to change.


## Main Buttons

#### Open Plugins…

Opens the folder where the plugins are being edited. By default, this is the `plugins` folder in the app’s sandbox container.

The folder can be changed using the _File_ menu. See `Menu Bar` below.

#### API Keys…

This button opens a view where public and private keys for OAuth can be set.

#### Source

This popup menu lets you select the plugin to work with. It will show all the items in the `plugins` folder.

#### Set Variables…

This button opens a view where the variables for the plugin (as specified in `ui-config.json`) are displayed.

#### Reload Plugins…

A new JavaScript context for the plugin is created when you press this button.

If you change the variables (using _Set Variables…_), the `plugin.js` file, or any of the configuration parameters, you need to reload the plugin.

#### Authorize

Pressing this button initates the OAuth authentication for the plugin.

#### Refresh

Pressing this button refreshes the OAuth authentication if it has a refresh token.

#### Identify

This button calls the `identify()` action in the plugin.

#### Load

This button calls the `load()` action in the plugin.


## Results List

This list shows the results returned after calling the `load()` action in the plugin.

* Date: the `date` property of the `Post`
* URI: the `uri` property of the `Post`
* Content: a preview of `content` property
* Attachments: a count of the number of attachments in the `Post`


## Post Details

The details of the currently selected `Post` in the results is displayed below the list. The post’s `Creator` and `Attachment`’s are also displayed.

When appropriate, a button is displayed to open links in your browser. A thumbnail preview of any image is also provided when possible.	

The `content` of the post can be displayed as formatted (rich) text or as Raw HTML, using the popup menu.


## Menu Bar

#### File > Open Plugins Folder

Opens the current plugins folder

#### File > Select Plugins Folder

Sets the path for the plugins that appear in the _Source_ menu.

This can be handy if you are working on plugins in a GitHub repository.

#### File > Reload Plugins Folder

Reloads all the plugins in the current folder.

Use this menu item after you have pulled in changes from a GitHub repository.

#### File > Save Plugin…

Creates a plugin file that can be loaded into the iOS app. When there is an app, of course. :-)

#### Help

Links to Tapestry Kickstarter, GitHub repository, and (non-existent) Support page.
