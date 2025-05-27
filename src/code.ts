// This plugin will allow users to quickly set layout properties

// Log the command to the console for debugging
console.log('Figma command:', figma.command);

// Get the current selection
const selection = figma.currentPage.selection;
let S = selection.length; // S for "Selection"

// Check if anything is selected
if (S === 0) {
  figma.notify('Please select at least one layer.', { error: true });
  figma.closePlugin();
} else {
  let modifiedCount = 0;
  let commandName = '';

  // Iterate over selected nodes
  for (const node of selection) {
    try {
      if (node.type === 'GROUP') {
        commandName = figma.command === 'wh' ? 'Width to Hug' : figma.command === 'hh' ? 'Height to Hug' : figma.command === 'wf' ? 'Width to Fill' : 'Height to Fill';
        if (figma.command === 'wh' || figma.command === 'hh') {
          // Groups inherently hug their content. This is a no-op but considered successful.
          figma.notify(`Group "${node.name}" naturally hugs its content.`, { timeout: 2000 });
          modifiedCount++;
        } else if (figma.command === 'wf' || figma.command === 'hf') {
          figma.notify(`Cannot set "Fill container" for Group "${node.name}". Consider framing it and applying auto-layout.`, { error: true, timeout: 3500 });
        }
      } else if (
        node.type === 'FRAME' ||
        node.type === 'COMPONENT' ||
        node.type === 'COMPONENT_SET' || // Component Sets can also be resized
        node.type === 'INSTANCE' ||
        node.type === 'TEXT'
        // SHAPE_WITH_TEXT is problematic with current typings for these properties
      ) {
        // These types are expected to have layoutSizingHorizontal/Vertical
        const operableNode = node as FrameNode | ComponentNode | ComponentSetNode | InstanceNode | TextNode;

        if (figma.command === 'wh') {
          commandName = 'Width to Hug';
          operableNode.layoutSizingHorizontal = 'HUG';
          modifiedCount++;
        } else if (figma.command === 'hh') {
          commandName = 'Height to Hug';
          operableNode.layoutSizingVertical = 'HUG';
          modifiedCount++;
        } else if (figma.command === 'wf') {
          commandName = 'Width to Fill';
          if (operableNode.parent && operableNode.parent.type === 'FRAME' && (operableNode.parent as FrameNode).layoutMode !== 'NONE') {
            operableNode.layoutSizingHorizontal = 'FILL';
            modifiedCount++;
          } else {
            figma.notify(`"${operableNode.name}" cannot be set to Fill Width. Parent must be an Auto Layout frame.`, { error: true, timeout: 3500 });
          }
        } else if (figma.command === 'hf') {
          commandName = 'Height to Fill';
          if (operableNode.parent && operableNode.parent.type === 'FRAME' && (operableNode.parent as FrameNode).layoutMode !== 'NONE') {
            operableNode.layoutSizingVertical = 'FILL';
            modifiedCount++;
          } else {
            figma.notify(`"${operableNode.name}" cannot be set to Fill Height. Parent must be an Auto Layout frame.`, { error: true, timeout: 3500 });
          }
        } else if (figma.command === 'p0') {
          commandName = 'Set All Padding to 0';
          if ('paddingTop' in operableNode && 'paddingBottom' in operableNode && 'paddingLeft' in operableNode && 'paddingRight' in operableNode) {
            operableNode.paddingTop = 0;
            operableNode.paddingBottom = 0;
            operableNode.paddingLeft = 0;
            operableNode.paddingRight = 0;
            modifiedCount++;
          } else {
            figma.notify(`Layer "${operableNode.name}" of type "${operableNode.type}" does not support padding.`, { error: true, timeout: 3000 });
          }
        } else if (figma.command === 'p16') {
          commandName = 'Set All Padding to 16';
          if ('paddingTop' in operableNode && 'paddingBottom' in operableNode && 'paddingLeft' in operableNode && 'paddingRight' in operableNode) {
            operableNode.paddingTop = 16;
            operableNode.paddingBottom = 16;
            operableNode.paddingLeft = 16;
            operableNode.paddingRight = 16;
            modifiedCount++;
          } else {
            figma.notify(`Layer "${operableNode.name}" of type "${operableNode.type}" does not support padding.`, { error: true, timeout: 3000 });
          }
        }
      } else {
        // Other node types (e.g., SLICE, SECTION, VECTOR without text capabilities for these properties)
        figma.notify(`Layer "${node.name}" of type "${node.type}" does not support these specific layout operations.`, { error: true, timeout: 3000 });
      }
    } catch (e) {
      // Catch any errors during property assignment
      figma.notify(`Error applying to "${node.name}": ${(e as Error).message}`, { error: true, timeout: 3000 });
    }
  }

  if (modifiedCount > 0 && commandName) {
    const plural = modifiedCount === 1 ? '' : 's';
    figma.notify(`Applied "${commandName}" to ${modifiedCount} layer${plural}.`);
  } else if (S > 0 && commandName !== '') {
    // If a command was attempted but nothing was modified (e.g. all selected items were incompatible for "Fill")
    figma.notify(`No applicable layers found for "${commandName}".`, { timeout: 3000 });
  }
  // If S > 0 but no commandName was set (e.g. unknown command), no specific notification here,
  // as the initial console.log would show the unknown command.
  // The plugin closes regardless.
}

// Make sure to close the plugin when you're done. Otherwise the plugin will
// keep running, which shows the cancel button at the bottom of the screen.
figma.closePlugin();
