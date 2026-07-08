"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function LogoutButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="outline" disabled={pending}>
      {pending ? (
        <>
          <Spinner aria-hidden="true" data-icon="inline-start" />
          正在退出…
        </>
      ) : (
        "退出登录"
      )}
    </Button>
  );
}
