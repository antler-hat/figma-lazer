// This plugin will allow users to quickly set layout properties

// This plugin will allow users to quickly set layout properties
// AND provides a command input UI.

// Log the command to the console for debugging, if any command was used to launch
if (figma.command) {
  console.log('Figma command used to launch:', figma.command);
}

// --- Helper functions from existing code (can be used by future commands) ---
function isValidAutoLayoutNode(node: SceneNode): node is FrameNode | ComponentNode | InstanceNode | ComponentSetNode {
  return (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE' || node.type === 'COMPONENT_SET') && node.layoutMode !== 'NONE';
}

const alignmentMap: { [key: number]: [FrameNode['primaryAxisAlignItems'], FrameNode['counterAxisAlignItems']] } = {
  0: ['MIN', 'MIN'], 1: ['CENTER', 'MIN'], 2: ['MAX', 'MIN'],
  3: ['MIN', 'CENTER'], 4: ['CENTER', 'CENTER'], 5: ['MAX', 'CENTER'],
  6: ['MIN', 'MAX'], 7: ['CENTER', 'MAX'], 8: ['MAX', 'MAX']
};

function getIndexFromAlignment(primary: FrameNode['primaryAxisAlignItems'], counter: FrameNode['counterAxisAlignItems']): number {
  for (const key in alignmentMap) {
    if (alignmentMap[key][0] === primary && alignmentMap[key][1] === counter) {
      return parseInt(key, 10);
    }
  }
  return 4; // Default to center
}
// --- End of helper functions ---


// --- New Command Input UI Logic ---
// Show the command input UI. Dimensions are for the content area.
// Figma adds its own title bar.
figma.showUI(__html__, { width: 300, height: 40, title: "Lazer", themeColors: true });

// Send initial focus message to the UI
figma.ui.postMessage({ type: 'focus-plugin-input' });

// Listen for selection changes on the Figma canvas
figma.on('selectionchange', () => {
  // When selection changes, tell the UI to re-focus its input
  // The UI itself will handle deactivating if it was in an active input state
  figma.ui.postMessage({ type: 'focus-plugin-input' });
});

// Handle messages from the UI
figma.ui.onmessage = msg => {
  if (msg.type === 'submit-command') {
    const command = msg.command;
    console.log('Received command from UI:', command);

    // Placeholder: Notify user that command was submitted
    // Later, this will parse and execute commands
    figma.notify(`Command: "${command}" submitted! (Placeholder)`, { timeout: 2000 });

    // Send a success message back to UI to display
    figma.ui.postMessage({ type: 'command-success', message: `Processed: ${command}` });
    
    // No need to explicitly re-focus here, as 'command-success' in ui.html already does.
  }
  // Add other message types from UI if needed in the future
};


// --- Existing Menu/Quick Action Command Logic ---
// This part handles commands invoked directly via Figma's menu or quick actions.
// It will run if figma.command is set.
if (figma.command && figma.command !== 'aa') { // 'aa' is handled by the old UI, which we are replacing.
                                            // For now, if 'aa' is somehow triggered, it will do nothing here.
                                            // We might want to remove 'aa' from manifest.json later or make it open the new UI.
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
