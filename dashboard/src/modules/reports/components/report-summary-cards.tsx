import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { Card, CardGrid, Heading, Text } from "@/components/ui";
import type { ReportSummary } from "@/lib/api";

type ReportSummaryCardsProps = {
  summary: ReportSummary;
};

export function ReportSummaryCards({ summary }: ReportSummaryCardsProps) {
  const { _ } = useLingui();

  return (
    <CardGrid>
      <Card>
        <Card.Content>
          <Text variant="caption">{_(msg`Total Punches`)}</Text>
          <Heading level="h3">
            {(summary.total_punches ?? 0).toLocaleString()}
          </Heading>
        </Card.Content>
      </Card>
      <Card>
        <Card.Content>
          <Text variant="caption">{_(msg`Unique Users`)}</Text>
          <Heading level="h3">
            {(summary.unique_users ?? 0).toLocaleString()}
          </Heading>
        </Card.Content>
      </Card>
      <Card>
        <Card.Content>
          <Text variant="caption">{_(msg`Date Range`)}</Text>
          <Text variant="body">
            {new Date(summary.date_from * 1000).toLocaleDateString()} –{" "}
            {new Date(summary.date_to * 1000).toLocaleDateString()}
          </Text>
        </Card.Content>
      </Card>
    </CardGrid>
  );
}
