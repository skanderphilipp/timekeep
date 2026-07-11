import { Card, CardGrid, Section, Skeleton } from "@/components/ui";

/** Card-shaped loading skeleton — matches metric card dimensions. */
export function DashboardSkeleton() {
  return (
    <>
      <Section>
        <CardGrid>
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <Card.Content>
                <Skeleton variant="rect" width="100%" height={96} />
              </Card.Content>
            </Card>
          ))}
        </CardGrid>
      </Section>
      <Section>
        <Skeleton variant="rect" width="100%" height={200} />
      </Section>
      <Section>
        <Skeleton variant="rect" width="100%" height={200} />
      </Section>
    </>
  );
}
