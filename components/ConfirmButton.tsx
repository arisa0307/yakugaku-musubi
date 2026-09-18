"use client";

export function ConfirmButton({
  action,
  message,
  children,
  className,
}: {
  action: () => Promise<void> | void;
  message: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <form action={action}>
      <button
        type="submit"
        className={className}
        onClick={(e) => {
          if (!confirm(message)) e.preventDefault();
        }}
      >
        {children}
      </button>
    </form>
  );
}
