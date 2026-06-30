import { switchAccount } from "@/app/login/switch-account";

type UseAnotherAccountButtonProps = {
  className?: string;
};

export function UseAnotherAccountButton({ className }: UseAnotherAccountButtonProps) {
  return (
    <form action={switchAccount}>
      <button type="submit" className={className}>
        Use another account
      </button>
    </form>
  );
}
