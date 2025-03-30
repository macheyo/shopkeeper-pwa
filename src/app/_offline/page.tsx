import React from "react";
import { Container, Title, Text, Paper } from "@mantine/core";
import { IconWifiOff } from "@tabler/icons-react";

export default function OfflinePage() {
  return (
    <Container size="sm" mt={100}>
      <Paper
        withBorder
        shadow="md"
        p="lg"
        radius="md"
        style={{ textAlign: "center" }}
      >
        <IconWifiOff
          size={64}
          stroke={1.5}
          style={{ marginBottom: "1rem", color: "gray" }}
        />
        <Title order={2} mb="sm">
          You are offline
        </Title>
        <Text color="dimmed">
          It seems you&apos;ve lost your internet connection. Please check your
          connection and try again.
        </Text>
        <Text mt="md" size="sm" color="dimmed">
          Some features might be limited, but you can still manage products and
          record sales offline.
        </Text>
      </Paper>
    </Container>
  );
}
