import { Center, Text } from "@mantine/core";

// The layout (app/admin/layout.tsx) already redirects unauthenticated
// requests to /login, and only renders this page once dashboard access is
// confirmed (see ANA-50) -- no further gating is needed here.
export default function AdminPage() {
  return (
    <Center flex={1} p="xl">
      <Text>hello</Text>
    </Center>
  );
}
