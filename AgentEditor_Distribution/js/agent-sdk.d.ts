
/**
 * Agent SDK Configuration Options
 */
interface AgentSDKConfig {
    /** Unique Identifier for the Agent */
    agentId: string;
    /** Display Name of the Agent */
    name?: string;
    /** Avatar Icon Class (FontAwesome) or URL */
    avatar?: string;
    /** Initial Welcome Message */
    welcomeMsg?: string;
    /** Primary Theme Color (Hex) */
    primaryColor?: string;
    /** Initial Position */
    position?: {
        bottom?: string;
        right?: string;
        left?: string;
        top?: string;
    };
    /** Z-Index for the widget */
    zIndex?: number;
}

/**
 * Agent SDK Instance
 */
declare class AgentSDK {
    constructor(config: AgentSDKConfig);

    /**
     * Initialize the widget and render to DOM
     */
    init(): void;

    /**
     * Manually open the chat window
     */
    toggleChat(forceState?: boolean): void;

    /**
     * Hide the widget permanently (persisted)
     */
    close(): void;

    /**
     * Show the widget (clears persisted close state)
     */
    show(): void;
}

declare global {
    interface Window {
        AgentSDK: typeof AgentSDK;
        agentSDK: AgentSDK;
    }
}
