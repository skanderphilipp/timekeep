import { AuthLayout } from "@/modules/shared/components/auth-layout";
import { ConnectionForm } from "@/modules/server-connection/components/connection-form";
import { useConnectionPage } from "@/modules/server-connection/hooks/use-connection-page";

export function ConnectionPage() {
  const hook = useConnectionPage();

  return (
    <AuthLayout workspace={hook.workspace}>
      <ConnectionForm
        testUrl={hook.testUrl}
        onTestUrlChange={hook.setTestUrl}
        status={hook.status}
        errorMessage={hook.errorMessage}
        onTest={hook.handleTest}
        onConnect={hook.handleConnect}
        connected={hook.isConfigured}
        onReset={hook.handleReset}
        loginPath={hook.loginPath}
      />
    </AuthLayout>
  );
}
