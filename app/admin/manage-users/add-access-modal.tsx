"use client";

import { Button, Modal } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";

import { PermissionForm } from "./permission-form";

export function AddAccessModal() {
  const [opened, { open, close }] = useDisclosure(false);

  return (
    <>
      <Button onClick={open}>Add an email address</Button>

      <Modal opened={opened} onClose={close} title="Grant or update access">
        <PermissionForm onSuccess={close} />
      </Modal>
    </>
  );
}
