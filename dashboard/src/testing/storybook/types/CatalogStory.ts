import type { StoryObj } from "@storybook/react";

/**
 * Configuration for one dimension (axis) of a catalog story.
 *
 * Each dimension generates `values.length` variants of the component,
 * producing a grid of all dimension combinations.
 */
export type CatalogDimension<Props> = {
  /** Human-readable label for the dimension column. */
  name: string;
  /** Values to iterate over. */
  values: unknown[];
  /** Maps a value to the props that enable that state. */
  props: (value: unknown) => Partial<Props>;
};

/**
 * Story parameters required by CatalogDecorator.
 */
export type CatalogParameters<Props> = {
  catalog: {
    dimensions: CatalogDimension<Props>[];
  };
};

/**
 * Story type for catalog (variant matrix) stories.
 *
 * @example
 *   export const Catalog: CatalogStory<StoryObj<typeof Button>, typeof Button> = {
 *     parameters: {
 *       catalog: {
 *         dimensions: [
 *           { name: 'variant', values: ['primary', 'secondary'], props: (v) => ({ variant: v as any }) },
 *         ],
 *       },
 *     },
 *   };
 */
export type CatalogStory<TStory extends StoryObj, TComponent> = TStory & {
  parameters: TStory["parameters"] & CatalogParameters<TComponent>;
};
