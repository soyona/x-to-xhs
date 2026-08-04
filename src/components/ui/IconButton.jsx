import { Button } from "./Button";

export function IconButton({ className = "", label, title = label, ...props }) {
  return (
    <Button
      aria-label={label}
      className={["ui-icon-button", className].filter(Boolean).join(" ")}
      title={title}
      {...props}
    />
  );
}
