export {};

declare global {
  type NotesStyle = { stops: string[]; accent: string; opacity: number; radius: number; gloss: boolean; shadow: boolean; title?: string };
  type WidgetStyle = { mode: 'betterfy' } | ({ mode: 'notes' } & NotesStyle);
  type WidgetPrefs = { enabled: boolean; size: 'small' | 'medium' | 'large'; x?: number; y?: number; style?: WidgetStyle };

  interface Window {
    aura: {
      platform: string;
      login(clientId: string): Promise<boolean>;
      cancelLogin(): Promise<void>;
      getToken(force?: boolean): Promise<string | null>;
      logout(): Promise<boolean>;
      getConfig(): Promise<{ clientId: string; redirectUri: string; loggedIn: boolean; prefs: Record<string, unknown> }>;
      savePrefs(prefs: Record<string, unknown>): Promise<boolean>;
      openExternal(url: string): Promise<void>;
      showMain(): Promise<void>;
      getWidget(): Promise<WidgetPrefs>;
      setWidget(patch: Partial<WidgetPrefs>): Promise<WidgetPrefs>;
      notesStyles(): Promise<NotesStyle[]>;
      sendPlayerState(s: unknown): void;
      sendCommand(cmd: string, arg?: unknown): void;
      on(channel: 'widget:changed' | 'prefs:changed' | 'player:state' | 'player:command', cb: (payload: any) => void): () => void;
    };
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}
