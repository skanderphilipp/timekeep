import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconShieldLock } from "@tabler/icons-react";

import { AppRoute } from "@/lib/navigation";
import { useZodForm } from "@/lib/form";
import { authTokenAtom, currentUserAtom } from "@/infrastructure/state";
import { fetchSetupStatus, performSetup, setAuthToken } from "@/lib/api";
import {
  Card,
  Heading,
  Text,
  Separator,
  Button,
  Form,
  FormActions,
  SchemaForm,
  Banner,
} from "@/components/ui";
import {
  createSetupFormSchema,
  createSetupFormDef,
  type SetupFormValues,
} from "../schemas/setup-form.schema";
import styles from "./login-page.module.scss";

/**
 * First-run setup page — shown when no admin user exists.
 *
 * Creates the initial admin account and auto-logs in.
 * After setup, this endpoint returns 409 (users already exist).
 */
export function SetupPage() {
  const { _ } = useLingui();
  const navigate = useNavigate();
  const setToken = useSetAtom(authTokenAtom);
  const setCurrentUser = useSetAtom(currentUserAtom);

  const [checking, setChecking] = useState(true);
  const [needed, setNeeded] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchSetupStatus()
      .then((s) => {
        if (s.setup_needed) {
          setNeeded(true);
        } else {
          navigate(AppRoute.login, { replace: true });
        }
      })
      .catch(() => setSetupError(_(msg`Cannot reach the server. Is it running?`)))
      .finally(() => setChecking(false));
  }, [_, navigate]);

  const form = useZodForm(createSetupFormSchema(_), {
    defaultValues: { username: "", password: "" },
  });
  const formSchema = createSetupFormDef(_);

  const onSubmit = form.handleSubmit(async (data: SetupFormValues) => {
    setSetupError(null);
    setIsSaving(true);
    try {
      const resp = await performSetup({ username: data.username, password: data.password });
      setAuthToken(resp.token);
      setToken(resp.token);
      setCurrentUser({
        username: resp.username,
        role: resp.role as "admin" | "operator" | "viewer",
        permissions: "FULL",
      });
      navigate(AppRoute.dashboard, { replace: true });
    } catch {
      setSetupError(_(msg`Setup failed. The server may already be configured.`));
    } finally {
      setIsSaving(false);
    }
  });

  if (checking) {
    return (
      <section data-slot="login-page" className={styles.page}>
        <main data-slot="login-main" className={styles.main}>
          {/* Spinner handled by parent full-page loading state — empty main for consistency */}
        </main>
      </section>
    );
  }

  if (!needed) return null;

  return (
    <section data-slot="login-page" className={styles.page}>
      <main data-slot="login-main" className={styles.main}>
        <Card>
          <Card.Content className={styles.cardContent}>
            <IconShieldLock size={40} stroke={1.5} />

            <Heading level="h1">
              {_(msg`Welcome to timekeep`)}
            </Heading>
            <Text variant="caption" color="tertiary">
              {_(msg`Create your admin account to get started.`)}
            </Text>

            <Separator noMargin />

            {setupError && (
              <Banner variant="danger" onDismiss={() => setSetupError(null)}>
                {setupError}
              </Banner>
            )}

            <Form onSubmit={onSubmit}>
              <SchemaForm formSchema={formSchema} form={form} />
              <FormActions>
                <Button type="submit" fullWidth loading={isSaving}>
                  {_(msg`Create Admin Account`)}
                </Button>
              </FormActions>
            </Form>
          </Card.Content>
        </Card>
      </main>
    </section>
  );
}
