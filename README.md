# Lazer

Lazer is a plugin for Figma that provides quick commands to adjust the layout and appearance properties of selected elements.

## Features

This plugin allows you to quickly adjust:

*   **Layout Sizing:**
    *   Set width to Hug Contents, Fill Container, or a custom value.
    *   Set height to Hug Contents, Fill Container, or a custom value.
*   **Padding:**
    *   Set all padding to 0, 16, or a custom value.
*   **Auto Layout:**
    *   Set Auto Layout alignment using a visual control.
    *   Adjust Gap to 0, 8, 16, or a custom value.
*   **Appearance:**
    *   Set Border Radius to 0px, 8px, or a custom value.
    *   Set Stroke weight to 0, 1, or a custom value.
    *   Set Stroke color to a custom value.
    *   Add a default Fill or remove all fills.
    *   Set Fill color to a custom value.

## Commands

The following commands are available from the Figma plugin menu:

### Width & Height
*   `w.h - Set Width to Hug`
*   `h.h - Set Height to Hug`
*   `w.f - Set Width to Fill`
*   `h.f - Set Height to Fill`
*   `w.. - Set Width` (prompts for custom value)
*   `h.. - Set Height` (prompts for custom value)

### Padding
*   `p.0 - Set All Padding to 0`
*   `p.16 - Set All Padding to 16`
*   `p.. - Set Padding` (prompts for custom value)

### Auto Layout
*   `aa - Set Auto Layout Alignment` (opens alignment UI)
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
*   `f.1 - Add Default Fill`
*   `f.0 - Remove All Fills`
*   `f.. - Set Fill Colour` (prompts for custom value)

## Installation

Currently unavailable in Figma Community, so in the meantime:
In Figma, go to **Plugins** > **Development** > **Import plugin from manifest...** and select the `manifest.json` file from this project.

## Usage

1.  Select one or more layers in your Figma file.
2.  Open the Lazer plugin from the plugin menu (e.g., Right-click > Plugins > Lazer, or find it in the Figma main menu under Plugins).
3.  Click on the desired command to apply the layout or appearance adjustment.
    *   Many commands apply adjustments directly (e.g., `w.h - Set Width to Hug`).
    *   The `aa - Set Auto Layout Alignment` command will open a dialog for visual alignment selection.
    *   Commands ending with `..` (e.g., `p.. - Set Padding`) will prompt you to enter a custom value.

## Development

To build the plugin locally:

1.  Clone this repository.
2.  Install dependencies: `npm install`
3.  Build the plugin: `npm run build`
4.  In Figma, go to **Plugins** > **Development** > **Import plugin from manifest...** and select the `manifest.json` file from this project.
