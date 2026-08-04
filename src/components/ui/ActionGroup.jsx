export function ActionGroup({ children, className = "", ...props }) {
  return (
    <div className={["ui-action-group", className].filter(Boolean).join(" ")} {...props}>
      {children}
    </div>
  );
}
