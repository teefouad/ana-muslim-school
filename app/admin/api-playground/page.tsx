import { Divider, Stack, Title } from "@mantine/core";

import { ApiPlayground } from "./api-playground";

export default function ApiPlaygroundPage() {
  return (
    <Stack gap="xl" p="xl">
      <Title order={2}>API Playground</Title>
      <Divider opacity={0.25} mx={-27} />
      <ApiPlayground />
    </Stack>
  );
}
