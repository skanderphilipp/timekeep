import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconPlus } from "@tabler/icons-react";

import { EmptyState, Button } from "@/components/ui";

type EndpointListEmptyProps = {
  onAddEndpoint: () => void;
};

export function EndpointListEmpty({ onAddEndpoint }: EndpointListEmptyProps) {
  const { _ } = useLingui();

  return (
    <EmptyState
      title={_(msg`No endpoints`)}
      description={_(msg`Add an endpoint to start sending attendance events.`)}
      action={
        <Button icon={<IconPlus size={16} />} onClick={onAddEndpoint}>
          {_(msg`Add Endpoint`)}
        </Button>
      }
    />
  );
}
