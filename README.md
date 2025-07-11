# Lazer
![promo-image](https://github.com/user-attachments/assets/a6dbfc1b-7ba2-4026-af77-5fdc02c4987f)


Lazer is a plugin for Figma that provides quick commands to adjust the layout and appearance properties of selected elements.

The idea is to leave the keyboard less by creating pseudo shortcuts. By bringing up the Actions input with `command + K` or `command + /` and then typing a short code (eg. `w.h`), the fuzzy search will bring your focus to an action you can execute by pressing enter.

Disclaimer: I used Gemini 2.5 Pro to build this. Please excuse jank and AI-ness.

<img width="480" alt="image" src="https://github.com/user-attachments/assets/eaa1e929-53f7-40d9-b63b-87db789d7de0" />

## Features

See the full list of current commands [here](./COMMANDS.md).

## Usage

1.  Select one or more layers in your Figma file.
2.  Open the Actions input with `command + K` or `command + /`
3.  Type the short code for the command (eg. `w.h`)
4.  Press enter (assuming you have your desired command in focus)
    *   Many commands apply adjustments directly (e.g., `w.h - Set Width to Hug`).
    *   The `aa - Set Auto Layout Alignment` command will open a dialog for visual alignment selection.
    *   Commands ending with `..` (e.g., `p.. - Set Padding`) will prompt you to enter a custom value.

## Development

To build the plugin locally:

1.  Clone this repository.
2.  Install dependencies: `npm install`
3.  Build the plugin: `npm run build`
4.  In Figma, go to **Plugins** > **Development** > **Import plugin from manifest...** and select the `manifest.json` file from this project.
