import { clsx } from "clsx";
import { useId, useCallback } from "react";
import { useIMask } from "react-imask";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { clampPort } from "@/components/ui/port-input";
import { DEFAULT_ZKTECO_PORT } from "@/lib/constants";
import styles from "./ip-port-input.module.scss";

/** Regex to parse "ip:port" or "ip port" strings. */
const IP_PORT_REGEX =
  /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)[:\s](\d{1,5})$/;

const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/;

type IpPortValue = {
  ip: string;
  port: number;
};

type IpPortInputProps = {
  label?: string;
  error?: string;
  helperText?: string;
  value?: IpPortValue;
  defaultValue?: Partial<IpPortValue>;
  onChange?: (value: IpPortValue) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  fullWidth?: boolean;
  className?: string;
  id?: string;
};

/**
 * Composite IP:Port input.
 *
 * Renders as `[IP input] : [Port input]` with a visible colon separator.
 * Supports paste of "ip:port" format into either field — the composite
 * parses and distributes the values. Use this instead of separate
 * `IpInput` + `PortInput` when IP and port are always collected together.
 */
export function IpPortInput({
  label,
  error,
  helperText,
  value,
  defaultValue,
  onChange,
  placeholder: _placeholder,
  disabled = false,
  required = false,
  fullWidth = false,
  className,
  id: externalId,
}: IpPortInputProps) {
  const { _ } = useLingui();
  const autoId = useId();
  const inputId = externalId || autoId;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;

  const currentIp = value?.ip ?? defaultValue?.ip ?? "";
  const currentPort = value?.port ?? defaultValue?.port ?? DEFAULT_ZKTECO_PORT;

  // IMask for the IP part
  const { ref: ipInnerRef } = useIMask(
    {
      mask: "0[0][0].0[0][0].0[0][0].0[0][0]",
      definitions: { "0": /[0-9]/ },
    },
    {
      onAccept: (_val, mask) => {
        const raw = mask.unmaskedValue;
        const newIp = IPV4_REGEX.test(raw) ? raw : currentIp;
        onChange?.({ ip: newIp, port: currentPort });
      },
    },
  );

  // When pasting into the IP field, check for "ip:port" combos
  const handleIpPaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const pasted = e.clipboardData.getData("text").trim();
      const match = pasted.match(IP_PORT_REGEX);
      if (match) {
        e.preventDefault();
        const fullMatch = match[0];
        const ipPart = fullMatch.split(/[:\s]/)[0];
        const portStr = match[1];
        const port = clampPort(Number.parseInt(portStr, 10));
        onChange?.({ ip: ipPart, port });
      }
    },
    [onChange],
  );

  // Handle port changes
  const handlePortChange = useCallback(
    (port: number) => {
      onChange?.({ ip: currentIp, port: clampPort(port) });
    },
    [currentIp, onChange],
  );

  // Handle port blur — clamp and notify
  const handlePortBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      const cleaned = e.target.value.replace(/\D/g, "");
      const num = Number.parseInt(cleaned, 10);
      if (!Number.isNaN(num)) {
        const clamped = clampPort(num);
        onChange?.({ ip: currentIp, port: clamped });
      }
    },
    [currentIp, onChange],
  );

  // Handle port change via raw input
  const handlePortRawChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const cleaned = e.target.value.replace(/\D/g, "");
      const num = Number.parseInt(cleaned, 10);
      if (!Number.isNaN(num) && num >= 0) {
        handlePortChange(num);
      }
    },
    [handlePortChange],
  );

  return (
    <div
      data-slot="ip-port-input"
      className={clsx(styles.container, fullWidth && styles.fullWidth, className)}
    >
      {label && (
        <label data-slot="ip-port-input-label" className={styles.label} htmlFor={inputId}>
          {label}
          {required && (
            <span data-slot="ip-port-input-required" className={styles.required}>
              *
            </span>
          )}
        </label>
      )}

      <div data-slot="ip-port-input-row" className={styles.row}>
        <input
          ref={(node) => {
            (ipInnerRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
          }}
          id={inputId}
          data-slot="ip-port-input-ip"
          className={clsx(styles.ipInput, error && styles.ipInputError)}
          type="text"
          inputMode="decimal"
          placeholder="192.168.1.100"
          disabled={disabled}
          required={required}
          aria-label={_(msg`IP address`)}
          aria-invalid={!!error}
          onPaste={handleIpPaste}
        />

        <span data-slot="ip-port-input-separator" className={styles.separator} aria-hidden="true">
          :
        </span>

        <input
          data-slot="ip-port-input-port"
          className={clsx(styles.portInput, error && styles.portInputError)}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder={String(DEFAULT_ZKTECO_PORT)}
          disabled={disabled}
          required={required}
          aria-label={_(msg`Port`)}
          aria-invalid={!!error}
          value={currentPort || ""}
          onChange={handlePortRawChange}
          onBlur={handlePortBlur}
        />
      </div>

      {error && (
        <p data-slot="ip-port-input-error" id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      )}
      {!error && helperText && (
        <p data-slot="ip-port-input-helper" id={helperId} className={styles.helper}>
          {helperText}
        </p>
      )}
    </div>
  );
}

/** Parse an "ip:port" string into IpPortValue. Returns null if invalid. */
export function parseIpPort(raw: string): IpPortValue | null {
  const trimmed = raw.trim();
  const match = trimmed.match(IP_PORT_REGEX);
  if (match) {
    const ipPart = match[0].split(/[:\s]/)[0];
    const portPart = match[1];
    const port = clampPort(Number.parseInt(portPart, 10));
    if (IPV4_REGEX.test(ipPart)) {
      return { ip: ipPart, port };
    }
  }
  if (IPV4_REGEX.test(trimmed)) {
    return { ip: trimmed, port: DEFAULT_ZKTECO_PORT };
  }
  return null;
}
