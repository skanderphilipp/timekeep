import { Card, Grid, Section, Skeleton } from "@/components/ui";

/** Card-shaped loading skeleton — matches metric card dimensions. */
export function DashboardSkeleton() {
  return (
    <>
      <Section>
        <Grid>
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <Card.Content>
                <Skeleton variant="rect" width="100%" height={96} />
              </Card.Content>
            </Card>
          ))}
        </Grid>
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
