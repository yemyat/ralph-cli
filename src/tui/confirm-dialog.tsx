import { Box, Text } from "ink";
import type React from "react";

export type DialogType = "confirm-stop" | "force-kill";

interface ConfirmDialogProps {
  type: DialogType;
  taskName: string;
  visible: boolean;
}

export function ConfirmDialog({
  type,
  taskName,
  visible,
}: ConfirmDialogProps): React.ReactElement | null {
  if (!visible) {
    return null;
  }

  if (type === "confirm-stop") {
    return (
      <Box
        borderColor="yellow"
        borderStyle="round"
        flexDirection="column"
        paddingX={2}
        paddingY={1}
      >
        <Text bold>Stop &quot;{taskName}&quot;?</Text>
        <Box marginTop={1}>
          <Text color="gray">[y] Yes [n] No</Text>
        </Box>
      </Box>
    );
  }

  // force-kill dialog
  return (
    <Box
      borderColor="red"
      borderStyle="round"
      flexDirection="column"
      paddingX={2}
      paddingY={1}
    >
      <Text bold color="red">
        ⚠️ Process not responding
      </Text>
      <Box marginTop={1}>
        <Text>&quot;{taskName}&quot; did not stop gracefully.</Text>
      </Box>
      <Box marginTop={1}>
        <Text>Force kill? This may leave incomplete changes.</Text>
      </Box>
      <Box marginTop={1}>
        <Text color="gray">[y] Force Kill [n] Keep Waiting</Text>
      </Box>
    </Box>
  );
}
