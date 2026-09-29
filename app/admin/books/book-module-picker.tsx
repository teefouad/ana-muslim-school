"use client";

import { Checkbox, Stack, Text } from "@mantine/core";

export interface BookModuleOption {
  id: string;
  label: string;
}

// The module-selection step of the Book description AI dialogs (ANA-133):
// one checkbox per Module of the Book, so the editor picks which Modules'
// content grounds the generated description. Purely controlled -- BookForm
// owns the selection (one per field) and reads it when generating.
export function BookModulePicker({
  modules,
  value,
  onChange,
}: {
  modules: BookModuleOption[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <Checkbox.Group
      label="Modules to use as context (optional)"
      description="Only the selected modules' content is sent to the AI."
      value={value}
      onChange={onChange}
      mb="md"
    >
      <Stack gap="xs" mt="xs">
        {modules.map((module) => (
          <Checkbox key={module.id} value={module.id} label={module.label} />
        ))}
        {modules.length === 0 && (
          <Text size="sm" c="dimmed">
            This book has no modules yet.
          </Text>
        )}
      </Stack>
    </Checkbox.Group>
  );
}
