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
}: ConfirmDialogProps): React.ReactNode {
  if (!visible) {
    return null;
  }

  if (type === "confirm-stop") {
    return (
      <box
        border
        borderColor="#FFFF00"
        borderStyle="single"
        flexDirection="column"
        paddingBottom={1}
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
      >
        <text>
          <strong>Stop &quot;{taskName}&quot;?</strong>
        </text>
        <box marginTop={1}>
          <text fg="#808080">[y] Yes [n] No</text>
        </box>
      </box>
    );
  }

  // force-kill dialog
  return (
    <box
      border
      borderColor="#FF0000"
      borderStyle="single"
      flexDirection="column"
      paddingBottom={1}
      paddingLeft={2}
      paddingRight={2}
      paddingTop={1}
    >
      <text fg="#FF0000">
        <strong>⚠️ Process not responding</strong>
      </text>
      <box marginTop={1}>
        <text>&quot;{taskName}&quot; did not stop gracefully.</text>
      </box>
      <box marginTop={1}>
        <text>Force kill? This may leave incomplete changes.</text>
      </box>
      <box marginTop={1}>
        <text fg="#808080">[y] Force Kill [n] Keep Waiting</text>
      </box>
    </box>
  );
}
