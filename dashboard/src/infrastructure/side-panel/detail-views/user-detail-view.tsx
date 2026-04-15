import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { Separator } from "@/components/ui/separator";
import { useEntityDetail } from "../hooks/use-entity-detail";

type UserDetailViewProps = {
  userPin: string;
};

/**
 * User detail view — rendered inside the SidePanel when a user PIN
 * is clicked in the attendance table.
 *
 * Displays user enrollment info, recent punches, etc.
 *
 * TODO(ENTERPRISE): Implement user enrollment data display.
 * Phase: User detail view
 * Impact: Shows only the PIN; no enrollment or punch history data.
 * Fix: Add fetchUser(pin) to @/lib/api, display enrollment info and recent punches.
 */
export function UserDetailView({ userPin }: UserDetailViewProps) {
  const { data: _user, isLoading, error } = useEntityDetail("user", userPin);
  const { _ } = useLingui();

  if (isLoading) {
    return (
      <div style={{ padding: "24px" }}>
        <Text variant="body" color="tertiary">
          {_(msg`Loading user details…`)}
        </Text>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "24px" }}>
        <Text variant="body" color="danger">
          {_(msg`Failed to load user details.`)}
        </Text>
      </div>
    );
  }

  return (
    <div style={{ padding: "0" }}>
      <div style={{ padding: "16px 24px" }}>
        <Heading level="h3" color="primary">
          {_(msg`User PIN: ${userPin}`)}
        </Heading>
      </div>

      <Separator />

      <dl style={{ padding: "16px 24px", margin: 0 }}>
        <dt
          style={{
            fontSize: "12px",
            fontWeight: 500,
            color: "var(--color-text-tertiary)",
            marginBottom: "4px",
          }}
        >
          {_(msg`User ID`)}
        </dt>
        <dd style={{ margin: "0 0 16px 0", fontFamily: "monospace" }}>
          {userPin}
        </dd>

        <dt
          style={{
            fontSize: "12px",
            fontWeight: 500,
            color: "var(--color-text-tertiary)",
            marginBottom: "4px",
          }}
        >
          {_(msg`Enrollment`)}
        </dt>
        <dd style={{ margin: "0 0 16px 0" }}>
          <Text variant="body" color="secondary">
            {_(msg`Enrollment details will be available when connected to the Attendance OS server.`)}
          </Text>
        </dd>
      </dl>
    </div>
  );
}
