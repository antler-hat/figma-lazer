// This plugin will allow users to quickly set layout properties

// Log the command to the console for debugging
console.log('Figma command:', figma.command);

// Helper function to check if a node is a valid Auto Layout frame
function isValidAutoLayoutNode(node: SceneNode): node is FrameNode | ComponentNode | InstanceNode | ComponentSetNode {
  return (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE' || node.type === 'COMPONENT_SET') && node.layoutMode !== 'NONE';
}

// Mapping from UI index (0-8) to Figma alignment properties
// [primaryAxisAlignItems, counterAxisAlignItems]
const alignmentMap: { [key: number]: [FrameNode['primaryAxisAlignItems'], FrameNode['counterAxisAlignItems']] } = {
  0: ['MIN', 'MIN'],    // Top Left
  1: ['CENTER', 'MIN'], // Top Center
  2: ['MAX', 'MIN'],    // Top Right
  3: ['MIN', 'CENTER'],  // Middle Left
  4: ['CENTER', 'CENTER'],// Middle Center
  5: ['MAX', 'CENTER'],  // Middle Right
  6: ['MIN', 'MAX'],    // Bottom Left
  7: ['CENTER', 'MAX'], // Bottom Center
  8: ['MAX', 'MAX']     // Bottom Right
};

// Mapping from Figma alignment properties back to UI index
function getIndexFromAlignment(primary: FrameNode['primaryAxisAlignItems'], counter: FrameNode['counterAxisAlignItems']): number {
  for (const key in alignmentMap) {
    if (alignmentMap[key][0] === primary && alignmentMap[key][1] === counter) {
      return parseInt(key, 10);
    }
  }
  return 4; // Default to center if no match (should not happen with valid inputs)
}


if (figma.command === 'aa') {
  figma.showUI(__html__, { width: 180, height: 180, themeColors: true });

  function sendVisibilityUpdate() {
    const selection = figma.currentPage.selection;
    const hasValidSelection = selection.some(isValidAutoLayoutNode);
    figma.ui.postMessage({ type: 'update-visibility', hasValidSelection });

    if (hasValidSelection) {
      const autoLayoutNode = selection.find(isValidAutoLayoutNode) as FrameNode | ComponentNode | InstanceNode | ComponentSetNode; // We know one exists
      const initialPrimaryAlign = autoLayoutNode.primaryAxisAlignItems;
      const initialCounterAlign = autoLayoutNode.counterAxisAlignItems;
      const initialIndex = getIndexFromAlignment(initialPrimaryAlign, initialCounterAlign);
      figma.ui.postMessage({ type: 'set-initial-alignment', index: initialIndex });
    }
  }

  // Send initial state
  sendVisibilityUpdate();

  // Listen for selection changes
  figma.on('selectionchange', () => {
    sendVisibilityUpdate();
  });

  figma.ui.onmessage = msg => {
    if (msg.type === 'set-alignment') {
      const selection = figma.currentPage.selection;
      const [primaryAlign, counterAlign] = alignmentMap[msg.index];
      let appliedCount = 0;
      for (const node of selection) {
        if (isValidAutoLayoutNode(node)) {
          node.primaryAxisAlignItems = primaryAlign;
          node.counterAxisAlignItems = counterAlign;
          appliedCount++;
        }
      }
      // Optional: notify user of change
      // if (appliedCount > 0) {
      //   figma.notify(`Alignment set for ${appliedCount} layer(s).`);
      // }
    } else if (msg.type === 'close-dialog') {
      figma.closePlugin();
    } else if (msg.type === 'get-initial-visibility') { // Handle request from UI
      sendVisibilityUpdate();
    }
  };
} else {
  // Existing command logic
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
          }
          // Removed specific error for Group "Fill container"
        } else if (
          node.type === 'FRAME' ||
          node.type === 'COMPONENT' ||
          node.type === 'COMPONENT_SET' ||
          node.type === 'INSTANCE' ||
          node.type === 'TEXT' ||
          node.type === 'RECTANGLE' // Added RECTANGLE here
        ) {
          const operableNode = node as FrameNode | ComponentNode | ComponentSetNode | InstanceNode | TextNode | RectangleNode; // Added RectangleNode here

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
            }
            // Removed specific error for Fill Width
          } else if (figma.command === 'hf') {
            commandName = 'Height to Fill';
            if (operableNode.parent && operableNode.parent.type === 'FRAME' && (operableNode.parent as FrameNode).layoutMode !== 'NONE') {
              operableNode.layoutSizingVertical = 'FILL';
              modifiedCount++;
            }
            // Removed specific error for Fill Height
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
            }
            // Removed specific error for padding
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
            }
            // Removed specific error for padding
          } else if (figma.command === 'br8') {
            commandName = 'Set Border Radius to 8px';
            if ('cornerRadius' in operableNode) {
              operableNode.cornerRadius = 8;
              modifiedCount++;
            }
            // Removed specific error for border radius
          } else if (figma.command === 'br0') {
            commandName = 'Set Border Radius to 0px';
            if ('cornerRadius' in operableNode) {
              operableNode.cornerRadius = 0;
              modifiedCount++;
            }
            // Removed specific error for border radius
          }
        }
        // Removed specific error for unsupported layer types for layout operations
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
