// This plugin will allow users to quickly set layout properties

// Log the command to the console for debugging
console.log('Figma command:', figma.command);

// Helper function to check if a node is a valid Auto Layout frame
function isValidAutoLayoutNode(node: SceneNode): node is FrameNode | ComponentNode | InstanceNode | ComponentSetNode {
  return (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE' || node.type === 'COMPONENT_SET') && node.layoutMode !== 'NONE';
}

// Mapping from UI index (0-8) to Figma alignment properties
// [primaryAxisAlignItems, counterAxisAlignItems]
// For a HORIZONTAL layout frame:
// primaryAxisAlignItems refers to X-axis (MIN=Left, CENTER=Center, MAX=Right)
// counterAxisAlignItems refers to Y-axis (MIN=Top, CENTER=Center, MAX=Bottom)
// For a VERTICAL layout frame:
// primaryAxisAlignItems refers to Y-axis (MIN=Top, CENTER=Center, MAX=Bottom)
// counterAxisAlignItems refers to X-axis (MIN=Left, CENTER=Center, MAX=Right)

type CommonAlignment = "MIN" | "CENTER" | "MAX";

const alignmentMap: { [key: number]: [CommonAlignment, CommonAlignment] } = {
  0: ['MIN', 'MIN'],    // Top Left in UI grid
  1: ['CENTER', 'MIN'], // Top Center in UI grid
  2: ['MAX', 'MIN'],    // Top Right in UI grid
  3: ['MIN', 'CENTER'],  // Middle Left in UI grid
  4: ['CENTER', 'CENTER'],// Middle Center in UI grid
  5: ['MAX', 'CENTER'],  // Middle Right in UI grid
  6: ['MIN', 'MAX'],    // Bottom Left in UI grid
  7: ['CENTER', 'MAX'], // Bottom Center in UI grid
  8: ['MAX', 'MAX']     // Bottom Right in UI grid
};

// Mapping from Figma alignment properties back to UI index
function getIndexFromAlignment(primary: FrameNode['primaryAxisAlignItems'], counter: FrameNode['counterAxisAlignItems'], layoutMode: FrameNode['layoutMode']): number {
  for (const key in alignmentMap) {
    const [mapPrimary, mapCounter] = alignmentMap[key];
    if (layoutMode === 'HORIZONTAL' || layoutMode === 'NONE') { // Treat NONE as HORIZONTAL for mapping back
      if (mapPrimary === primary && mapCounter === counter) {
        return parseInt(key, 10);
      }
    } else { // VERTICAL
      if (mapCounter === primary && mapPrimary === counter) { // Swapped for vertical
        return parseInt(key, 10);
      }
    }
  }
  return 4; // Default to center if no match
}

// Plugin state
let pluginIsDistributeModeActive = false;
let stashedPrimaryAxisAlignment: FrameNode['primaryAxisAlignItems'] = 'CENTER';
let stashedCounterAxisAlignment: FrameNode['counterAxisAlignItems'] = 'CENTER';


if (figma.command === 'aa') {
  figma.showUI(__html__, { width: 180, height: 180, themeColors: true });

  function sendCurrentStateToUI() {
    const selection = figma.currentPage.selection;
    const hasValidSelection = selection.some(isValidAutoLayoutNode);
    let layoutMode: FrameNode['layoutMode'] | null = null;
    let currentFigmaPrimaryAlign: FrameNode['primaryAxisAlignItems'] | null = null;
    let currentFigmaCounterAlign: FrameNode['counterAxisAlignItems'] | null = null;
    let isDistributeActiveInFigma = false;

    if (hasValidSelection) {
      const autoLayoutNode = selection.find(isValidAutoLayoutNode) as FrameNode | ComponentNode | InstanceNode | ComponentSetNode;
      layoutMode = autoLayoutNode.layoutMode;
      currentFigmaPrimaryAlign = autoLayoutNode.primaryAxisAlignItems;
      currentFigmaCounterAlign = autoLayoutNode.counterAxisAlignItems;
      isDistributeActiveInFigma = currentFigmaPrimaryAlign === 'SPACE_BETWEEN';
      
      pluginIsDistributeModeActive = isDistributeActiveInFigma;
      if (!isDistributeActiveInFigma) {
        // When not in distribute mode, stash the actual current alignments
        stashedPrimaryAxisAlignment = currentFigmaPrimaryAlign;
        stashedCounterAxisAlignment = currentFigmaCounterAlign;
      } else {
        // When in distribute mode, primary is SPACE_BETWEEN.
        // The stashedCounterAxisAlignment should reflect the current counter alignment.
        // stashedPrimaryAxisAlignment should ideally be what it was *before* entering SPACE_BETWEEN,
        // but sendCurrentStateToUI is also called on selection change, so if a new selection
        // is already SPACE_BETWEEN, we might not have the "before" state.
        // For now, we keep stashedCounterAxisAlignment updated.
        stashedCounterAxisAlignment = currentFigmaCounterAlign;
        // stashedPrimaryAxisAlignment remains as it was (hopefully the pre-distribute primary alignment)
      }
    }

    figma.ui.postMessage({
      type: 'update-plugin-state',
      hasValidSelection,
      layoutMode,
      currentFigmaPrimaryAlign,
      currentFigmaCounterAlign,
      isDistributeActiveInFigma // This is the crucial part for UI to know current Figma state
    });
  }

  sendCurrentStateToUI();

  figma.on('selectionchange', () => {
    sendCurrentStateToUI();
  });

  figma.ui.onmessage = msg => {
    if (msg.type === 'set-alignment') {
      const selection = figma.currentPage.selection;
      const [uiPrimary, uiCounter] = alignmentMap[msg.index]; // These are based on UI's grid (X, Y)

      for (const node of selection) {
        if (isValidAutoLayoutNode(node)) {
          let finalPrimaryAlign: FrameNode['primaryAxisAlignItems'];
          let finalCounterAlign: FrameNode['counterAxisAlignItems'];

          if (pluginIsDistributeModeActive) {
            finalPrimaryAlign = 'SPACE_BETWEEN';
            // In distribute mode, the UI click (msg.index) determines the counter-axis alignment.
            // The alignmentMap's second value (uiCounter) is what we need for the counter-axis.
            // However, if the layout is VERTICAL, Figma's counter-axis is horizontal (X).
            // The UI's grid Y-value (uiCounter) should map to Figma's primary (Y),
            // and UI's grid X-value (uiPrimary) should map to Figma's counter (X).
            // The comment in the original code said "UI will send an index that already considers this."
            // Let's assume for SPACE_BETWEEN, the UI sends an index where alignmentMap[msg.index][1]
            // is *always* the intended counterAxisAlignItems regardless of layoutMode.
            // This part might need refinement if the UI doesn't adjust msg.index for SPACE_BETWEEN + VERTICAL.
            // For now, we directly use uiCounter for Figma's counterAxis.
            finalCounterAlign = uiCounter;
            stashedCounterAxisAlignment = finalCounterAlign; // Stash the applied counter alignment
            // stashedPrimaryAxisAlignment remains the pre-distribute primary alignment
          } else {
            // Not in distribute mode
            if (node.layoutMode === 'VERTICAL') {
              // For VERTICAL layout:
              // Figma's primaryAxis is Y (Top/Center/Bottom from UI's Y / uiCounter)
              // Figma's counterAxis is X (Left/Center/Right from UI's X / uiPrimary)
              finalPrimaryAlign = uiCounter;
              finalCounterAlign = uiPrimary;
            } else {
              // For HORIZONTAL layout (or NONE, treat as HORIZONTAL):
              // Figma's primaryAxis is X (Left/Center/Right from UI's X / uiPrimary)
              // Figma's counterAxis is Y (Top/Center/Bottom from UI's Y / uiCounter)
              finalPrimaryAlign = uiPrimary;
              finalCounterAlign = uiCounter;
            }
            stashedPrimaryAxisAlignment = finalPrimaryAlign;
            stashedCounterAxisAlignment = finalCounterAlign;
          }
          node.primaryAxisAlignItems = finalPrimaryAlign;
          node.counterAxisAlignItems = finalCounterAlign;
        }
      }
      sendCurrentStateToUI();
    } else if (msg.type === 'toggle-distribution') {
      pluginIsDistributeModeActive = !pluginIsDistributeModeActive;
      const selection = figma.currentPage.selection;
      for (const node of selection) {
        if (isValidAutoLayoutNode(node)) {
          if (pluginIsDistributeModeActive) {
            // Entering distribute mode:
            // Stash current primary alignment *before* changing to SPACE_BETWEEN
            // This is tricky because stashedPrimaryAxisAlignment might already be from a previous state.
            // A more robust way would be to read node.primaryAxisAlignItems here if it's not already SPACE_BETWEEN.
            // However, sendCurrentStateToUI already updates stashedPrimaryAxisAlignment if not in distribute.
            // So, stashedPrimaryAxisAlignment should hold the correct pre-distribute primary value.
            node.primaryAxisAlignItems = 'SPACE_BETWEEN';
            // Counter axis remains as stashed (or as per current if UI is meant to control it during toggle)
            node.counterAxisAlignItems = stashedCounterAxisAlignment;
          } else {
            // Exiting distribute mode: revert to stashed alignments
            node.primaryAxisAlignItems = stashedPrimaryAxisAlignment;
            node.counterAxisAlignItems = stashedCounterAxisAlignment;
          }
        }
      }
      sendCurrentStateToUI();
    } else if (msg.type === 'close-dialog') {
      figma.closePlugin();
    } else if (msg.type === 'get-initial-visibility') { 
      sendCurrentStateToUI();
    } else if (msg.type === 'set-stroke') {
      const selection = figma.currentPage.selection;
      let appliedCount = 0;
      for (const node of selection) {
        if ('strokes' in node && 'strokeWeight' in node) {
          const strokeWeight = msg.value;
          const strokableNode = node as FrameNode | RectangleNode | EllipseNode | PolygonNode | StarNode | LineNode | VectorNode | TextNode | ComponentNode | InstanceNode | ComponentSetNode; 

          if (strokeWeight > 0) {
            if (strokableNode.strokes.length === 0) {
              strokableNode.strokes = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }]; 
            }
            strokableNode.strokeWeight = strokeWeight;
          } else {
            strokableNode.strokeWeight = 0;
          }
          appliedCount++;
        }
      }
      if (appliedCount > 0) {
        figma.notify(`Stroke set to ${msg.value} for ${appliedCount} layer(s).`);
      }
    }
  };
} else if (figma.command === 'str1' || figma.command === 'str0') {
  const selection = figma.currentPage.selection;
  let S = selection.length;
  if (S === 0) {
    figma.notify('Please select at least one layer.', { error: true });
    figma.closePlugin();
  } else {
    let modifiedCount = 0;
    const strokeWeight = figma.command === 'str1' ? 1 : 0;
    const commandName = `Set Stroke to ${strokeWeight}`;

    for (const node of selection) {
      if ('strokes' in node && 'strokeWeight' in node) {
        const strokableNode = node as FrameNode | RectangleNode | EllipseNode | PolygonNode | StarNode | LineNode | VectorNode | TextNode | ComponentNode | InstanceNode | ComponentSetNode;
        if (strokeWeight > 0) {
          if (strokableNode.strokes.length === 0) {
            strokableNode.strokes = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
          }
          strokableNode.strokeWeight = strokeWeight;
        } else {
          strokableNode.strokeWeight = 0;
        }
        modifiedCount++;
      }
    }

    if (modifiedCount > 0) {
      figma.notify(`Applied "${commandName}" to ${modifiedCount} layer${modifiedCount === 1 ? '' : 's'}.`);
    } else {
      figma.notify(`No applicable layers found for "${commandName}".`, { timeout: 3000 });
    }
    figma.closePlugin();
  }
} else if (figma.command === 'fll' || figma.command === 'fll0') {
  const selection = figma.currentPage.selection;
  let S = selection.length;
  if (S === 0) {
    figma.notify('Please select at least one layer.', { error: true });
    figma.closePlugin();
  } else {
    let modifiedCount = 0;
    const commandName = figma.command === 'fll' ? 'Add Default Fill' : 'Remove All Fills';

    for (const node of selection) {
      if ('fills' in node) {
        const fillableNode = node as SceneNode & { fills: readonly Paint[] | typeof figma.mixed }; 
        if (figma.command === 'fll') {
          fillableNode.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
        } else { 
          fillableNode.fills = [];
        }
        modifiedCount++;
      }
    }

    if (modifiedCount > 0) {
      figma.notify(`Applied "${commandName}" to ${modifiedCount} layer${modifiedCount === 1 ? '' : 's'}.`);
    } else {
      figma.notify(`No applicable layers found for "${commandName}".`, { timeout: 3000 });
    }
    figma.closePlugin();
  }
} else {
  const selection = figma.currentPage.selection;
  let S = selection.length; 

  if (S === 0 && figma.command !== 'aa') { 
    figma.notify('Please select at least one layer.', { error: true });
    figma.closePlugin();
  } else if (figma.command !== 'aa') { 
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
        } else if (
          node.type === 'FRAME' ||
          node.type === 'COMPONENT' ||
          node.type === 'COMPONENT_SET' ||
          node.type === 'INSTANCE' ||
          node.type === 'TEXT' ||
          node.type === 'RECTANGLE' 
        ) {
          const operableNode = node as FrameNode | ComponentNode | ComponentSetNode | InstanceNode | TextNode | RectangleNode; 

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
          } else if (figma.command === 'hf') {
            commandName = 'Height to Fill';
            if (operableNode.parent && operableNode.parent.type === 'FRAME' && (operableNode.parent as FrameNode).layoutMode !== 'NONE') {
              operableNode.layoutSizingVertical = 'FILL';
              modifiedCount++;
            }
          } else if (figma.command === 'p0') {
            commandName = 'Set All Padding to 0';
            if ('paddingTop' in operableNode && 'paddingBottom' in operableNode && 'paddingLeft' in operableNode && 'paddingRight' in operableNode) {
              const paddedNode = operableNode as FrameNode | ComponentNode | InstanceNode | ComponentSetNode;
              paddedNode.paddingTop = 0;
              paddedNode.paddingBottom = 0;
              paddedNode.paddingLeft = 0;
              paddedNode.paddingRight = 0;
              modifiedCount++;
            }
          } else if (figma.command === 'p16') {
            commandName = 'Set All Padding to 16';
            if ('paddingTop' in operableNode && 'paddingBottom' in operableNode && 'paddingLeft' in operableNode && 'paddingRight' in operableNode) {
              const paddedNode = operableNode as FrameNode | ComponentNode | InstanceNode | ComponentSetNode;
              paddedNode.paddingTop = 16;
              paddedNode.paddingBottom = 16;
              paddedNode.paddingLeft = 16;
              paddedNode.paddingRight = 16;
              modifiedCount++;
            }
          } else if (figma.command === 'br8') {
            commandName = 'Set Border Radius to 8px';
            if ('cornerRadius' in operableNode) {
              operableNode.cornerRadius = 8;
              modifiedCount++;
            }
          } else if (figma.command === 'br0') {
            commandName = 'Set Border Radius to 0px';
            if ('cornerRadius' in operableNode) {
              operableNode.cornerRadius = 0;
              modifiedCount++;
            }
          }
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
  } else if (figma.command !== 'aa') { 
     figma.closePlugin();
  }
}
