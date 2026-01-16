import type React from "react";

interface HelpOverlayProps {
  width: number;
  height: number;
}

export function HelpOverlay({
  width,
  height,
}: HelpOverlayProps): React.ReactNode {
  const overlayWidth = Math.min(70, width - 4);
  const overlayHeight = Math.min(18, height - 4);

  return (
    <box
      alignItems="center"
      flexDirection="column"
      height={height}
      justifyContent="center"
      width={width}
    >
      <box
        border
        borderColor="#00FFFF"
        borderStyle="double"
        flexDirection="column"
        height={overlayHeight}
        paddingBottom={1}
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        width={overlayWidth}
      >
        <box justifyContent="center" marginBottom={1}>
          <text fg="#00FFFF">
            <strong>⌨️ Keybindings</strong>
          </text>
        </box>

        <box flexDirection="row" justifyContent="space-between">
          {/* Navigation column */}
          <box flexDirection="column" width="33%">
            <text fg="#FFFF00">
              <strong>Navigation</strong>
            </text>
            <text>
              <span fg="#00FFFF">h/l</span> left/right
            </text>
            <text>
              <span fg="#00FFFF">j/k</span> down/up
            </text>
            <text>
              <span fg="#00FFFF">gg</span> first item
            </text>
            <text>
              <span fg="#00FFFF">G</span> last item
            </text>
            <text>
              <span fg="#00FFFF">←→↑↓</span> arrows
            </text>
          </box>

          {/* Actions column */}
          <box flexDirection="column" width="33%">
            <text fg="#FFFF00">
              <strong>Actions</strong>
            </text>
            <text>
              <span fg="#00FFFF">Enter/o</span> open
            </text>
            <text>
              <span fg="#00FFFF">Esc/q</span> back
            </text>
            <text>
              <span fg="#00FFFF">:q</span> quit
            </text>
            <text>
              <span fg="#00FFFF">?</span> help
            </text>
          </box>

          {/* Search column */}
          <box flexDirection="column" width="33%">
            <text fg="#FFFF00">
              <strong>Search</strong>
            </text>
            <text>
              <span fg="#00FFFF">/</span> start search
            </text>
            <text>
              <span fg="#00FFFF">n/N</span> next/prev
            </text>
            <text>
              <span fg="#00FFFF">Enter</span> select
            </text>
            <text>
              <span fg="#00FFFF">Esc</span> cancel
            </text>
          </box>
        </box>

        <box justifyContent="center" marginTop={1}>
          <text fg="#808080">[Esc] close</text>
        </box>
      </box>
    </box>
  );
}
