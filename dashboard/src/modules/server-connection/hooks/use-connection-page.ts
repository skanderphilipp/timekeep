import { useState, useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";

import { serverUrlState, setServerUrlAtom, clientConfigState } from "@/infrastructure/state";
import { createApiClient, setApiClient } from "@/lib/api-client";
import { API_BASE, WORKSPACE_NAME } from "@/lib/constants";
import { AppRoute as AppRoutePaths } from "@shared/paths";

type ConnectionStatus = "idle" | "testing" | "success" | "error";

const CONNECTION_TIMEOUT_MS = 10_000;

export function useConnectionPage() {
  const { _ } = useLingui();
  const serverUrl = useAtomValue(serverUrlState);
  const setServerUrl = useSetAtom(setServerUrlAtom);
  const [testUrl, setTestUrl] = useState(serverUrl);
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const isConfigured = Boolean(serverUrl);

  const clientConfig = useAtomValue(clientConfigState.atom);
  const workspace = clientConfig?.workspace_name || WORKSPACE_NAME;

  const handleTest = useCallback(async () => {
    const url = testUrl.trim();
    if (!url) return;

    setStatus("testing");
    setErrorMessage("");

    try {
      const normalized = url.endsWith("/") ? url.slice(0, -1) : url;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), CONNECTION_TIMEOUT_MS);

      const response = await fetch(`${normalized}/api/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) {
        setStatus("success");
      } else {
        setStatus("error");
        setErrorMessage(_(msg`Server returned status ${response.status}`));
      }
    } catch (err) {
      setStatus("error");
      if (err instanceof TypeError) {
        setErrorMessage(
          _(msg`Could not reach server. Check the address and ensure the server is running.`),
        );
      } else if (err instanceof DOMException && err.name === "AbortError") {
        setErrorMessage(_(msg`Connection timed out. Check the address.`));
      } else {
        setErrorMessage(err instanceof Error ? err.message : _(msg`Unknown error`));
      }
    }
  }, [testUrl, _]);

  const handleConnect = useCallback(() => {
    const url = testUrl.trim();
    if (!url) return;

    setServerUrl(url);

    const apiUrl = url.endsWith("/") ? `${url}api` : `${url}/api`;
    setApiClient(createApiClient({ baseUrl: apiUrl }));
  }, [testUrl, setServerUrl]);

  const handleReset = useCallback(() => {
    setServerUrl("");
    setTestUrl("");
    setStatus("idle");
    setErrorMessage("");
    setApiClient(createApiClient({ baseUrl: API_BASE }));
  }, [setServerUrl]);

  return {
    testUrl,
    setTestUrl,
    status,
    errorMessage,
    isConfigured,
    handleTest,
    handleConnect,
    handleReset,
    workspace,
    loginPath: AppRoutePaths.login,
  };
}
