import type { Meta, StoryObj } from "@storybook/react";
import { AvatarGroup } from "./avatar-group";
import { Avatar } from "../avatar";

const meta: Meta<typeof AvatarGroup> = {
  title: "UI/Data Display/AvatarGroup",
  component: AvatarGroup,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof AvatarGroup>;

export const Primary: Story = {
  render: () => (
    <AvatarGroup
      avatars={[
        <Avatar key="1" name="Ahmed Al-Sabah" />,
        <Avatar key="2" name="Fatima Hassan" />,
        <Avatar key="3" name="Omar Khalid" />,
      ]}
    />
  ),
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--ao-spacing-6)",
        padding: "var(--ao-spacing-4)",
      }}
    >
      <div>
        <span
          style={{
            fontSize: 12,
            color: "var(--ao-font-color-tertiary)",
            display: "block",
            marginBottom: 8,
          }}
        >
          1 avatar
        </span>
        <AvatarGroup avatars={[<Avatar key="1" name="Ahmed Al-Sabah" />]} />
      </div>
      <div>
        <span
          style={{
            fontSize: 12,
            color: "var(--ao-font-color-tertiary)",
            display: "block",
            marginBottom: 8,
          }}
        >
          2 avatars
        </span>
        <AvatarGroup
          avatars={[
            <Avatar key="1" name="Ahmed Al-Sabah" />,
            <Avatar key="2" name="Fatima Hassan" />,
          ]}
        />
      </div>
      <div>
        <span
          style={{
            fontSize: 12,
            color: "var(--ao-font-color-tertiary)",
            display: "block",
            marginBottom: 8,
          }}
        >
          4 avatars (max visible)
        </span>
        <AvatarGroup
          avatars={[
            <Avatar key="1" name="Ahmed Al-Sabah" />,
            <Avatar key="2" name="Fatima Hassan" />,
            <Avatar key="3" name="Omar Khalid" />,
            <Avatar key="4" name="Layla Noor" />,
          ]}
        />
      </div>
    </div>
  ),
};

export const ContextCheckedInEmployees: Story = {
  name: "Context: Checked-In Employees",
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        padding: "var(--ao-spacing-4)",
        display: "flex",
        alignItems: "center",
        gap: "var(--ao-spacing-3)",
      }}
    >
      <AvatarGroup
        avatars={[
          <Avatar key="1" name="Ahmed Al-Sabah" />,
          <Avatar key="2" name="Fatima Hassan" />,
          <Avatar key="3" name="Omar Khalid" />,
          <Avatar key="4" name="Layla Noor" />,
        ]}
      />
      <span style={{ fontSize: 14, color: "var(--ao-font-color-secondary)" }}>
        +38 more on-site
      </span>
    </div>
  ),
};
