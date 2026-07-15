import type { WritableAtom, Atom } from "jotai";

/**
 * A writable Jotai state with metadata for debugging and tooling.
 *
 * Created via {@link createState}.
 */
export type State<ValueType> = {
  readonly type: "State";
  readonly key: string;
  readonly atom: WritableAtom<
    ValueType,
    [ValueType | ((prev: ValueType) => ValueType)],
    void
  >;
};

/**
 * A read-only derived Jotai selector with metadata for debugging and tooling.
 *
 * Created via {@link createSelector}.
 */
export type Selector<ValueType> = {
  readonly type: "Selector";
  readonly key: string;
  readonly atom: Atom<ValueType>;
};

/**
 * A parameterized family of writable Jotai atoms.
 *
 * Created via {@link createFamilyState}.
 */
export type FamilyState<ValueType, FamilyKey> = {
  readonly type: "FamilyState";
  readonly key: string;
  readonly atomFamily: (familyKey: FamilyKey) => WritableAtom<
    ValueType,
    [ValueType | ((prev: ValueType) => ValueType)],
    void
  >;
} & ((familyKey: FamilyKey) => WritableAtom<
  ValueType,
  [ValueType | ((prev: ValueType) => ValueType)],
  void
>);

/**
 * A parameterized family of read-only derived Jotai selectors.
 *
 * Created via {@link createFamilySelector}.
 */
export type FamilySelector<ValueType, FamilyKey> = {
  readonly type: "FamilySelector";
  readonly key: string;
  readonly atomFamily: (familyKey: FamilyKey) => Atom<ValueType>;
};

/**
 * Per-component-instance state. Atoms are created per `instanceId` and
 * cleaned up when the component unmounts.
 *
 * Created via {@link createComponentState}.
 */
export type ComponentState<ValueType> = {
  readonly type: "ComponentState";
  readonly key: string;
  readonly atomFamily: (instanceId: string) => WritableAtom<
    ValueType,
    [ValueType | ((prev: ValueType) => ValueType)],
    void
  >;
};

/**
 * Helper type for the `get` callback in selectors.
 * Provides typed access to atoms and family states.
 */
export type SelectorGetter = {
  /** Read the current value of a {@link State} or {@link Selector}. */
  <T>(state: State<T> | Selector<T>): T;
  /** Read the current value of a {@link FamilyState} or {@link FamilySelector} for a given key. */
  <T, K>(family: FamilyState<T, K> | FamilySelector<T, K>, familyKey: K): T;
};
