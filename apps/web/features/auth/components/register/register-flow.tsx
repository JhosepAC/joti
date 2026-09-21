"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StepIndicator } from "./step-indicator";
import { Step1Credentials } from "./step-1-credentials";
import { VerifyCode } from "./verify-code";
import { Step2Profile } from "./step-2-profile";
import { Step3Avatar } from "./step-3-avatar";
import { Step4Bio } from "./step-4-bio";
import { useRegisterFlow } from "../../hooks/use-register-flow";

export const RegisterFlow: React.FC = () => {
  const flow = useRegisterFlow();
  const router = useRouter();

  const handleFinal = async () => {
    try {
      await flow.handleFinalSubmit();
      router.push("/auth/login?registered=1");
    } catch {
      // error already in flow.errors
    }
  };

  return (
    <div className="w-full max-w-[460px] mx-auto py-8">
      <StepIndicator current={flow.displayStep} total={flow.totalSteps} canGoBack={flow.canGoBack} onBack={flow.handleBack} />

      {flow.step === 1 && (
        <Step1Credentials
          data={flow.data}
          errors={flow.errors}
          isLoading={flow.isLoading}
          onChange={flow.updateField}
          onNext={flow.handleStep1Next}
        />
      )}

      {flow.step === 1.1 && (
        <VerifyCode
          email={flow.data.email}
          code={flow.code}
          setCode={flow.setCode}
          errors={flow.errors}
          isLoading={flow.isLoading}
          onVerify={flow.handleVerifyCode}
          onResend={flow.handleResendCode}
          expiresAt={flow.codeExpiresAt}
          resendCooldown={flow.resendCooldown}
        />
      )}

      {flow.step === 2 && (
        <Step2Profile data={flow.data} errors={flow.errors} onChange={flow.updateField} onNext={flow.handleStep2Next} />
      )}

      {flow.step === 3 && (
        <Step3Avatar
          data={flow.data}
          onChange={flow.updateField}
          onNext={flow.handleStep3Next}
          onSkip={flow.handleSkipAvatar}
          error={flow.errors.avatar}
        />
      )}

      {flow.step === 4 && (
        <Step4Bio data={flow.data} errors={flow.errors} isLoading={flow.isLoading} onChange={flow.updateField} onSubmit={handleFinal} />
      )}

      <footer className="text-center mt-10 text-[0.825rem] font-light text-text-secondary">
        ¿Ya tienes una cuenta?{" "}
        <Link href="/auth/login" className="text-text-primary font-medium hover:underline transition-all">
          Iniciar sesión
        </Link>
      </footer>
    </div>
  );
};
