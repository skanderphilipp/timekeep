import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";

import { Button, Card, Heading, Input, Text } from "@/components/ui";

type ConnectionFormProps = {
  testUrl: string;
  onTestUrlChange: (value: string) => void;
  status: "idle" | "testing" | "success" | "error";
  errorMessage: string;
  onTest: () => void;
  onConnect: () => void;
  connected: boolean;
  onReset: () => void;
  loginPath: string;
};

export function ConnectionForm({
  testUrl,
  onTestUrlChange,
  status,
  errorMessage,
  onTest,
  onConnect,
  connected,
  onReset,
  loginPath,
}: ConnectionFormProps) {
  const { _ } = useLingui();

  if (connected) {
    return (
      <Card>
        <Card.Content>
          <Heading level="h2">{_(msg`Connected`)}</Heading>
          <Text variant="body" color="secondary">
            {_(msg`Your TimeKeep server is configured.`)}
          </Text>
        </Card.Content>
        <Card.Footer>
          <Button to={loginPath} variant="primary">
            {_(msg`Go to Login`)}
          </Button>
          <Button variant="ghost" onClick={onReset}>
            {_(msg`Change Server`)}
          </Button>
        </Card.Footer>
      </Card>
    );
  }

  return (
    <Card>
      <Card.Content>
        <Heading level="h2">{_(msg`Connect to Server`)}</Heading>
        <Text variant="body" color="secondary">
          {_(msg`Enter the address of your TimeKeep server to get started.`)}
        </Text>

        <Input
          label={_(msg`Server Address`)}
          value={testUrl}
          onChange={(e) => onTestUrlChange(e.target.value)}
          placeholder="http://192.168.1.100:3000"
          fullWidth
          onKeyDown={(e) => {
            if (e.key === "Enter") onTest();
          }}
        />

        {status === "error" && (
          <Text variant="caption" color="danger">
            {errorMessage}
          </Text>
        )}

        {status === "success" && (
          <Text variant="caption" color="success">
            {_(msg`Server is reachable!`)}
          </Text>
        )}
      </Card.Content>
      <Card.Footer>
        <Button
          variant="secondary"
          onClick={onTest}
          disabled={!testUrl.trim() || status === "testing"}
          loading={status === "testing"}
        >
          {status === "testing" ? _(msg`Testing...`) : _(msg`Test Connection`)}
        </Button>
        <Button variant="primary" onClick={onConnect} disabled={!testUrl.trim()}>
          {_(msg`Connect`)}
        </Button>
      </Card.Footer>
    </Card>
  );
}
