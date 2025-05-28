"use strict";
// This plugin will allow users to quickly set layout properties
// Log the command to the console for debugging
console.log('Figma command:', figma.command);
// Helper function to check if a node is a valid Auto Layout frame
function isValidAutoLayoutNode(node) {
    return (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE' || node.type === 'COMPONENT_SET') && node.layoutMode !== 'NONE';
}
// Mapping from UI index (0-8) to Figma alignment properties
// [primaryAxisAlignItems, counterAxisAlignItems]
const alignmentMap = {
    0: ['MIN', 'MIN'], // Top Left
    1: ['CENTER', 'MIN'], // Top Center
    2: ['MAX', 'MIN'], // Top Right
    3: ['MIN', 'CENTER'], // Middle Left
    4: ['CENTER', 'CENTER'], // Middle Center
    5: ['MAX', 'CENTER'], // Middle Right
    6: ['MIN', 'MAX'], // Bottom Left
    7: ['CENTER', 'MAX'], // Bottom Center
    8: ['MAX', 'MAX'] // Bottom Right
};
// Mapping from Figma alignment properties back to UI index
function getIndexFromAlignment(primary, counter) {
    for (const key in alignmentMap) {
        if (alignmentMap[key][0] === primary && alignmentMap[key][1] === counter) {
            return parseInt(key, 10);
        }
    }
    return 4; // Default to center if no match (should not happen with valid inputs)
}
// Plugin state
let pluginIsDistributeModeActive = false;
let stashedPrimaryAxisAlignment = 'CENTER';
let stashedCounterAxisAlignment = 'CENTER';
if (figma.command === 'aa') {
    figma.showUI(__html__, { width: 180, height: 180, themeColors: true });
    function sendCurrentStateToUI() {
        const selection = figma.currentPage.selection;
        const hasValidSelection = selection.some(isValidAutoLayoutNode);
        let layoutMode = null;
        let currentFigmaPrimaryAlign = null;
        let currentFigmaCounterAlign = null;
        let isDistributeActiveInFigma = false;
        if (hasValidSelection) {
            const autoLayoutNode = selection.find(isValidAutoLayoutNode);
            layoutMode = autoLayoutNode.layoutMode;
            currentFigmaPrimaryAlign = autoLayoutNode.primaryAxisAlignItems;
            currentFigmaCounterAlign = autoLayoutNode.counterAxisAlignItems;
            isDistributeActiveInFigma = currentFigmaPrimaryAlign === 'SPACE_BETWEEN';
            // Sync plugin state with Figma's actual state on selection change or load
            pluginIsDistributeModeActive = isDistributeActiveInFigma;
            if (!isDistributeActiveInFigma) {
                stashedPrimaryAxisAlignment = currentFigmaPrimaryAlign;
                stashedCounterAxisAlignment = currentFigmaCounterAlign;
            }
            else {
                // If Figma is in SPACE_BETWEEN, we need to ensure stashedCounterAxisAlignment is up-to-date
                // stashedPrimaryAxisAlignment would have been set before entering SPACE_BETWEEN
                stashedCounterAxisAlignment = currentFigmaCounterAlign;
            }
        }
        figma.ui.postMessage({
            type: 'update-plugin-state',
            hasValidSelection,
            layoutMode,
            currentFigmaPrimaryAlign,
            currentFigmaCounterAlign,
            isDistributeActiveInFigma
        });
    }
    // Send initial state
    sendCurrentStateToUI();
    // Listen for selection changes
    figma.on('selectionchange', () => {
        sendCurrentStateToUI();
    });
    figma.ui.onmessage = msg => {
        if (msg.type === 'set-alignment') {
            const selection = figma.currentPage.selection;
            let primaryAlign;
            let counterAlign;
            if (pluginIsDistributeModeActive) {
                primaryAlign = 'SPACE_BETWEEN';
                // For SPACE_BETWEEN, the UI index (0-8) needs to map to counter-axis MIN, CENTER, MAX
                // Assuming horizontal layout: 0,1,2 -> MIN; 3,4,5 -> CENTER; 6,7,8 -> MAX for counter (vertical)
                // Assuming vertical layout: 0,3,6 -> MIN; 1,4,7 -> CENTER; 2,5,8 -> MAX for counter (horizontal)
                // The UI will send an index that already considers this.
                // For now, let's assume msg.index directly gives the correct mapping for the counter axis
                // based on the current layout direction (which UI will handle).
                // The alignmentMap gives [primary, counter]. We need the counter part.
                counterAlign = alignmentMap[msg.index][1]; // This might need refinement based on UI's index logic in distribute mode
                stashedCounterAxisAlignment = counterAlign; // Update stashed counter alignment
            }
            else {
                [primaryAlign, counterAlign] = alignmentMap[msg.index];
                stashedPrimaryAxisAlignment = primaryAlign;
                stashedCounterAxisAlignment = counterAlign;
            }
            for (const node of selection) {
                if (isValidAutoLayoutNode(node)) {
                    node.primaryAxisAlignItems = primaryAlign;
                    node.counterAxisAlignItems = counterAlign;
                }
            }
            sendCurrentStateToUI(); // Refresh UI with potentially new state from Figma
        }
        else if (msg.type === 'toggle-distribution') {
            pluginIsDistributeModeActive = !pluginIsDistributeModeActive;
            const selection = figma.currentPage.selection;
            for (const node of selection) {
                if (isValidAutoLayoutNode(node)) {
                    if (pluginIsDistributeModeActive) {
                        // When entering distribute mode, primary is SPACE_BETWEEN, counter is the stashed counter.
                        node.primaryAxisAlignItems = 'SPACE_BETWEEN';
                        node.counterAxisAlignItems = stashedCounterAxisAlignment;
                    }
                    else {
                        // When exiting distribute mode, revert to stashed primary and counter.
                        node.primaryAxisAlignItems = stashedPrimaryAxisAlignment;
                        node.counterAxisAlignItems = stashedCounterAxisAlignment;
                    }
                }
            }
            sendCurrentStateToUI();
        }
        else if (msg.type === 'close-dialog') {
            figma.closePlugin();
        }
        else if (msg.type === 'get-initial-visibility') { // Renamed to get-initial-state or similar
            sendCurrentStateToUI();
        }
        else if (msg.type === 'set-stroke') {
            const selection = figma.currentPage.selection;
            let appliedCount = 0;
            for (const node of selection) {
                if ('strokes' in node && 'strokeWeight' in node) {
                    const strokeWeight = msg.value;
                    // Ensure node is of a type that supports strokes and strokeWeight
                    const strokableNode = node; // Add other types as needed
                    if (strokeWeight > 0) {
                        // If setting stroke to a value > 0, ensure there's a stroke paint
                        if (strokableNode.strokes.length === 0) {
                            strokableNode.strokes = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }]; // Default to black
                        }
                        strokableNode.strokeWeight = strokeWeight;
                    }
                    else {
                        // If setting stroke to 0, effectively remove stroke by setting weight to 0
                        // Or, one could remove all stroke paints: strokableNode.strokes = [];
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
}
else if (figma.command === 'str1' || figma.command === 'str0') {
    const selection = figma.currentPage.selection;
    let S = selection.length;
    if (S === 0) {
        figma.notify('Please select at least one layer.', { error: true });
        figma.closePlugin();
        // Removed return statement here as figma.closePlugin() should suffice
    }
    else {
        let modifiedCount = 0;
        const strokeWeight = figma.command === 'str1' ? 1 : 0;
        const commandName = `Set Stroke to ${strokeWeight}`;
        for (const node of selection) {
            if ('strokes' in node && 'strokeWeight' in node) {
                const strokableNode = node;
                if (strokeWeight > 0) {
                    if (strokableNode.strokes.length === 0) {
                        strokableNode.strokes = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
                    }
                    strokableNode.strokeWeight = strokeWeight;
                }
                else {
                    strokableNode.strokeWeight = 0;
                }
                modifiedCount++;
            }
        }
        if (modifiedCount > 0) {
            figma.notify(`Applied "${commandName}" to ${modifiedCount} layer${modifiedCount === 1 ? '' : 's'}.`);
        }
        else {
            figma.notify(`No applicable layers found for "${commandName}".`, { timeout: 3000 });
        }
        figma.closePlugin();
    }
}
else {
    // Existing command logic
    // Existing command logic
    const selection = figma.currentPage.selection;
    let S = selection.length; // S for "Selection"
    if (S === 0 && figma.command !== 'aa') { // Ensure this doesn't run for 'aa' if it somehow reaches here
        figma.notify('Please select at least one layer.', { error: true });
        figma.closePlugin();
    }
    else if (figma.command !== 'aa') { // Process other commands
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
                }
                else if (node.type === 'FRAME' ||
                    node.type === 'COMPONENT' ||
                    node.type === 'COMPONENT_SET' ||
                    node.type === 'INSTANCE' ||
                    node.type === 'TEXT' ||
                    node.type === 'RECTANGLE' // Added RECTANGLE here
                ) {
                    const operableNode = node; // Added RectangleNode here
                    if (figma.command === 'wh') {
                        commandName = 'Width to Hug';
                        operableNode.layoutSizingHorizontal = 'HUG';
                        modifiedCount++;
                    }
                    else if (figma.command === 'hh') {
                        commandName = 'Height to Hug';
                        operableNode.layoutSizingVertical = 'HUG';
                        modifiedCount++;
                    }
                    else if (figma.command === 'wf') {
                        commandName = 'Width to Fill';
                        if (operableNode.parent && operableNode.parent.type === 'FRAME' && operableNode.parent.layoutMode !== 'NONE') {
                            operableNode.layoutSizingHorizontal = 'FILL';
                            modifiedCount++;
                        }
                        // Removed specific error for Fill Width
                    }
                    else if (figma.command === 'hf') {
                        commandName = 'Height to Fill';
                        if (operableNode.parent && operableNode.parent.type === 'FRAME' && operableNode.parent.layoutMode !== 'NONE') {
                            operableNode.layoutSizingVertical = 'FILL';
                            modifiedCount++;
                        }
                        // Removed specific error for Fill Height
                    }
                    else if (figma.command === 'p0') {
                        commandName = 'Set All Padding to 0';
                        if ('paddingTop' in operableNode && 'paddingBottom' in operableNode && 'paddingLeft' in operableNode && 'paddingRight' in operableNode) {
                            // Ensure node is FrameNode or similar that supports padding
                            const paddedNode = operableNode;
                            paddedNode.paddingTop = 0;
                            paddedNode.paddingBottom = 0;
                            paddedNode.paddingLeft = 0;
                            paddedNode.paddingRight = 0;
                            modifiedCount++;
                        }
                        // Removed specific error for padding
                    }
                    else if (figma.command === 'p16') {
                        commandName = 'Set All Padding to 16';
                        if ('paddingTop' in operableNode && 'paddingBottom' in operableNode && 'paddingLeft' in operableNode && 'paddingRight' in operableNode) {
                            // Ensure node is FrameNode or similar that supports padding
                            const paddedNode = operableNode;
                            paddedNode.paddingTop = 16;
                            paddedNode.paddingBottom = 16;
                            paddedNode.paddingLeft = 16;
                            paddedNode.paddingRight = 16;
                            modifiedCount++;
                        }
                        // Removed specific error for padding
                    }
                    else if (figma.command === 'br8') {
                        commandName = 'Set Border Radius to 8px';
                        if ('cornerRadius' in operableNode) {
                            operableNode.cornerRadius = 8;
                            modifiedCount++;
                        }
                        // Removed specific error for border radius
                    }
                    else if (figma.command === 'br0') {
                        commandName = 'Set Border Radius to 0px';
                        if ('cornerRadius' in operableNode) {
                            operableNode.cornerRadius = 0;
                            modifiedCount++;
                        }
                        // Removed specific error for border radius
                    }
                }
                // Removed specific error for unsupported layer types for layout operations
            }
            catch (e) {
                figma.notify(`Error applying to "${node.name}": ${e.message}`, { error: true, timeout: 3000 });
            }
        }
        if (modifiedCount > 0 && commandName) {
            const plural = modifiedCount === 1 ? '' : 's';
            figma.notify(`Applied "${commandName}" to ${modifiedCount} layer${plural}.`);
        }
        else if (S > 0 && commandName !== '') {
            figma.notify(`No applicable layers found for "${commandName}".`, { timeout: 3000 });
        }
        figma.closePlugin();
    }
    else if (figma.command !== 'aa') { // Catch-all for safety, though above conditions should handle it.
        figma.closePlugin();
    }
}
