I have completed the requested changes to the orchestrator editor.

### Summary of Changes

1.  **Node Interaction & Settings Drawer**
    -   Added a slide-out settings drawer on the right side of the screen.
    -   Made all nodes in the canvas clickable. Clicking a node now opens the drawer with its specific settings.

2.  **New "Knowledge Base Retrieval" Node**
    -   Added a "Knowledge Base Retrieval" (检索知识库) node to the simulated flow, placed after the Input node.
    -   Updated the connector lines to visually integrate the new node.

3.  **Knowledge Base Settings**
    -   Implemented the settings form for the Knowledge Base node with the requested features:
        -   **Retrieval Scope**: A dropdown to choose between "All Knowledge Base", "Specific Documents", etc.
        -   **Field Filtering**: Checkboxes to filter by "Title", "Content", and "Tags".
        -   **Additional Parameters**: Added controls for "Max Recall Count" and "Similarity Threshold".

### Verification
-   The local server is running at `http://localhost:8000/`.
-   You can navigate to the Orchestrator Editor view to see the new node and interact with it.

Let me know if you need any adjustments to the UI or additional settings fields!