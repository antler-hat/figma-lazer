// This plugin will allow users to quickly set layout properties

// Log the command to the console for debugging
console.log('Figma command:', figma.command);

// Helper function to check if a node is a valid Auto Layout frame
// function isValidAutoLayoutNode(node: SceneNode): node is FrameNode | ComponentNode | InstanceNode | ComponentSetNode {
//   return (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE' || node.type === 'COMPONENT_SET') && node.layoutMode !== 'NONE';
// }

// --- NEW HELPER FUNCTIONS ---

// Helper to check if a node can have corner radius
function canHaveCornerRadius(node: SceneNode): node is FrameNode | ComponentNode | InstanceNode | ComponentSetNode | RectangleNode | StarNode | PolygonNode | EllipseNode {
    return node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE' || node.type === 'COMPONENT_SET' ||
           node.type === 'RECTANGLE' || node.type === 'STAR' || node.type === 'POLYGON' || node.type === 'ELLIPSE';
}

// Helper to check if a node can have padding
function canHavePadding(node: SceneNode): node is FrameNode | ComponentNode | InstanceNode | ComponentSetNode {
    return (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE' || node.type === 'COMPONENT_SET') && 'paddingTop' in node;
}

// Helper to check if a node can have layout sizing (hug/fill)
function canHaveLayoutSizing(node: SceneNode): node is FrameNode | ComponentNode | InstanceNode | ComponentSetNode | TextNode {
    return node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE' || node.type === 'COMPONENT_SET' || node.type === 'TEXT';
}


function applyBorderRadius(nodes: ReadonlyArray<SceneNode>, radius: number): number {
    let appliedCount = 0;
    for (const node of nodes) {
        if (canHaveCornerRadius(node)) {
            // All node types that pass canHaveCornerRadius are known to have .cornerRadius
            // This sets the radius uniformly for all corners.
            node.cornerRadius = radius;
            appliedCount++;
        }
    }
    return appliedCount;
}

function applyPadding(nodes: ReadonlyArray<SceneNode>, padding: number): number {
    let appliedCount = 0;
    for (const node of nodes) {
        if (canHavePadding(node)) {
            node.paddingTop = padding;
            node.paddingBottom = padding;
            node.paddingLeft = padding;
            node.paddingRight = padding;
            appliedCount++;
        }
    }
    return appliedCount;
}

function applySizing(nodes: ReadonlyArray<SceneNode>, axis: 'horizontal' | 'vertical', mode: 'HUG' | 'FILL'): number {
    let appliedCount = 0;
    for (const node of nodes) {
        if (canHaveLayoutSizing(node)) {
            if (axis === 'horizontal') {
                if (mode === 'FILL' && node.parent && node.parent.type === 'FRAME' && (node.parent as FrameNode).layoutMode !== 'NONE') {
                    node.layoutSizingHorizontal = 'FILL';
                    appliedCount++;
                } else if (mode === 'HUG') {
                    node.layoutSizingHorizontal = 'HUG';
                    appliedCount++;
                } else if (mode === 'FILL') {
                     figma.notify(`"${node.name}" cannot be set to Fill Width. Parent must be an Auto Layout frame.`, { error: true, timeout: 2500 });
                }
            } else { // vertical
                if (mode === 'FILL' && node.parent && node.parent.type === 'FRAME' && (node.parent as FrameNode).layoutMode !== 'NONE') {
                    node.layoutSizingVertical = 'FILL';
                    appliedCount++;
                } else if (mode === 'HUG') {
                    node.layoutSizingVertical = 'HUG';
                    appliedCount++;
                } else if (mode === 'FILL') {
                    figma.notify(`"${node.name}" cannot be set to Fill Height. Parent must be an Auto Layout frame.`, { error: true, timeout: 2500 });
                }
            }
        }
    }
    return appliedCount;
}


function executeStyleCommand(commandString: string) {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
        figma.notify('Please select at least one layer.', { error: true });
        figma.ui.postMessage({ type: 'INVALID_STYLE_COMMAND' }); // Also inform UI
        return;
    }

    const command = commandString.toLowerCase();
    let modifiedCount = 0;
    let actionName = '';

    // Border Radius: e.g., "br5", "br0", "br10"
    if (command.startsWith('br')) {
        const value = parseInt(command.substring(2));
        if (!isNaN(value)) {
            actionName = `Set Border Radius to ${value}`;
            modifiedCount = applyBorderRadius(selection, value);
        }
    }
    // Padding: e.g., "p0", "p16"
    else if (command.startsWith('p')) {
        const value = parseInt(command.substring(1));
        if (!isNaN(value)) {
            actionName = `Set All Padding to ${value}`;
            modifiedCount = applyPadding(selection, value);
        }
    }
    // Sizing: "wh", "hh", "wf", "hf"
    else if (command === 'wh') {
        actionName = 'Width to Hug';
        modifiedCount = applySizing(selection, 'horizontal', 'HUG');
    } else if (command === 'hh') {
        actionName = 'Height to Hug';
        modifiedCount = applySizing(selection, 'vertical', 'HUG');
    } else if (command === 'wf') {
        actionName = 'Width to Fill';
        modifiedCount = applySizing(selection, 'horizontal', 'FILL');
    } else if (command === 'hf') {
        actionName = 'Height to Fill';
        modifiedCount = applySizing(selection, 'vertical', 'FILL');
    }
    // Add more commands here as needed

    if (actionName && modifiedCount > 0) {
        figma.notify(`Applied "${actionName}" to ${modifiedCount} layer(s).`);
    } else if (actionName) { // Action was recognized but nothing was modified
        figma.notify(`No applicable layers found for "${actionName}".`, { timeout: 2000 });
        figma.ui.postMessage({ type: 'INVALID_STYLE_COMMAND' });
    } else { // Command not recognized
        figma.notify(`Unknown command: "${commandString}"`, { error: true, timeout: 2000 });
        figma.ui.postMessage({ type: 'INVALID_STYLE_COMMAND' });
    }
}


