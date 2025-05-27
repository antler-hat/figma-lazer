# Figma Lazer

Figma Lazer is a plugin for Figma that provides quick commands to adjust the layout properties of selected elements.

## Features

This plugin allows you to quickly:

*   Set width to Hug Contents
*   Set height to Hug Contents
*   Set width to Fill Container
*   Set height to Fill Container
*   Set all padding to 0
*   Set all padding to 16

## Commands

The following commands are available from the Figma plugin menu:

*   `wh: Set Width to Hug`
*   `hh: Set Height to Hug`
*   `wf: Set Width to Fill`
*   `hf: Set Height to Fill`
*   `p0: Set All Padding to 0`
*   `p16: Set All Padding to 16`

## Installation

1.  In Figma, go to **Plugins** > **Browse plugins in Community**.
2.  Search for "Lazer" (or "figma-lazer-plugin").
3.  Click **Install**.

## Usage

1.  Select one or more layers in your Figma file.
2.  Open the Figma Lazer plugin from the plugin menu.
3.  Click on the desired command to apply the layout adjustment.

## Development

To build the plugin locally:

1.  Clone this repository.
2.  Install dependencies: `npm install`
3.  Build the plugin: `npm run build`
4.  In Figma, go to **Plugins** > **Development** > **Import plugin from manifest...** and select the `manifest.json` file from this project.
