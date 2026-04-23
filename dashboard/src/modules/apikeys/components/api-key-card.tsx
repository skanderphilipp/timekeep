import { useCallback } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { Badge, Button, Card, Text, ActionGroup } from "@/components/ui";
import type { ApiKey } from "@/lib/api";

type ApiKeyCardProps = {
  key_: ApiKey;
  onRevoke: (id: string, name: string) => void;
};

export function ApiKeyCard({ key_, onRevoke }: ApiKeyCardProps) {
  const { _ } = useLingui();

  const handleRevoke = useCallback(() => {
    onRevoke(key_.id, key_.name);
  }, [key_.id, key_.name, onRevoke]);

  return (
    <Card>
      <Card.Content>
        <Text variant="body">{key_.name}</Text>
        <Text variant="caption">{key_.prefix}…</Text>
        <ActionGroup>
          {key_.permissions.map((p) => (
            <Badge key={p} variant="neutral">
              {p}
            </Badge>
          ))}
        </ActionGroup>
        <ActionGroup>
          <Badge variant={key_.revoked ? "danger" : "success"}>
            {key_.revoked ? _(msg`Revoked`) : _(msg`Active`)}
          </Badge>
          {key_.last_used_at && (
            <Text variant="caption">
              {_(msg`Last used`)}: {new Date(key_.last_used_at * 1000).toLocaleDateString()}
            </Text>
          )}
          {key_.expires_at && (
            <Text variant="caption">
              {_(msg`Expires`)}: {new Date(key_.expires_at * 1000).toLocaleDateString()}
            </Text>
          )}
          {!key_.revoked && (
            <Button variant="secondary" size="sm" onClick={handleRevoke}>
              {_(msg`Revoke`)}
            </Button>
          )}
        </ActionGroup>
      </Card.Content>
    </Card>
  );
}
