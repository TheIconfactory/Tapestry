# Tapestry

## Introduction

This public repository contains information about the Project Tapestry prototype. It does not contain the source code for the app.

## Documentation

A JavaScript-based API is used by Tapestry to gather information from the public Internet.

[This document](Documentation/API.md) explains the variables, objects, actions, and functions that are available for JavaScript development. A section at the end explains how plug-ins are configured.

## Plugins

The [Plugins folder](Plugins) shows examples of plugins that were created for the prototype. Each plugin is listed using a reverse domain name identifier.

Each plug-in has a [configuration file](Plugins/org.joinmastodon/plugin-config.json) that provides metadata to the prototype. For example, if OAuth is needed to make requests.

There is also a [user interface configuration](Plugins/org.joinmastodon/ui-config.json) that specifies inputs for settings and variables for JavaScript code.

Finally, there is the JavaScript that implements the plug-in. The most complex example is the one used for [Mastodon](Plugins/org.joinmastodon/plugin.js) (138 lines). A simpler example checks the [USGS Earthquake Summary](Plugins/gov.usgs.earthquake/plugin.js) (41 lines).

We feel confident that this simple API can be used to handle any information on the public Internet. ([Even XML!](Plugins/xml.feed/plugin.js))

Ideally, these plug-ins should be user installable. For example, if you have custom built Raspberry Pi monitoring your garden's water tank, it could be added to Tapestry to give periodic updates in a timeline. The challenge to accomplish that goal is building a secure distribution system for plug-ins.

## Kickstarter

We are running a Kickstarter to fund a native iOS app based on this prototype. If the idea of a configurable and customizable Internet excites you, please check it out!
