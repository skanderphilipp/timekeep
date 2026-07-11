import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { AppRoute } from "@/lib/navigation";
import { useZodForm } from "@/lib/form";
import { authTokenAtom, currentUserAtom } from "@/infrastructure/state";
import { login, setAuthToken } from "@/lib/api";
import {
  Card,
  Heading,
  Text,
  Separator,
  Button,
  Form,
  FormActions,
  Banner,
  SchemaForm,
} from "@/components/ui";
import {
  createLoginFormSchema,
  createLoginFormDef,
  type LoginFormValues,
} from "../schemas/login-form.schema";
import styles from "./login-form.module.scss";

export function LoginForm() {
  const { _ } = useLingui();
  const navigate = useNavigate();
  const setToken = useSetAtom(authTokenAtom);
  const setCurrentUser = useSetAtom(currentUserAtom);

  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useZodForm(createLoginFormSchema(_), {
    defaultValues: { username: "", password: "" },
  });
  const formSchema = createLoginFormDef(_);

  const onSubmit = form.handleSubmit(async (data: LoginFormValues) => {
    setLoginError(null);
    setIsSubmitting(true);
    try {
      const response = await login(data);
      setAuthToken(response.token);
      setToken(response.token);
      setCurrentUser({
        username: response.username,
        role: response.role,
        permissions: response.permissions,
      });
      navigate(AppRoute.dashboard, { replace: true });
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <Card className={styles.card}>
      <Card.Content className={styles.content}>
        <Text variant="caption" color="tertiary" className={styles.logo}>
          AO
        </Text>

        <Heading level="h1">
          {_(msg`Sign in to timekeep`)}
        </Heading>

        <Text variant="caption" color="tertiary">
          {_(msg`Enter your credentials to access the dashboard`)}
        </Text>

        <Separator noMargin />

        {loginError && (
          <Banner variant="danger" onDismiss={() => setLoginError(null)}>
            {loginError}
          </Banner>
        )}

        <Form className={styles.form} onSubmit={onSubmit}>
          <SchemaForm formSchema={formSchema} form={form} />
          <FormActions>
            <Button type="submit" fullWidth loading={isSubmitting}>
              {_(msg`Sign in`)}
            </Button>
          </FormActions>
        </Form>
      </Card.Content>
    </Card>
  );
}
