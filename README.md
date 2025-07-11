# Lazer
![promo-image](https://github.com/user-attachments/assets/a6dbfc1b-7ba2-4026-af77-5fdc02c4987f)


Lazer is a plugin for Figma that provides quick commands to adjust the layout and appearance properties of selected elements. [Find it in Figma Community here.](https://www.figma.com/community/plugin/1510266761765016786)

Keyboard shortcuts are crucial for speed and efficiency, but Figma offers a pretty limited set and you can't customize them.

Lazer proposes a decent workaround inspired by command line interfaces. It includes a number of common adjustments, each with a short code (see below). When you bring up the Actions input with command + K or command + / and then type a shortcode (eg. w.h), the fuzzy search will be ready to select that action.

Example: to set an element width to Hug, instead of leaving the keyboard I could do it like so:

1. `command + /` (opens Actions)
2. `w.h` (brings w.h - Set Width to Hug command into focus)
3. `Enter`

Once you get familiar with these shortcodes, you can cut down the reliance on your mouse for adjusting style values.

**[Find the full list of current commands](./COMMANDS.md)**.

## Usage

1.  Select one or more layers in your Figma file.
2.  Open the Actions input with `command + K` or `command + /`
3.  Type the short code for the command (eg. `w.h`)
4.  Press enter (assuming you have your desired command in focus)
    *   Many commands apply adjustments directly (e.g., `w.h - Set Width to Hug`).
    *   The `al.. - Set Auto Layout Alignment` command will open a dialog for visual alignment selection.
    *   Commands ending with `..` (e.g., `p.. - Set Padding`) will prompt you to enter a custom value.
    *   For those commands you can also hit `tab` and type your value without leaving the action bar