if (figma.command === 'aa' || figma.command === 'style_palette') { // Assuming 'aa' evolves or use a new command
  figma.showUI(__html__, { width: 180, height: 50, themeColors: true }); // Adjusted size for icon + input

  figma.ui.onmessage = msg => {
    if (msg.type === 'RUN_STYLE_COMMAND') {
      executeStyleCommand(msg.payload);
    }
    // We don't close the plugin here to keep the UI persistent
    // Old 'close-dialog' and alignment specific messages are removed
  };
} else {
  // Existing quick command logic (wh, hh, wf, hf, p0, p16)
  // This part can be kept if you want to maintain the old quick commands
  // accessible via Figma's command palette directly, without the new UI.
  // Otherwise, this entire 'else' block could be removed if 'aa' is the sole entry point.
  const selection = figma.currentPage.selection;
  let S = selection.length; // S for "Selection"

  if (S === 0 && figma.command !== 'aa') { // Ensure this doesn't run for 'aa' if it somehow reaches here
    figma.notify('Please select at least one layer.', { error: true });
    figma.closePlugin();
  } else if (figma.command !== 'aa') { // Process other commands
    let modifiedCount = 0;
    let commandName = '';

    for (const node of selection) {
      try {
        if (node.type === 'GROUP') {
          commandName = figma.command === 'wh' ? 'Width to Hug' : figma.command === 'hh' ? 'Height to Hug' : figma.command === 'wf' ? 'Width to Fill' : 'Height to Fill';
          if (figma.command === 'wh' || figma.command === 'hh') {
            figma.notify(`Group "${node.name}" naturally hugs its content.`, { timeout: 2000 });
            modifiedCount++;
          } else if (figma.command === 'wf' || figma.command === 'hf') {
            figma.notify(`Cannot set "Fill container" for Group "${node.name}". Consider framing it and applying auto-layout.`, { error: true, timeout: 3500 });
          }
        } else if (
          node.type === 'FRAME' ||
          node.type === 'COMPONENT' ||
          node.type === 'COMPONENT_SET' ||
          node.type === 'INSTANCE' ||
          node.type === 'TEXT'
        ) {
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
              // Ensure node is FrameNode or similar that supports padding
              const paddedNode = operableNode as FrameNode | ComponentNode | InstanceNode | ComponentSetNode;
              paddedNode.paddingTop = 0;
              paddedNode.paddingBottom = 0;
              paddedNode.paddingLeft = 0;
              paddedNode.paddingRight = 0;
              modifiedCount++;
            } else {
              figma.notify(`Layer "${operableNode.name}" of type "${operableNode.type}" does not support padding.`, { error: true, timeout: 3000 });
            }
          } else if (figma.command === 'p16') {
            commandName = 'Set All Padding to 16';
            if ('paddingTop' in operableNode && 'paddingBottom' in operableNode && 'paddingLeft' in operableNode && 'paddingRight' in operableNode) {
               // Ensure node is FrameNode or similar that supports padding
              const paddedNode = operableNode as FrameNode | ComponentNode | InstanceNode | ComponentSetNode;
              paddedNode.paddingTop = 16;
              paddedNode.paddingBottom = 16;
              paddedNode.paddingLeft = 16;
              paddedNode.paddingRight = 16;
              modifiedCount++;
            } else {
              figma.notify(`Layer "${operableNode.name}" of type "${operableNode.type}" does not support padding.`, { error: true, timeout: 3000 });
            }
          }
        } else {
          figma.notify(`Layer "${node.name}" of type "${node.type}" does not support these specific layout operations.`, { error: true, timeout: 3000 });
        }
      } catch (e) {
        figma.notify(`Error applying to "${node.name}": ${(e as Error).message}`, { error: true, timeout: 3000 });
      }
    }

    if (modifiedCount > 0 && commandName) {
      const plural = modifiedCount === 1 ? '' : 's';
      figma.notify(`Applied "${commandName}" to ${modifiedCount} layer${plural}.`);
    } else if (S > 0 && commandName !== '') {
      figma.notify(`No applicable layers found for "${commandName}".`, { timeout: 3000 });
    }
    figma.closePlugin();
  } else if (figma.command !== 'aa') { // Catch-all for safety, though above conditions should handle it.
     figma.closePlugin();
  }
}
