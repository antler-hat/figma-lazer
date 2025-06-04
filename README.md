# Lazer
![promo-image](https://github.com/user-attachments/assets/a6dbfc1b-7ba2-4026-af77-5fdc02c4987f)


Lazer is a plugin for Figma that provides quick commands to adjust the layout and appearance properties of selected elements.

The idea is to leave the keyboard less by creating pseudo shortcuts. By bringing up the Actions input with `command + K` or `command + /` and then typing a short code (eg. `w.h`), the fuzzy search will bring your focus to an action you can execute by pressing enter.

Disclaimer: I used Gemini 2.5 Pro to build this. Please excuse jank and AI-ness.

<img width="480" alt="image" src="https://github.com/user-attachments/assets/eaa1e929-53f7-40d9-b63b-87db789d7de0" />

## Features

This plugin allows you to quickly adjust:

### Width & Height
*   `w.h - Set Width to Hug`
*   `h.h - Set Height to Hug`
*   `w.f - Set Width to Fill`
*   `h.f - Set Height to Fill`
*   `w.. - Set Width`  (prompts for custom value)
*   `h.. - Set Height` (prompts for custom value)

### Padding
*   `p.0 - Set All Padding to 0`
*   `p.16 - Set All Padding to 16`
*   `p.. - Set Padding` (prompts for custom value)

### Auto Layout
*   `al.. - Set Auto Layout Alignment` (opens alignment UI)
*   `al.v - Set Auto Layout to Vertical`
*   `al.h - Set Auto Layout to Horizontal`
*   `g.0 - Set Gap to 0`
*   `g.8 - Set Gap to 8`
*   `g.16 - Set Gap to 16`
*   `g.. - Set Gap` (prompts for custom value)

### Border Radius
*   `br.0 - Set Border Radius to 0px`
*   `br.8 - Set Border Radius to 8px`
*   `br.. - Set Border Radius` (prompts for custom value)

### Stroke
*   `s.0 - Set Stroke Width to 0`
*   `s.1 - Set Stroke Width to 1`
*   `sw.. - Set Stroke Width` (prompts for custom value)
*   `sc.. - Set Stroke Colour` (prompts for custom value)

### Fill
*   `f.w - Add White Fill`
*   `f.0 - Remove All Fills`
*   `f.. - Set Fill Colour` (prompts for custom value)

### Text
*   `ls.. - Set Text Letter Spacing` (prompts for custom value)
*   `t.s - Set Text Size` (prompts for custom value)

### General
*   `help! - Show Commands and Shortcuts` (displays this list in a popup)

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
