import type React from "react";
import { TOKYO_NIGHT } from "./lib/constants";

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
        borderColor={TOKYO_NIGHT.cyan}
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
          <text fg={TOKYO_NIGHT.cyan}>
            <strong>Keybindings</strong>
          </text>
        </box>

        <box flexDirection="row" justifyContent="space-between">
          {/* Navigation column */}
          <box flexDirection="column" width="33%">
            <text fg={TOKYO_NIGHT.yellow}>
              <strong>Navigation</strong>
            </text>
            <text>
              <span fg={TOKYO_NIGHT.cyan}>h/l</span> left/right
            </text>
            <text>
              <span fg={TOKYO_NIGHT.cyan}>j/k</span> down/up
            </text>
            <text>
              <span fg={TOKYO_NIGHT.cyan}>gg</span> first item
            </text>
            <text>
              <span fg={TOKYO_NIGHT.cyan}>G</span> last item
            </text>
            <text>
              <span fg={TOKYO_NIGHT.cyan}>arrows</span> navigate
            </text>
          </box>

          {/* Actions column */}
          <box flexDirection="column" width="33%">
            <text fg={TOKYO_NIGHT.yellow}>
              <strong>Actions</strong>
            </text>
            <text>
              <span fg={TOKYO_NIGHT.cyan}>Enter/o</span> open
            </text>
            <text>
              <span fg={TOKYO_NIGHT.cyan}>Esc/q</span> back
            </text>
            <text>
              <span fg={TOKYO_NIGHT.cyan}>:q</span> quit
            </text>
            <text>
              <span fg={TOKYO_NIGHT.cyan}>?</span> help
            </text>
          </box>

          {/* Search column */}
          <box flexDirection="column" width="33%">
            <text fg={TOKYO_NIGHT.yellow}>
              <strong>Search</strong>
            </text>
            <text>
              <span fg={TOKYO_NIGHT.cyan}>/</span> start search
            </text>
            <text>
              <span fg={TOKYO_NIGHT.cyan}>n/N</span> next/prev
            </text>
            <text>
              <span fg={TOKYO_NIGHT.cyan}>Enter</span> select
            </text>
            <text>
              <span fg={TOKYO_NIGHT.cyan}>Esc</span> cancel
            </text>
          </box>
        </box>

        <box justifyContent="center" marginTop={1}>
          <text fg={TOKYO_NIGHT.comment}>[Esc] close</text>
        </box>
      </box>
    </box>
  );
}
