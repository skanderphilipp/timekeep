import { atom, type WritableAtom } from "jotai";
import { atomWithStorage, createJSONStorage } from "jotai/utils";
import type { State } from "../types";

/**
 * Options for {@link createState}.
 */
export type CreateStateOptions<ValueType> = {
  /** Persist the state to localStorage. */
  localStorage?: boolean;
  /** Persist the state to sessionStorage. */
  sessionStorage?: boolean;
  /**
   * Validate persisted values on hydration.
   * If the stored value fails validation, the atom falls back to `defaultValue`.
   *
   * Prevents corrupted localStorage from silently breaking the atom.
   */
  validateInit?: (value: NonNullable<ValueType>) => boolean;
};

type StateAtom<ValueType> = WritableAtom<
  ValueType,
  [ValueType | ((prev: ValueType) => ValueType)],
  void
>;

/**
 * Creates a validated localStorage wrapper that rejects invalid persisted values.
 *
 * When `validateInit` is provided and the stored value fails validation,
 * the atom falls back to `defaultValue` instead of hydrating with corrupt data.
 */
function createValidatedStorage<ValueType>(
  validateInit: (value: NonNullable<ValueType>) => boolean,
) {
  const storage = createJSONStorage<ValueType>(() => localStorage);

  return {
    ...storage,
    getItem: (key: string, initialValue: ValueType): ValueType => {
      const value = storage.getItem(key, initialValue) as ValueType;

      if (value != null && !validateInit(value as NonNullable<ValueType>)) {
        return initialValue;
      }

      return value;
    },
  };
}

/**
 * Creates a typed, keyed, debuggable Jotai state.
 *
 * The returned `State<T>` object carries metadata (`type`, `key`) alongside
 * the underlying Jotai atom. This enables:
 * - Devtools inspection (all atoms have `debugLabel`)
 * - Typed consumption via {@link useStateValue} / {@link useState}
 * - Optional localStorage/sessionStorage persistence
 * - Optional hydration validation
 *
 * @example
 * ```ts
 * export const themeState = createState<Theme>({
 *   key: "theme",
 *   defaultValue: "light",
 *   localStorage: true,
 * });
 * ```
 */
export function createState<ValueType>({
  key,
  defaultValue,
  localStorage: useLocalStorage = false,
  sessionStorage: useSessionStorage = false,
  validateInit,
}: {
  key: string;
  defaultValue: ValueType;
} & CreateStateOptions<ValueType>): State<ValueType> {
  let baseAtom: StateAtom<ValueType>;

  if (useSessionStorage) {
    const storage = createJSONStorage<ValueType>(() => sessionStorage);
    baseAtom = atomWithStorage<ValueType>(key, defaultValue, storage, {
      getOnInit: true,
    }) as StateAtom<ValueType>;
  } else if (useLocalStorage) {
    const storage = validateInit
      ? createValidatedStorage<ValueType>(validateInit)
      : undefined;
    baseAtom = atomWithStorage<ValueType>(
      key,
      defaultValue,
      storage,
    ) as StateAtom<ValueType>;
  } else {
    baseAtom = atom(defaultValue);
  }

  baseAtom.debugLabel = key;

  return {
    type: "State" as const,
    key,
    atom: baseAtom,
  };
}
