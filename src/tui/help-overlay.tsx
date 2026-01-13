import { Box, Text } from "ink";
import type React from "react";

interface HelpOverlayProps {
  width: number;
  height: number;
}

export function HelpOverlay({
  width,
  height,
}: HelpOverlayProps): React.ReactElement {
  const overlayWidth = Math.min(70, width - 4);
  const overlayHeight = Math.min(18, height - 4);

  return (
    <Box
      alignItems="center"
      flexDirection="column"
      height={height}
      justifyContent="center"
      width={width}
    >
      <Box
        borderColor="cyan"
        borderStyle="double"
        flexDirection="column"
        height={overlayHeight}
        paddingX={2}
        paddingY={1}
        width={overlayWidth}
      >
        <Box justifyContent="center" marginBottom={1}>
          <Text bold color="cyan">
            ⌨️ Keybindings
          </Text>
        </Box>

        <Box flexDirection="row" justifyContent="space-between">
          {/* Navigation column */}
          <Box flexDirection="column" width="33%">
            <Text bold color="yellow">
              Navigation
            </Text>
            <Text>
              <Text color="cyan">h/l</Text> left/right
            </Text>
            <Text>
              <Text color="cyan">j/k</Text> down/up
            </Text>
            <Text>
              <Text color="cyan">gg</Text> first item
            </Text>
            <Text>
              <Text color="cyan">G</Text> last item
            </Text>
            <Text>
              <Text color="cyan">←→↑↓</Text> arrows
            </Text>
          </Box>

          {/* Actions column */}
          <Box flexDirection="column" width="33%">
            <Text bold color="yellow">
              Actions
            </Text>
            <Text>
              <Text color="cyan">Enter/o</Text> open
            </Text>
            <Text>
              <Text color="cyan">Esc/q</Text> back
            </Text>
            <Text>
              <Text color="cyan">:q</Text> quit
            </Text>
            <Text>
              <Text color="cyan">?</Text> help
            </Text>
          </Box>

          {/* Search column */}
          <Box flexDirection="column" width="33%">
            <Text bold color="yellow">
              Search
            </Text>
            <Text>
              <Text color="cyan">/</Text> start search
            </Text>
            <Text>
              <Text color="cyan">n/N</Text> next/prev
            </Text>
            <Text>
              <Text color="cyan">Enter</Text> select
            </Text>
            <Text>
              <Text color="cyan">Esc</Text> cancel
            </Text>
          </Box>
        </Box>

        <Box justifyContent="center" marginTop={1}>
          <Text color="gray">[Esc] close</Text>
        </Box>
      </Box>
    </Box>
  );
}
