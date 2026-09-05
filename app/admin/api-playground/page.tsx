import { Stack, Title } from "@mantine/core";

import { ApiPlayground } from "./api-playground";

export default function ApiPlaygroundPage() {
  return (
    <Stack gap="xl" p="xl">
      <Title order={2}>API Playground</Title>
      <ApiPlayground />
    </Stack>
  );
}
