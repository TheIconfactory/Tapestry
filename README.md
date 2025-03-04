# Tapestry

## Introduction

This public repository contains information about the Project Tapestry prototype. It does not contain the source code for the app.

Note also that this is a **work-in-progress** and details are certain to change.


## Documentation

A JavaScript-based API is used by Tapestry to gather information from the public Internet.

[This document](Documentation/API.md) explains the variables, objects, actions, and functions that are available for JavaScript development. A section at the end explains how plug-ins are configured.

We also have a [tutorial that guides you through the development](Documentation/GettingStarted.md) of a connector using the API. This includes how to setup and use our free developer tool: [Tapestry Loom](https://apps.apple.com/app/tapestry-loom/id6578414736?mt=12&pt=8934&at=10l4G7&ct=TAPESTRY_REPO).


## Examples

The [Plugins folder](Plugins) shows the connectors that are currently being used in the Tapestry app. Each connector is listed using a reverse domain name identifier.

Look at the [tutorial](Documentation/GettingStarted.md) to understand how the files in each connector are used. The [API documentation](Documentation/API.md#configuration) also covers the content and options for these files.

Connectors are user installable. For example, if you have custom built Raspberry Pi monitoring your garden's water tank, it can be added to Tapestry to give periodic updates in a timeline.


## Supporting Tools

If you use VS Code or BBEdit to develop JavaScript, you'll want to check out these [TypeScript Definitions](https://github.com/Davvie/tapestry-api-definitions). They will give you code completion and inline help as you work on your connectors!

## Screencast

For an in-depth look at what you can do with connectors, take a moment to watch [Project Tapestry - Weaving An API](https://www.youtube.com/watch?v=H5C2_zwy8cQ) on YouTube. This 30 minute video will help you get set up, show some tip and tricks, and give you a demo of how they're used in an iOS app.

> **Note:** This video was recorded with a prototype of Tapestry, so details may be out of date. Conceptually, nothing has changed.


## Project

This project is being developed by the [Iconfactory](https://iconfactory.com) and is supported by backers on [Kickstarter](https://iconfactory.com/kickstarter).
